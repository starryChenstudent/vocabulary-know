import db from '../db.js';
import type {
  TestQuestion,
  TestResultInput,
  DailyReport,
  ErrorWordEntry,
  WeeklyReviewWord,
  StatsOverview,
  ResultType,
  Word,
  TestMode,
} from '../types.js';
import { getTodayDate, getDateDaysAgo, shuffleArray } from '../services/wordParser.js';
import { getNewWordsToday } from '../services/wordService.js';

function getTodayWords(userId: number): Word[] {
  const today = getTodayDate();
  return db
    .prepare(
      'SELECT id, english, chinese, created_at FROM words WHERE user_id = ? AND date(created_at) = date(?)'
    )
    .all(userId, today) as Word[];
}

function buildDailyQuestions(userId: number, mode: TestMode): TestQuestion[] {
  const shuffled = shuffleArray(getTodayWords(userId));

  return shuffled.map((word) => ({
    wordId: word.id,
    mode,
    prompt: mode === 'en_to_cn' ? word.english : word.chinese,
    answer: mode === 'en_to_cn' ? word.chinese : word.english,
  }));
}

export function getDailyTest(userId: number, mode: TestMode): TestQuestion[] {
  return buildDailyQuestions(userId, mode);
}

export function getCombinedDailyTest(userId: number): TestQuestion[] {
  const enToCn = buildDailyQuestions(userId, 'en_to_cn');
  const cnToEn = buildDailyQuestions(userId, 'cn_to_en');
  return shuffleArray([...enToCn, ...cnToEn]);
}

export function submitTestResult(userId: number, input: TestResultInput): void {
  const word = db
    .prepare('SELECT id FROM words WHERE id = ? AND user_id = ?')
    .get(input.wordId, userId);
  if (!word) return;

  const today = getTodayDate();
  db.prepare(
    `INSERT INTO test_records (word_id, test_date, mode, result_type, user_answer)
     VALUES (?, ?, ?, ?, ?)`
  ).run(input.wordId, today, input.mode, input.resultType, input.userAnswer ?? null);
}

export function submitTestResults(userId: number, results: TestResultInput[]): void {
  const insert = db.prepare(
    `INSERT INTO test_records (word_id, test_date, mode, result_type, user_answer)
     VALUES (?, ?, ?, ?, ?)`
  );
  const checkWord = db.prepare('SELECT id FROM words WHERE id = ? AND user_id = ?');
  const today = getTodayDate();

  const transaction = db.transaction((items: TestResultInput[]) => {
    for (const r of items) {
      if (!checkWord.get(r.wordId, userId)) continue;
      insert.run(r.wordId, today, r.mode, r.resultType, r.userAnswer ?? null);
    }
  });

  transaction(results);
}

