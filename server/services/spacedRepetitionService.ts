import db from '../db.js';
import type { ResultType, Word } from '../types.js';
import { getTodayDate } from './wordParser.js';

/** 艾宾浩斯复习间隔（天）：stage 1→1d, 2→2d, 3→4d … */
export const SRS_INTERVALS = [1, 2, 4, 7, 14, 30] as const;

export const WORD_SELECT =
  'id, english, chinese, created_at, srs_stage, next_review_date, last_review_date';

export function mapWordRow(row: {
  id: number;
  english: string;
  chinese: string;
  created_at: string;
  srs_stage?: number;
  next_review_date?: string | null;
  last_review_date?: string | null;
}): Word {
  return {
    id: row.id,
    english: row.english,
    chinese: row.chinese,
    created_at: row.created_at,
    srs_stage: row.srs_stage ?? 0,
    next_review_date: row.next_review_date ?? null,
    last_review_date: row.last_review_date ?? null,
  };
}

export function intervalDaysForStage(stage: number): number {
  if (stage <= 0) return SRS_INTERVALS[0];
  const index = Math.min(stage, SRS_INTERVALS.length - 1);
  return SRS_INTERVALS[index];
}

export function addDaysToDate(fromDate: string, days: number): string {
  const [y, m, d] = fromDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNewWordsTodayList(userId: number): Word[] {
  const today = getTodayDate();
  const rows = db
    .prepare(
      `SELECT ${WORD_SELECT} FROM words
       WHERE user_id = ? AND date(created_at) = date(?)
       ORDER BY created_at ASC`
    )
    .all(userId, today) as Array<Parameters<typeof mapWordRow>[0]>;
  return rows.map(mapWordRow);
}

export function getDueWordsTodayList(userId: number): Word[] {
  const today = getTodayDate();
  const rows = db
    .prepare(
      `SELECT ${WORD_SELECT} FROM words
       WHERE user_id = ?
         AND date(created_at) < date(?)
         AND (next_review_date IS NULL OR date(next_review_date) <= date(?))
       ORDER BY COALESCE(next_review_date, created_at) ASC, created_at ASC`
    )
    .all(userId, today, today) as Array<Parameters<typeof mapWordRow>[0]>;
  return rows.map(mapWordRow);
}

export function getDueWordsTodayCount(userId: number): number {
  const today = getTodayDate();
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM words
       WHERE user_id = ?
         AND date(created_at) < date(?)
         AND (next_review_date IS NULL OR date(next_review_date) <= date(?))`
    )
    .get(userId, today, today) as { count: number };
  return row.count;
}

export function getDailyStudyWords(userId: number): Word[] {
  return [...getNewWordsTodayList(userId), ...getDueWordsTodayList(userId)];
}

export function getTodayStudiedWordsCount(userId: number): number {
  const studyWords = getDailyStudyWords(userId);
  if (studyWords.length === 0) return 0;

  const today = getTodayDate();
  const ids = studyWords.map((w) => w.id);
  const placeholders = ids.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT word_id) as count FROM test_records
       WHERE test_date = ? AND word_id IN (${placeholders})`
    )
    .get(today, ...ids) as { count: number };
  return row.count;
}

export function applySrsAfterTest(wordId: number, resultType: ResultType): void {
  const today = getTodayDate();
  const row = db
    .prepare('SELECT srs_stage FROM words WHERE id = ?')
    .get(wordId) as { srs_stage: number } | undefined;
  if (!row) return;

  if (resultType === 'correct') {
    const newStage = row.srs_stage + 1;
    const nextReview = addDaysToDate(today, intervalDaysForStage(newStage));
    db.prepare(
      `UPDATE words SET srs_stage = ?, next_review_date = ?, last_review_date = ? WHERE id = ?`
    ).run(newStage, nextReview, today, wordId);
    return;
  }

  const newStage = Math.max(0, row.srs_stage - 1);
  const nextReview = addDaysToDate(today, SRS_INTERVALS[0]);
  db.prepare(
    `UPDATE words SET srs_stage = ?, next_review_date = ?, last_review_date = ? WHERE id = ?`
  ).run(newStage, nextReview, today, wordId);
}
