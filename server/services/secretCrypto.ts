import crypto from 'crypto';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer | null {
  const secret = process.env.KEY_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return crypto.scryptSync(secret, 'vocabulary-iknow-api-key-v1', 32);
}

export function isEncryptionEnabled(): boolean {
  return deriveKey() !== null;
}

export function encryptSecret(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(PREFIX)) return trimmed;

  const key = deriveKey();
  if (!key) return trimmed;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + payload.toString('base64url');
}

export function decryptSecret(stored: string): string {
  const value = stored.trim();
  if (!value || !value.startsWith(PREFIX)) return value;

  const key = deriveKey();
  if (!key) {
    throw new Error('数据库中的 API Key 已加密，请设置 KEY_ENCRYPTION_SECRET 环境变量后重启服务');
  }

  const raw = Buffer.from(value.slice(PREFIX.length), 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
