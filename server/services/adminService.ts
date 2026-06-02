import db from '../db.js';
import { AuthError, updateUserPassword, hashPasswordForStorage, isRegistrationAllowed } from './authService.js';
import {
  isRegistrationEnabledInSettings,
  isRegistrationLockedByEnv,
  setRegistrationEnabled,
} from './appSettingsService.js';
import { getTodayDate, getDateDaysAgo } from './wordParser.js';

export interface AdminStats {
  userCount: number;
  adminCount: number;
  testsToday: number;
  activeUsers7d: number;
  registrationEnabled: boolean;
  registrationLockedByEnv: boolean;
  registrationAllowed: boolean;
}

export interface AdminUserRow {
  id: number;
  username: string;
  created_at: string;
  is_admin: boolean;
  word_count: number;
  tests_today: number;
  tests_7d: number;
  last_test_date: string | null;
}

export function getAdminStats(): AdminStats {
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const adminCount = (
    db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get() as { c: number }
  ).c;

  const today = getTodayDate();
  const since7d = getDateDaysAgo(6);

  const testsToday = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM test_records tr
         JOIN words w ON w.id = tr.word_id
         WHERE tr.test_date = ?`
      )
      .get(today) as { c: number }
  ).c;

  const activeUsers7d = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT w.user_id) AS c FROM test_records tr
         JOIN words w ON w.id = tr.word_id
         WHERE tr.test_date >= ?`
      )
      .get(since7d) as { c: number }
  ).c;

  return {
    userCount,
    adminCount,
    testsToday,
    activeUsers7d,
    registrationEnabled: isRegistrationEnabledInSettings(),
    registrationLockedByEnv: isRegistrationLockedByEnv(),
    registrationAllowed: isRegistrationAllowed(),
  };
}

export function updateRegistrationEnabled(enabled: boolean): AdminStats {
  if (isRegistrationLockedByEnv()) {
    throw new AuthError('注册开关已被环境变量 ALLOW_REGISTRATION=false 锁定', 403);
  }
  setRegistrationEnabled(enabled);
  return getAdminStats();
}

export function listUsersWithStats(): AdminUserRow[] {
  const today = getTodayDate();
  const since7d = getDateDaysAgo(6);

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.created_at, u.is_admin, COUNT(w.id) AS word_count,
        (SELECT COUNT(*) FROM test_records tr
         JOIN words w2 ON w2.id = tr.word_id
         WHERE w2.user_id = u.id AND tr.test_date = ?) AS tests_today,
        (SELECT COUNT(*) FROM test_records tr
         JOIN words w2 ON w2.id = tr.word_id
         WHERE w2.user_id = u.id AND tr.test_date >= ?) AS tests_7d,
        (SELECT MAX(tr.test_date) FROM test_records tr
         JOIN words w2 ON w2.id = tr.word_id
         WHERE w2.user_id = u.id) AS last_test_date
       FROM users u
       LEFT JOIN words w ON w.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id`
    )
    .all(today, since7d) as Array<{
    id: number;
    username: string;
    created_at: string;
    is_admin: number;
    word_count: number;
    tests_today: number;
    tests_7d: number;
    last_test_date: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    is_admin: row.is_admin === 1,
    word_count: row.word_count,
    tests_today: row.tests_today,
    tests_7d: row.tests_7d,
    last_test_date: row.last_test_date,
  }));
}

export function setUserAdmin(targetId: number, operatorId: number, isAdmin: boolean): void {
  assertUserExists(targetId);

  if (targetId === operatorId && !isAdmin) {
    throw new AuthError('不能取消自己的管理员权限', 400);
  }

  const target = db
    .prepare('SELECT is_admin FROM users WHERE id = ?')
    .get(targetId) as { is_admin: number };

  if (!isAdmin && target.is_admin === 1) {
    const adminCount = (
      db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get() as { c: number }
    ).c;
    if (adminCount <= 1) {
      throw new AuthError('至少保留一名管理员', 400);
    }
  }

  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, targetId);
}

export function deleteUserById(userId: number): boolean {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return result.changes > 0;
}

export function bootstrapAdmin(): void {
  const username = process.env.ADMIN_USERNAME?.trim();
  if (!username) return;

  const password = process.env.ADMIN_PASSWORD;
  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .get(username) as { id: number } | undefined;

  if (existing) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    if (password && password.length >= 6) {
      updateUserPassword(existing.id, password);
    }
    return;
  }

  if (!password || password.length < 6) {
    console.warn('[admin] ADMIN_USERNAME 已设置，但 ADMIN_PASSWORD 无效，无法创建管理员');
    return;
  }

  db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run(
    username,
    hashPasswordForStorage(password)
  );
}

export function assertUserExists(userId: number): void {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) {
    throw new AuthError('用户不存在', 404);
  }
}

export function assertCanDeleteUser(targetId: number, operatorId: number): void {
  if (targetId === operatorId) {
    throw new AuthError('不能删除当前登录的管理员账号', 400);
  }
  assertUserExists(targetId);
}
