import db from '../db.js';
import type { Word } from '../types.js';
import type { TestMode } from '../types.js';
import { isVisionOcrAvailable, resolveLlmConfig } from './aiConfigService.js';

export type TranslateDirection = TestMode;

export interface TranslateResult {
  direction: TranslateDirection;
  input: string;
  vocabularyMatches: Word[];
  translation: string | null;
  english: string | null;
  chinese: string | null;
  source: 'vocabulary' | 'llm' | 'none';
  llmAvailable: boolean;
}

export function isTranslateLlmAvailable(userId: number): boolean {
  return isVisionOcrAvailable(userId);
}

export function searchWordsInBank(
  userId: number,
  query: string,
  direction: TranslateDirection
): Word[] {
  const q = query.trim();
  if (!q) return [];

  if (direction === 'en_to_cn') {
    return db
      .prepare(
        `SELECT id, english, chinese, created_at FROM words
         WHERE user_id = ? AND english LIKE ? COLLATE NOCASE
         ORDER BY CASE WHEN english = ? COLLATE NOCASE THEN 0 ELSE 1 END,
                  length(english) ASC
         LIMIT 10`
      )
      .all(userId, `%${q}%`, q) as Word[];
  }

  return db
    .prepare(
      `SELECT id, english, chinese, created_at FROM words
       WHERE user_id = ? AND chinese LIKE ?
       ORDER BY CASE WHEN chinese = ? THEN 0 ELSE 1 END,
                length(chinese) ASC
       LIMIT 10`
    )
    .all(userId, `%${q}%`, q) as Word[];
}

async function translateWithLlm(
  userId: number,
  text: string,
  direction: TranslateDirection
): Promise<string> {
  const config = resolveLlmConfig(userId);
  if (!config) {
    throw new Error('未配置 API Key，无法使用 AI 翻译（请在「模型服务」页面填写）');
  }

  const prompt =
    direction === 'en_to_cn'
      ? `将以下英文翻译为简洁的中文释义（词典风格，只输出中文，不要解释）：\n${text}`
      : `将以下中文翻译为对应的英文单词或短语（只输出英文，不要解释）：\n${text}`;

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.textModel,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`翻译失败: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function pickBestVocabularyMatch(
  matches: Word[],
  query: string,
  direction: TranslateDirection
): Word | null {
  if (matches.length === 0) return null;
  const normalized = query.trim().toLowerCase();
  const exact = matches.find((w) =>
    direction === 'en_to_cn'
      ? w.english.toLowerCase() === normalized
      : w.chinese === query.trim()
  );
  return exact ?? matches[0];
}

export async function translateText(
  userId: number,
  text: string,
  direction: TranslateDirection
): Promise<TranslateResult> {
  const input = text.trim();
  if (!input) {
    throw new Error('请输入要转换的内容');
  }

  const vocabularyMatches = searchWordsInBank(userId, input, direction);
  const bestMatch = pickBestVocabularyMatch(vocabularyMatches, input, direction);
  const llmAvailable = isTranslateLlmAvailable(userId);

  if (bestMatch) {
    return {
      direction,
      input,
      vocabularyMatches,
      translation: direction === 'en_to_cn' ? bestMatch.chinese : bestMatch.english,
      english: bestMatch.english,
      chinese: bestMatch.chinese,
      source: 'vocabulary',
      llmAvailable,
    };
  }

  if (!llmAvailable) {
    return {
      direction,
      input,
      vocabularyMatches,
      translation: null,
      english: direction === 'en_to_cn' ? input : null,
      chinese: direction === 'cn_to_en' ? input : null,
      source: 'none',
      llmAvailable: false,
    };
  }

  const translation = await translateWithLlm(userId, input, direction);
  return {
    direction,
    input,
    vocabularyMatches,
    translation,
    english: direction === 'en_to_cn' ? input : translation,
    chinese: direction === 'en_to_cn' ? translation : input,
    source: 'llm',
    llmAvailable: true,
  };
}
