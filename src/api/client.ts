export interface User {
  id: number;
  username: string;
  created_at: string;
}

export type TestMode = 'en_to_cn' | 'cn_to_en';
export type ResultType = 'correct' | 'spelling_error' | 'meaning_wrong' | 'unknown';

export interface Word {
  id: number;
  english: string;
  chinese: string;
  created_at: string;
}

export interface TestQuestion {
  wordId: number;
  mode: TestMode;
  prompt: string;
  answer: string;
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

export interface StatsOverview {
  totalWords: number;
  todayNewWords: number;
  todayTests: number;
  todayAccuracy: number;
  errorBookCount: number;
  weeklyReviewCount: number;
  streakDays: number;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  parsed: { english: string; chinese: string }[];
  rawText?: string;
  previewDataUrl?: string;
  ocrEngine?: 'dashscope' | 'openai' | 'tesseract';
  handwritingHint?: string;
}

export interface SubmitResult {
  resultType: ResultType;
  correct: boolean;
  expected: string;
}

const BASE = '/api';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error('无法连接服务器，请确认后端已启动（npm run dev）');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    if (res.status === 401 && !url.startsWith('/auth/')) {
      onUnauthorized?.();
    }
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

export const api = {
  getRegistrationStatus: () => request<{ allowed: boolean }>('/auth/registration-status'),

  login: (username: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: () => request<User>('/auth/me'),

  getStats: () => request<StatsOverview>('/stats'),
  getWords: () => request<Word[]>('/words'),
  deleteWord: (id: number) => request<{ success: boolean }>(`/words/${id}`, { method: 'DELETE' }),
  deleteWords: (ids: number[]) =>
    request<{ success: boolean; deleted: number }>('/words/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  deleteAllWords: () =>
    request<{ success: boolean; deleted: number }>('/words/all', { method: 'DELETE' }),
  updateWord: (id: number, english: string, chinese: string) =>
    request<Word>(`/words/${id}`, { method: 'PUT', body: JSON.stringify({ english, chinese }) }),

  importText: (text: string) =>
    request<ImportResult>('/import/text', { method: 'POST', body: JSON.stringify({ text }) }),

  importImage: async (file: File, signal?: AbortSignal): Promise<ImportResult> => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${BASE}/import/image`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '上传失败' }));
      if (res.status === 401) onUnauthorized?.();
      throw new Error(err.error || '上传失败');
    }
    return res.json();
  },

  importImagePreview: async (file: File): Promise<{ previewDataUrl: string }> => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${BASE}/import/preview`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '预览失败' }));
      if (res.status === 401) onUnauthorized?.();
      throw new Error(err.error || '预览失败');
    }
    return res.json();
  },

  confirmImport: (words: { english: string; chinese: string }[]) =>
    request<ImportResult>('/import/confirm', {
      method: 'POST',
      body: JSON.stringify({ words }),
    }),

  getDailyTest: (mode: TestMode) =>
    request<TestQuestion[]>(`/test/daily?mode=${mode}`),

  submitAnswer: (wordId: number, mode: TestMode, userAnswer: string) =>
    request<SubmitResult>('/test/submit', {
      method: 'POST',
      body: JSON.stringify({ wordId, mode, userAnswer }),
    }),

  getDailyReport: (date?: string) =>
    request<DailyReport>(`/report/daily${date ? `?date=${date}` : ''}`),

  getReportHistory: (days = 7) => request<DailyReport[]>(`/report/history?days=${days}`),

  getErrorBook: () => request<ErrorWordEntry[]>('/error-book'),

  getWeeklyReview: () => request<WeeklyReviewWord[]>('/review/weekly'),

  getWeeklyReviewTest: () => request<TestQuestion[]>('/review/weekly/test'),
};

export const RESULT_LABELS: Record<ResultType, string> = {
  correct: '正确',
  spelling_error: '拼写错误',
  meaning_wrong: '释义错误',
  unknown: '完全不会',
};

export const MODE_LABELS: Record<TestMode, string> = {
  en_to_cn: '英 → 中',
  cn_to_en: '中 → 英',
};
