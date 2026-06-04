import Database from 'better-sqlite3';
import { encryptSecret, isEncryptionEnabled } from './services/secretCrypto.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;

  const fromCwd = path.join(process.cwd(), 'data', 'vocabulary.db');
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) return fromCwd;

  const fromProjectRoot = path.join(__dirname, '../../data/vocabulary.db');
  if (fs.existsSync(path.join(__dirname, '../../package.json'))) return fromProjectRoot;

  return path.join(__dirname, '../data/vocabulary.db');
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function migrateWordsForMultiUser(db: Database.Database): void {
  if (columnExists(db, 'words', 'user_id')) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE words_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        english TEXT NOT NULL,
        chinese TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO words_new (id, user_id, english, chinese, created_at)
        SELECT id, NULL, english, chinese, created_at FROM words;

      DROP TABLE words;
      ALTER TABLE words_new RENAME TO words;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_words_user_english ON words(user_id, english COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_words_user ON words(user_id);
    `);
  })();
}

function ensureWordsCreatedAtDefault(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='words'")
    .get() as { sql: string } | undefined;
  if (!row?.sql || row.sql.includes("DEFAULT (datetime('now'")) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE words_fixed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        english TEXT NOT NULL,
        chinese TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO words_fixed (id, user_id, english, chinese, created_at)
        SELECT id, user_id, english, chinese, created_at FROM words;

      DROP TABLE words;
      ALTER TABLE words_fixed RENAME TO words;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_words_user_english ON words(user_id, english COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_words_user ON words(user_id);
    `);
  })();
}

function migrateUsersAdmin(db: Database.Database): void {
  if (columnExists(db, 'users', 'is_admin')) return;
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

function migrateTestRecordsDictationMode(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='test_records'")
    .get() as { sql: string } | undefined;
  if (row?.sql?.includes("'dictation'")) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE test_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        test_date TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('en_to_cn', 'cn_to_en', 'dictation')),
        result_type TEXT NOT NULL CHECK(result_type IN ('correct', 'spelling_error', 'meaning_wrong', 'unknown')),
        user_answer TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
      );

      INSERT INTO test_records_new (id, word_id, test_date, mode, result_type, user_answer, created_at)
        SELECT id, word_id, test_date, mode, result_type, user_answer, created_at FROM test_records;

      DROP TABLE test_records;
      ALTER TABLE test_records_new RENAME TO test_records;

      CREATE INDEX IF NOT EXISTS idx_test_records_date ON test_records(test_date);
      CREATE INDEX IF NOT EXISTS idx_test_records_word ON test_records(word_id);
      CREATE INDEX IF NOT EXISTS idx_test_records_result ON test_records(result_type);
    `);
  })();
}

function migrateWordsSrs(db: Database.Database): void {
  if (!columnExists(db, 'words', 'srs_stage')) {
    db.exec('ALTER TABLE words ADD COLUMN srs_stage INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'words', 'next_review_date')) {
    db.exec('ALTER TABLE words ADD COLUMN next_review_date TEXT');
  }
  if (!columnExists(db, 'words', 'last_review_date')) {
    db.exec('ALTER TABLE words ADD COLUMN last_review_date TEXT');
  }

  db.exec(`
    UPDATE words
    SET next_review_date = date('now', 'localtime')
    WHERE next_review_date IS NULL
      AND date(created_at) < date('now', 'localtime')
  `);

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_words_user_next_review ON words(user_id, next_review_date)'
  );
}

function migrateEncryptStoredApiKeys(db: Database.Database): void {
  if (!isEncryptionEnabled()) return;

  const rows = db
    .prepare(
      `SELECT user_id, preset, api_key FROM user_ai_provider_configs WHERE trim(api_key) != ''`
    )
    .all() as Array<{ user_id: number; preset: string; api_key: string }>;

  const update = db.prepare(
    `UPDATE user_ai_provider_configs SET api_key = ? WHERE user_id = ? AND preset = ?`
  );

  for (const row of rows) {
    const key = row.api_key.trim();
    if (!key || key.startsWith('enc:v1:')) continue;
    update.run(encryptSecret(key), row.user_id, row.preset);
  }
}

function migrateUserAiDailyTokenLimit(db: Database.Database): void {
  if (!columnExists(db, 'user_ai_settings', 'daily_token_limit')) {
    db.exec('ALTER TABLE user_ai_settings ADD COLUMN daily_token_limit INTEGER');
  }
}

function migrateAiUsageLogs(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      feature TEXT NOT NULL CHECK(feature IN ('ocr', 'translate')),
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_date
      ON ai_usage_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_provider_model
      ON ai_usage_logs(user_id, provider, model);
  `);
}

