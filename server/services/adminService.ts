import db from '../db.js';
import { AuthError, updateUserPassword, hashPasswordForStorage } from './authService.js';

export interface AdminStats {
  userCount: number;
  totalWords: number;
  adminCount: number;
}

export interface AdminUserRow {
  id: number;
  username: string;
  created_at: string;
  is_admin: boolean;
  word_count: number;
}

export function getAdminStats(): AdminStats {
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const totalWords = (db.prepare('SELECT COUNT(*) AS c FROM words').get() as { c: number }).c;
  const adminCount = (
    db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get() as { c: number }
  ).c;
  return { userCount, totalWords, adminCount };
}

export function listUsersWithStats(): AdminUserRow[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.created_at, u.is_admin, COUNT(w.id) AS word_count
       FROM users u
       LEFT JOIN words w ON w.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id`
    )
    .all() as Array<{
    id: number;
    username: string;
    created_at: string;
    is_admin: number;
    word_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    is_admin: row.is_admin === 1,
    word_count: row.word_count,
  }));
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
