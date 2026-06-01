import crypto from 'crypto';
import type { Request } from 'express';
import db from '../db.js';

const SESSION_DAYS = 30;
const SESSION_COOKIE = 'session';
const SCRYPT_KEYLEN = 64;

export interface UserPublic {
  id: number;
  username: string;
  created_at: string;
  is_admin: boolean;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function isRegistrationAllowed(): boolean {
  return process.env.ALLOW_REGISTRATION !== 'false';
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions() {
  const parts = [
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function getClearSessionCookieOptions(): string {
  return 'Path=/; HttpOnly; Max-Age=0; SameSite=Lax';
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};

  return Object.fromEntries(
    header.split(';').map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part.trim(), ''];
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      return [key, decodeURIComponent(value)];
    })
  );
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function hashPasswordForStorage(password: string): string {
  return hashPassword(password);
}

export function updateUserPassword(userId: number, password: string): void {
  if (password.length < 6) {
    throw new AuthError('密码至少 6 位', 400);
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(password),
    userId
  );
}

export function isUserAdmin(userId: number): boolean {
  const row = db
    .prepare('SELECT is_admin FROM users WHERE id = ?')
    .get(userId) as { is_admin: number } | undefined;
  return row?.is_admin === 1;
}

function toUserPublic(row: {
  id: number;
  username: string;
  created_at: string;
  is_admin: number;
}): UserPublic {
  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    is_admin: row.is_admin === 1,
  };
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (test.length !== expected.length) return false;
  return crypto.timingSafeEqual(test, expected);
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt.toISOString()
  );
  return token;
}

function assignOrphanWords(userId: number): void {
  db.prepare('UPDATE words SET user_id = ? WHERE user_id IS NULL').run(userId);
}

export function register(username: string, password: string): { user: UserPublic; token: string } {
  if (!isRegistrationAllowed()) {
    throw new AuthError('注册已关闭', 403);
  }

  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    throw new AuthError('用户名长度需 2–32 字符', 400);
  }
  if (password.length < 6) {
    throw new AuthError('密码至少 6 位', 400);
  }

  const passwordHash = hashPassword(password);
  let userId: number;
  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(trimmed, passwordHash);
    userId = Number(result.lastInsertRowid);
  } catch {
    throw new AuthError('用户名已存在', 409);
  }

  assignOrphanWords(userId);

  const token = createSession(userId);
  const user = getUserById(userId);
  if (!user) throw new AuthError('注册失败', 500);
  return { user, token };
}

export function login(username: string, password: string): { user: UserPublic; token: string } {
  const trimmed = username.trim();
  const row = db
    .prepare(
      'SELECT id, username, password_hash, created_at, is_admin FROM users WHERE username = ? COLLATE NOCASE'
    )
    .get(trimmed) as
    | {
        id: number;
        username: string;
        password_hash: string;
        created_at: string;
        is_admin: number;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AuthError('用户名或密码错误', 401);
  }

  const token = createSession(row.id);
  return { user: toUserPublic(row), token };
}

export function logout(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function validateSession(token: string): number | null {
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { user_id: number; expires_at: string } | undefined;

  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return row.user_id;
}

export function getUserById(id: number): UserPublic | null {
  const row = db
    .prepare('SELECT id, username, created_at, is_admin FROM users WHERE id = ?')
    .get(id) as
    | { id: number; username: string; created_at: string; is_admin: number }
    | undefined;
  return row ? toUserPublic(row) : null;
}
