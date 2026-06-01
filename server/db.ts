import Database from 'better-sqlite3';
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
    mode TEXT NOT NULL CHECK(mode IN ('en_to_cn', 'cn_to_en')),
    result_type TEXT NOT NULL CHECK(result_type IN ('correct', 'spelling_error', 'meaning_wrong', 'unknown')),
    user_answer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_test_records_date ON test_records(test_date);
  CREATE INDEX IF NOT EXISTS idx_test_records_word ON test_records(word_id);
  CREATE INDEX IF NOT EXISTS idx_test_records_result ON test_records(result_type);
`);

  migrateWordsForMultiUser(db);
  ensureWordsCreatedAtDefault(db);
  migrateUsersAdmin(db);

export default db;

export function closeDb(): void {
  db.close();
}

export type TestMode = 'en_to_cn' | 'cn_to_en';
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
