import db from '../db.js';
import type { Word, ParsedWord, ImportResult } from '../types.js';
import { getTodayDate } from '../services/wordParser.js';
import { WORD_SELECT, mapWordRow } from './spacedRepetitionService.js';

export function getAllWords(userId: number): Word[] {
  const rows = db
    .prepare(`SELECT ${WORD_SELECT} FROM words WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as Array<Parameters<typeof mapWordRow>[0]>;
  return rows.map(mapWordRow);
}

export function getWordById(id: number, userId: number): Word | undefined {
  const row = db
    .prepare(`SELECT ${WORD_SELECT} FROM words WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Parameters<typeof mapWordRow>[0] | undefined;
  return row ? mapWordRow(row) : undefined;
}

export function importWords(userId: number, parsed: ParsedWord[]): ImportResult {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO words (user_id, english, chinese, created_at, srs_stage, next_review_date)
     VALUES (?, ?, ?, datetime('now', 'localtime'), 0, NULL)`
  );
  const checkExists = db.prepare(
    'SELECT id FROM words WHERE user_id = ? AND english = ? COLLATE NOCASE'
  );

  let imported = 0;
  let duplicates = 0;

  const transaction = db.transaction((words: ParsedWord[]) => {
    for (const w of words) {
      const existing = checkExists.get(userId, w.english);
      if (existing) {
        duplicates++;
        continue;
      }
      const result = insert.run(userId, w.english, w.chinese);
      if (result.changes > 0) imported++;
      else duplicates++;
    }
  });

  transaction(parsed);

  return { imported, duplicates, parsed };
}

export function deleteWord(id: number, userId: number): boolean {
  const result = db.prepare('DELETE FROM words WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function deleteWords(ids: number[], userId: number): number {
  const stmt = db.prepare('DELETE FROM words WHERE id = ? AND user_id = ?');
  const transaction = db.transaction((wordIds: number[]) => {
    let count = 0;
    for (const id of wordIds) {
      count += stmt.run(id, userId).changes;
    }
    return count;
  });
  return transaction(ids);
}

export function deleteAllWords(userId: number): number {
  return db.prepare('DELETE FROM words WHERE user_id = ?').run(userId).changes;
}

export function getWordCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM words WHERE user_id = ?')
    .get(userId) as { count: number };
  return row.count;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportWordsCsv(userId: number): string {
  const words = getAllWords(userId);
  const header = 'english,chinese,srs_stage,next_review_date';
  const rows = words.map(
    (word) =>
      `${escapeCsvField(word.english)},${escapeCsvField(word.chinese)},${word.srs_stage},${word.next_review_date ?? ''}`
  );
  return `\uFEFF${[header, ...rows].join('\n')}`;
}

export function getNewWordsToday(userId: number): number {
  const today = getTodayDate();
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM words WHERE user_id = ? AND date(created_at) = date(?)"
    )
    .get(userId, today) as { count: number };
  return row.count;
}

export function updateWord(
  id: number,
  userId: number,
  english: string,
  chinese: string
): Word | null {
  try {
    db.prepare('UPDATE words SET english = ?, chinese = ? WHERE id = ? AND user_id = ?').run(
      english,
      chinese,
      id,
      userId
    );
    return getWordById(id, userId) ?? null;
  } catch {
    return null;
  }
}