export function getDailyReport(userId: number, date?: string): DailyReport {
  const targetDate = date ?? getTodayDate();

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN tr.result_type = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN tr.result_type = 'spelling_error' THEN 1 ELSE 0 END) as spelling_error,
        SUM(CASE WHEN tr.result_type = 'meaning_wrong' THEN 1 ELSE 0 END) as meaning_wrong,
        SUM(CASE WHEN tr.result_type = 'unknown' THEN 1 ELSE 0 END) as unknown,
        SUM(CASE WHEN tr.mode = 'en_to_cn' THEN 1 ELSE 0 END) as en_to_cn,
        SUM(CASE WHEN tr.mode = 'cn_to_en' THEN 1 ELSE 0 END) as cn_to_en
       FROM test_records tr
       JOIN words w ON w.id = tr.word_id
       WHERE tr.test_date = ? AND w.user_id = ?`
    )
    .get(targetDate, userId) as {
    total: number;
    correct: number;
    spelling_error: number;
    meaning_wrong: number;
    unknown: number;
    en_to_cn: number;
    cn_to_en: number;
  };

  const newWords = db
    .prepare(
      "SELECT COUNT(*) as count FROM words WHERE user_id = ? AND date(created_at) = date(?)"
    )
    .get(userId, targetDate) as { count: number };

  const total = stats.total ?? 0;
  const correct = stats.correct ?? 0;

  return {
    date: targetDate,
    totalTests: total,
    correct,
    spellingError: stats.spelling_error ?? 0,
    meaningWrong: stats.meaning_wrong ?? 0,
    unknown: stats.unknown ?? 0,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    enToCnTests: stats.en_to_cn ?? 0,
    cnToEnTests: stats.cn_to_en ?? 0,
    newWordsAdded: newWords.count ?? 0,
  };
}

export function getReportHistory(userId: number, days: number = 7): DailyReport[] {
  const reports: DailyReport[] = [];
  for (let i = 0; i < days; i++) {
    const date = getDateDaysAgo(i);
    reports.push(getDailyReport(userId, date));
  }
  return reports;
}

export function getErrorBook(userId: number): ErrorWordEntry[] {
  const rows = db
    .prepare(
      `SELECT
        w.id, w.english, w.chinese, w.created_at,
        COUNT(*) as error_count,
        MAX(tr.test_date) as last_error_date,
        (SELECT result_type FROM test_records tr2
         WHERE tr2.word_id = w.id AND tr2.result_type != 'correct'
         ORDER BY tr2.created_at DESC LIMIT 1) as last_error,
        SUM(CASE WHEN tr.result_type = 'spelling_error' THEN 1 ELSE 0 END) as spelling_errors,
        SUM(CASE WHEN tr.result_type = 'meaning_wrong' THEN 1 ELSE 0 END) as meaning_wrong,
        SUM(CASE WHEN tr.result_type = 'unknown' THEN 1 ELSE 0 END) as unknown_count
       FROM test_records tr
       JOIN words w ON w.id = tr.word_id
       WHERE w.user_id = ? AND tr.result_type != 'correct'
       GROUP BY w.id
       ORDER BY error_count DESC, last_error_date DESC`
    )
    .all(userId) as Array<{
    id: number;
    english: string;
    chinese: string;
    created_at: string;
    error_count: number;
    last_error_date: string;
    last_error: ResultType;
    spelling_errors: number;
    meaning_wrong: number;
    unknown_count: number;
  }>;

  return rows.map((r) => ({
    word: {
      id: r.id,
      english: r.english,
      chinese: r.chinese,
      created_at: r.created_at,
    },
    errorCount: r.error_count,
    lastError: r.last_error,
    lastErrorDate: r.last_error_date,
    errorTypes: {
      correct: 0,
      spelling_error: r.spelling_errors,
      meaning_wrong: r.meaning_wrong,
      unknown: r.unknown_count,
    },
  }));
}

export function getWeeklyReview(userId: number): WeeklyReviewWord[] {
  const since = getDateDaysAgo(7);
  const today = getTodayDate();

  const words = db
    .prepare('SELECT id, english, chinese, created_at FROM words WHERE user_id = ?')
    .all(userId) as Word[];
  const reviewWords: WeeklyReviewWord[] = [];

  for (const word of words) {
    const errors = db
      .prepare(
        `SELECT result_type, test_date FROM test_records
         WHERE word_id = ? AND test_date >= ? AND result_type != 'correct'
         ORDER BY created_at DESC`
      )
      .all(word.id, since) as Array<{ result_type: ResultType; test_date: string }>;

    if (errors.length === 0) continue;

    const unknownCount = errors.filter((e) => e.result_type === 'unknown').length;

    const lastCorrect = db
      .prepare(
        `SELECT test_date FROM test_records
         WHERE word_id = ? AND result_type = 'correct'
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(word.id) as { test_date: string } | undefined;

    let daysSinceLastCorrect: number | null = null;
    if (lastCorrect) {
      const lastDate = new Date(lastCorrect.test_date);
      const todayDate = new Date(today);
      daysSinceLastCorrect = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      daysSinceLastCorrect = 999;
    }

    const priority =
      errors.length * 3 + unknownCount * 5 + (daysSinceLastCorrect ?? 0) * 0.5;

    reviewWords.push({
      word,
      priority,
      errorCount7d: errors.length,
      unknownCount7d: unknownCount,
      daysSinceLastCorrect,
      recentErrors: errors.slice(0, 5).map((e) => e.result_type),
    });
  }

  reviewWords.sort((a, b) => b.priority - a.priority);
  return reviewWords;
}

export function getWeeklyReviewTest(userId: number): TestQuestion[] {
  const reviewWords = getWeeklyReview(userId);
  const questions: TestQuestion[] = [];

  for (const rw of reviewWords) {
    const modes: TestMode[] = [];
    if (rw.recentErrors.some((e) => e === 'meaning_wrong' || e === 'unknown')) {
      modes.push('en_to_cn');
    }
    if (rw.recentErrors.some((e) => e === 'spelling_error' || e === 'unknown')) {
      modes.push('cn_to_en');
    }
    if (modes.length === 0) {
      modes.push('en_to_cn', 'cn_to_en');
    }

    for (const mode of modes) {
      questions.push({
        wordId: rw.word.id,
        mode,
        prompt: mode === 'en_to_cn' ? rw.word.english : rw.word.chinese,
        answer: mode === 'en_to_cn' ? rw.word.chinese : rw.word.english,
      });
    }
  }

  return shuffleArray(questions);
}

export function getStatsOverview(userId: number): StatsOverview {
  const totalWords = (
    db.prepare('SELECT COUNT(*) as c FROM words WHERE user_id = ?').get(userId) as { c: number }
  ).c;
  const todayReport = getDailyReport(userId);
  const errorBook = getErrorBook(userId);
  const weeklyReview = getWeeklyReview(userId);

  const streak = calculateStreak(userId);

  return {
    totalWords,
    todayNewWords: getNewWordsToday(userId),
    todayTests: todayReport.totalTests,
    todayAccuracy: todayReport.accuracy,
    errorBookCount: errorBook.length,
    weeklyReviewCount: weeklyReview.length,
    streakDays: streak,
  };
}

function calculateStreak(userId: number): number {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = getDateDaysAgo(i);
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM test_records tr
         JOIN words w ON w.id = tr.word_id
         WHERE tr.test_date = ? AND w.user_id = ?`
      )
      .get(date, userId) as { c: number };
    if (row.c > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function getWordHistory(userId: number, wordId: number) {
  const word = db
    .prepare('SELECT id FROM words WHERE id = ? AND user_id = ?')
    .get(wordId, userId);
  if (!word) return [];

  return db
    .prepare(
      `SELECT * FROM test_records WHERE word_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(wordId);
}
