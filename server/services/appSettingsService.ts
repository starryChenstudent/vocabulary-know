import db from '../db.js';

const REGISTRATION_KEY = 'registration_enabled';

export function isRegistrationEnabledInSettings(): boolean {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(REGISTRATION_KEY) as { value: string } | undefined;
  if (!row) return true;
  return row.value === 'true' || row.value === '1';
}

export function setRegistrationEnabled(enabled: boolean): void {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(REGISTRATION_KEY, enabled ? 'true' : 'false');
}

export function isRegistrationLockedByEnv(): boolean {
  return process.env.ALLOW_REGISTRATION === 'false';
}
