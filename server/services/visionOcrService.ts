import type { ParsedWord } from '../types.js';
import { parseWordsFromText } from './wordParser.js';
import { scoreParsedWords } from './wordExtractor.js';

export type VisionProvider = 'dashscope' | 'openai';

const POS_ONLY_LINE = /^(?:n|v|a|adj|adv|vt|vi)\.\s*[\u4e00-\u9fff]/i;
const ENGLISH_WORD = /\b[a-z][a-z\-']{1,23}\b/i;

const VOCAB_PROMPT =
  '这是一张英语单词学习笔记图片。每行只有「英文单词 + 中文释义」，例如：apple 苹果、foreigner 外国人。' +
  '不要输出词性（n. v. a. 等），不要编号，不要 markdown，不要编造。' +
  '逐行输出，格式：english 中文';

const STRUCTURE_PROMPT =
  '这是英语单词表图片。每行只有英文单词和中文释义，不含词性。' +
  '提取 english 和 chinese，多个中文释义用顿号连接。' +
  '不要词性，不要编号，不要编造。' +
  '严格只输出 JSON 数组，不要 markdown，不要解释：' +
  '[{"english":"apple","chinese":"苹果"},{"english":"foreigner","chinese":"外国人"}]';

interface VisionConfig {
  provider: VisionProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function resolveVisionConfig(): VisionConfig | null {
  if (process.env.DASHSCOPE_API_KEY) {
    return {
      provider: 'dashscope',
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl:
        process.env.DASHSCOPE_BASE_URL ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-plus',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    };
  }

  return null;
}

function resolveStructureModel(provider: VisionProvider): string {
  if (provider === 'dashscope') {
    return process.env.DASHSCOPE_STRUCTURE_MODEL || 'qwen-vl-plus';
  }
  return process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
}

function isValidEnglishWord(word: string): boolean {
  const normalized = word.trim().toLowerCase();
  if (normalized.length < 2) return false;
  if (/^(?:n|v|a|adj|adv|vt|vi|prep|conj|pron)\.?$/i.test(normalized)) return false;
  return /^[a-z][a-z\-']*$/.test(normalized);
}

function parseVisionVocabResponse(text: string): ParsedWord[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const items = JSON.parse(jsonMatch[0]) as Array<{ english?: string; chinese?: string }>;
      if (Array.isArray(items)) {
        const results: ParsedWord[] = [];
        const seen = new Set<string>();
        for (const item of items) {
          const english = String(item.english ?? '')
            .trim()
            .toLowerCase();
          const chinese = String(item.chinese ?? '').trim();
          if (!isValidEnglishWord(english) || !chinese) continue;
          if (seen.has(english)) continue;
          seen.add(english);
          results.push({ english, chinese });
        }
        if (results.length > 0) return results;
      }
    } catch {
      // fall through to text parser
    }
  }

  return parseWordsFromText(text);
}

function looksLikePosOnlyResult(text: string, parsed: ParsedWord[]): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return false;

  const validEnglishCount = parsed.filter((word) => isValidEnglishWord(word.english)).length;
  if (parsed.length > 0 && validEnglishCount >= Math.ceil(parsed.length * 0.6)) {
    return false;
  }

  const posOnlyLines = lines.filter(
    (line) => POS_ONLY_LINE.test(line) && !ENGLISH_WORD.test(line)
  ).length;

  return posOnlyLines >= Math.max(2, Math.ceil(lines.length * 0.5));
}

export function isVisionOcrAvailable(): boolean {
  return resolveVisionConfig() !== null;
}

export function getVisionProvider(): VisionProvider | null {
  return resolveVisionConfig()?.provider ?? null;
}

async function callVisionModel(
  buffer: Buffer,
  mimeType: string,
  model: string,
  prompt: string,
  provider: VisionProvider
): Promise<string> {
  const base64 = buffer.toString('base64');
  const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const config = resolveVisionConfig();
  if (!config) {
    throw new Error('未配置 DASHSCOPE_API_KEY 或 OPENAI_API_KEY');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${base64}` },
    },
    { type: 'text', text: prompt },
  ];

  if (provider === 'dashscope') {
    userContent[0].min_pixels = 3072;
    userContent[0].max_pixels = 8388608;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vision OCR 失败: ${err.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function ocrWithVision(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; parsed: ParsedWord[]; provider: VisionProvider }> {
  const config = resolveVisionConfig();
  if (!config) {
    throw new Error('未配置 DASHSCOPE_API_KEY 或 OPENAI_API_KEY');
  }

  let text = await callVisionModel(
    buffer,
    mimeType,
    config.model,
    config.provider === 'openai' ? STRUCTURE_PROMPT : VOCAB_PROMPT,
    config.provider
  );
  let parsed = parseVisionVocabResponse(text);

  const shouldRetry =
    looksLikePosOnlyResult(text, parsed) ||
    (parsed.length === 0 && text.length > 0);

  if (shouldRetry) {
    const structureModel = resolveStructureModel(config.provider);
    if (structureModel !== config.model || config.provider === 'openai') {
      try {
        const retryText = await callVisionModel(
          buffer,
          mimeType,
          structureModel,
          STRUCTURE_PROMPT,
          config.provider
        );
        const retryParsed = parseVisionVocabResponse(retryText);
        if (scoreParsedWords(retryParsed) > scoreParsedWords(parsed)) {
          text = retryText;
          parsed = retryParsed;
        }
      } catch {
        // keep first pass result
      }
    }
  }

  return { text, parsed, provider: config.provider };
}
