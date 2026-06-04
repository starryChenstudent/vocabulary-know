import db from '../db.js';

export type AiUsageFeature = 'ocr' | 'translate';

export interface UsageLogInput {
  userId: number;
  provider: string;
  model: string;
  feature: AiUsageFeature;
  promptTokens: number;
  completionTokens: number;
}

export interface TokenUsageByModelRow {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  callCount: number;
}

export interface TokenUsageBudget {
  dailyTokenLimit: number | null;
  todayPromptTokens: number;
  todayCompletionTokens: number;
  todayTotalTokens: number;
  limitReached: boolean;
}

export interface TokenUsageReport {
  budget: TokenUsageBudget;
  summary: {
    promptTokens: number;
    completionTokens: number;
  };
  byModel: TokenUsageByModelRow[];
}

const MAX_RANGE_DAYS = 90;

function parseDateOnly(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function getTodayDate(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function getTodayTokenUsage(userId: number): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const today = getTodayDate();
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens
       FROM ai_usage_logs
       WHERE user_id = ?
         AND date(created_at) = date(?)`
    )
    .get(userId, today) as { prompt_tokens: number; completion_tokens: number };

  const promptTokens = row.prompt_tokens;
  const completionTokens = row.completion_tokens;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function getUserDailyTokenLimit(userId: number): number | null {
  const row = db
    .prepare('SELECT daily_token_limit FROM user_ai_settings WHERE user_id = ?')
    .get(userId) as { daily_token_limit: number | null } | undefined;
  if (row?.daily_token_limit == null || row.daily_token_limit <= 0) return null;
  return row.daily_token_limit;
}

export function setUserDailyTokenLimit(userId: number, limit: number | null): void {
  const normalized = limit == null || limit <= 0 ? null : Math.floor(limit);
  const updated = db
    .prepare(
      `UPDATE user_ai_settings
       SET daily_token_limit = ?, updated_at = datetime('now', 'localtime')
       WHERE user_id = ?`
    )
    .run(normalized, userId);

  if (updated.changes > 0) return;

  db.prepare(
    `INSERT INTO user_ai_settings (
       user_id, provider, preset, api_key, base_url,
       vision_model, text_model, structure_model, ocr_engine, daily_token_limit, updated_at
     ) VALUES (
       ?, 'dashscope', 'dashscope', '', 'https://dashscope.aliyuncs.com/compatible-mode/v1',
       'qwen-vl-plus', 'qwen-turbo', 'qwen-vl-plus', 'auto', ?, datetime('now', 'localtime')
     )`
  ).run(userId, normalized);
}

export function getTokenUsageBudget(userId: number): TokenUsageBudget {
  const today = getTodayTokenUsage(userId);
  const dailyTokenLimit = getUserDailyTokenLimit(userId);
  const limitReached =
    dailyTokenLimit != null && today.totalTokens >= dailyTokenLimit;
  return {
    dailyTokenLimit,
    todayPromptTokens: today.promptTokens,
    todayCompletionTokens: today.completionTokens,
    todayTotalTokens: today.totalTokens,
    limitReached,
  };
}

export function checkTokenBudget(userId: number): void {
  const budget = getTokenUsageBudget(userId);
  if (!budget.dailyTokenLimit || !budget.limitReached) return;
  const limitLabel =
    budget.dailyTokenLimit >= 1000
      ? `${budget.dailyTokenLimit % 1000 === 0 ? budget.dailyTokenLimit / 1000 : (budget.dailyTokenLimit / 1000).toFixed(1)}k`
      : String(budget.dailyTokenLimit);
  throw new Error(
    `今日 Token 用量已达上限（${limitLabel}），请在「Token 消耗」调整限额或明日再试`
  );
}

export function logAiUsage(input: UsageLogInput): void {
  const prompt = Math.max(0, Math.floor(input.promptTokens));
  const completion = Math.max(0, Math.floor(input.completionTokens));
  if (prompt === 0 && completion === 0) return;

  db.prepare(
    `INSERT INTO ai_usage_logs (
       user_id, provider, model, feature, prompt_tokens, completion_tokens
     ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.userId,
    input.provider,
    input.model,
    input.feature,
    prompt,
    completion
  );
}

export function getTokenUsageReport(
  userId: number,
  fromRaw: string,
  toRaw: string
): TokenUsageReport {
  const from = parseDateOnly(fromRaw);
  const to = parseDateOnly(toRaw);
  if (!from || !to) {
    throw new Error('日期格式无效，请使用 YYYY-MM-DD');
  }
  if (from > to) {
    throw new Error('开始日期不能晚于结束日期');
  }
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw new Error(`查询区间不能超过 ${MAX_RANGE_DAYS} 天`);
  }

  const summaryRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens
       FROM ai_usage_logs
       WHERE user_id = ?
         AND date(created_at) >= date(?)
         AND date(created_at) <= date(?)`
    )
    .get(userId, from, to) as { prompt_tokens: number; completion_tokens: number };

  const byModel = db
    .prepare(
      `SELECT
         provider,
         model,
         SUM(prompt_tokens) AS prompt_tokens,
         SUM(completion_tokens) AS completion_tokens,
         COUNT(*) AS call_count
       FROM ai_usage_logs
       WHERE user_id = ?
         AND date(created_at) >= date(?)
         AND date(created_at) <= date(?)
       GROUP BY provider, model
       ORDER BY (SUM(prompt_tokens) + SUM(completion_tokens)) DESC, call_count DESC`
    )
    .all(userId, from, to) as Array<{
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    call_count: number;
  }>;

  return {
    budget: getTokenUsageBudget(userId),
    summary: {
      promptTokens: summaryRow.prompt_tokens,
      completionTokens: summaryRow.completion_tokens,
    },
    byModel: byModel.map((row) => ({
      provider: row.provider,
      model: row.model,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      callCount: row.call_count,
    })),
  };
}
