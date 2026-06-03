export type TestMode = 'en_to_cn' | 'cn_to_en' | 'dictation';
export type ResultType = 'correct' | 'spelling_error' | 'meaning_wrong' | 'unknown';

export interface Word {
  id: number;
  english: string;
  chinese: string;
  created_at: string;
  srs_stage: number;
  next_review_date: string | null;
  last_review_date: string | null;
}

export interface ParsedWord {
  english: string;
  chinese: string;
}

export interface TestQuestion {
  wordId: number;
  mode: TestMode;
  prompt: string;
  answer: string;
  queue?: 'new' | 'due';
}

export interface TestResultInput {
  wordId: number;
  mode: TestMode;
  resultType: ResultType;
  userAnswer?: string;
}

export interface DailyReport {
  date: string;
  totalTests: number;
  correct: number;
  spellingError: number;
  meaningWrong: number;
  unknown: number;
  accuracy: number;
  enToCnTests: number;
  cnToEnTests: number;
  dictationTests: number;
  newWordsAdded: number;
}

export interface ErrorWordEntry {
  word: Word;
  errorCount: number;
  lastError: ResultType;
  lastErrorDate: string;
  errorTypes: Record<ResultType, number>;
}

export interface WeeklyReviewWord {
  word: Word;
  priority: number;
  errorCount7d: number;
  unknownCount7d: number;
  daysSinceLastCorrect: number | null;
  recentErrors: ResultType[];
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  parsed: ParsedWord[];
  previewDataUrl?: string;
  ocrUsage?: OcrUsageInfo;
}

export interface OcrUsageInfo {
  preset: 'dashscope' | 'deepseek' | 'openai' | 'moonshot' | 'custom' | 'tesseract';
  model: string;
  totalTokens: number;
}

export interface StatsOverview {
  totalWords: number;
  todayNewWords: number;
  todayDueWords: number;
  todayStudyWords: number;
  todayStudiedWords: number;
  todayTests: number;
  todayAccuracy: number;
  errorBookCount: number;
  weeklyReviewCount: number;
  streakDays: number;
}