function migrateAiProviderConfigs(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_ai_provider_configs (
      user_id INTEGER NOT NULL,
      preset TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      vision_model TEXT NOT NULL DEFAULT '',
      text_model TEXT NOT NULL DEFAULT '',
      structure_model TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (user_id, preset),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const legacyRows = db
    .prepare(
      `SELECT user_id, provider, preset, api_key, base_url, vision_model, text_model, structure_model
       FROM user_ai_settings
       WHERE trim(api_key) != ''`
    )
    .all() as Array<{
    user_id: number;
    provider: string;
    preset: string;
    api_key: string;
    base_url: string;
    vision_model: string;
    text_model: string;
    structure_model: string;
  }>;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO user_ai_provider_configs (
       user_id, preset, provider, api_key, base_url, vision_model, text_model, structure_model
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const row of legacyRows) {
    insert.run(
      row.user_id,
      row.preset,
      row.provider,
      row.api_key,
      row.base_url,
      row.vision_model,
      row.text_model,
      row.structure_model
    );
  }
}

const dbPath = resolveDbPath();
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    english TEXT NOT NULL,
    chinese TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(english COLLATE NOCASE)
  );

  CREATE TABLE IF NOT EXISTS test_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    test_date TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('en_to_cn', 'cn_to_en', 'dictation')),
    result_type TEXT NOT NULL CHECK(result_type IN ('correct', 'spelling_error', 'meaning_wrong', 'unknown')),
    user_answer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_test_records_date ON test_records(test_date);
  CREATE INDEX IF NOT EXISTS idx_test_records_word ON test_records(word_id);
  CREATE INDEX IF NOT EXISTS idx_test_records_result ON test_records(result_type);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'dashscope',
    preset TEXT NOT NULL DEFAULT 'dashscope',
    api_key TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    vision_model TEXT NOT NULL DEFAULT 'qwen-vl-plus',
    text_model TEXT NOT NULL DEFAULT 'qwen-turbo',
    structure_model TEXT NOT NULL DEFAULT 'qwen-vl-plus',
    ocr_engine TEXT NOT NULL DEFAULT 'auto',
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

  migrateWordsForMultiUser(db);
  ensureWordsCreatedAtDefault(db);
  migrateUsersAdmin(db);
  migrateAiProviderConfigs(db);
  migrateAiUsageLogs(db);
  migrateUserAiDailyTokenLimit(db);
  migrateEncryptStoredApiKeys(db);
  migrateTestRecordsDictationMode(db);
  migrateWordsSrs(db);

export default db;

export function closeDb(): void {
  db.close();
}

export type TestMode = 'en_to_cn' | 'cn_to_en' | 'dictation';
export type ResultType = 'correct' | 'spelling_error' | 'meaning_wrong' | 'unknown';

export interface Word {
  id: number;
  english: string;
  chinese: string;
  created_at: string;
}

export interface TestRecord {
  id: number;
  word_id: number;
  test_date: string;
  mode: TestMode;
  result_type: ResultType;
  user_answer: string | null;
  created_at: string;
}

export interface WordWithStats extends Word {
  total_tests: number;
  correct_count: number;
  error_count: number;
  last_result: ResultType | null;
}
