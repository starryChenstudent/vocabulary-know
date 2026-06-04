import type { ParsedWord } from '../types.js';
import { parseWordsFromText } from './wordParser.js';
import { scoreParsedWords } from './wordExtractor.js';
import {
  getVisionConfig,
  getVisionRuntimeProvider,
  getActiveProviderPreset,
  isVisionOcrAvailable,
  type AiProviderPreset,
  type VisionRuntimeProvider,
} from './aiConfigService.js';
import { completeChat } from './aiGateway.js';

export type VisionProvider = VisionRuntimeProvider;

const POS_ONLY_LINE = /^(?:n|v|a|adj|adv|vt|vi)\.\s*[\u4e00-\u9fff]/i;
const ENGLISH_WORD = /\b[a-z][a-z\-']{1,23}\b/i;

const VOCAB_PROMPT =
  '请识别图片中的词汇/笔记内容，按阅读顺序逐行输出可见文字。' +
  '常见格式如「英文单词 词性. 中文释义」（例：foreigner n. 外国人），若原文含词性缩写（n. v. a. 等）请保留。' +
  '忠实还原原文，保留原有分隔方式；不要自行添加编号、markdown 或编造；看不清处用 ? 占位。';

const STRUCTURE_PROMPT =
  '请从图片中提取词汇条目。常见为「英文单词 + 词性 + 中文释义」，词性仅作参考。' +
  '输出时 english 只填单词，chinese 只填释义（去掉 n./v./a. 等词性标记，多个释义用逗号或分号连接）。' +
  '不要编号或编造。严格只输出 JSON 数组，不要 markdown 或解释：' +
  '[{"english":"...","chinese":"..."}]';

function normalizeEnglishEntry(word: string): string {
  return word.trim().toLowerCase();
}

function isValidEnglishEntry(word: string): boolean {
  const normalized = normalizeEnglishEntry(word);
  if (normalized.length < 2) return false;
  if (/^(?:n|v|a|adj|adv|vt|vi|prep|conj|pron)\.?$/i.test(normalized)) return false;
  return /^[a-z][a-z0-9 \-'']*$/i.test(normalized) && /[a-z]/.test(normalized);
}

function pickJsonField(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function parseVisionVocabResponse(text: string): ParsedWord[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const items = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      if (Array.isArray(items)) {
        const results: ParsedWord[] = [];
        const seen = new Set<string>();
        for (const item of items) {
          const english = normalizeEnglishEntry(
            pickJsonField(item, ['english', 'word', 'term', 'en', 'foreign', 'src'])
          );
          const chinese = pickJsonField(item, [
            'chinese',
            'meaning',
            'definition',
            'translation',
            'cn',
            'target',
            '释义',
          ]);
          if (!isValidEnglishEntry(english) || !chinese) continue;
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
  if (parsed.length >= 2) return false;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return false;

  const validEnglishCount = parsed.filter((word) => isValidEnglishEntry(word.english)).length;
  if (parsed.length > 0 && validEnglishCount >= Math.ceil(parsed.length * 0.5)) {
    return false;
  }

  const posOnlyLines = lines.filter(
    (line) => POS_ONLY_LINE.test(line) && !ENGLISH_WORD.test(line)
  ).length;

  return posOnlyLines >= Math.max(2, Math.ceil(lines.length * 0.5));
}

function buildVisionUserMessage(
  provider: VisionProvider,
  model: string,
  mediaType: string,
  base64: string,
  prompt: string
): { role: 'user'; content: Array<Record<string, unknown>> } {
  const textPart = { type: 'text', text: prompt };
  const imagePart: Record<string, unknown> = {
    type: 'image_url',
    image_url: { url: `data:${mediaType};base64,${base64}` },
  };

  if (provider === 'dashscope') {
    imagePart.min_pixels = 3072;
    imagePart.max_pixels = 8388608;
  }

  const content =
    provider === 'dashscope' && /qwen-vl-ocr/i.test(model)
      ? [imagePart, textPart]
      : [textPart, imagePart];

  return { role: 'user', content };
}

export { isVisionOcrAvailable };

export function getVisionProvider(userId: number): VisionProvider | null {
  return getVisionRuntimeProvider(userId);
}

async function callVisionModel(
  userId: number,
  buffer: Buffer,
  mimeType: string,
  model: string,
  prompt: string,
  provider: VisionProvider
): Promise<{ content: string; promptTokens: number; completionTokens: number; totalTokens: number }> {
  if (!buffer.length) {
    throw new Error('图片为空，无法识别');
  }

  const base64 = buffer.toString('base64');
  const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const config = getVisionConfig(userId);
  if (!config) {
    throw new Error('未配置视觉 API Key，请在「模型服务」页面填写你的 API Key');
  }

  const userMessage = buildVisionUserMessage(provider, model, mediaType, base64, prompt);
  const preset = getActiveProviderPreset(userId);

  try {
    const result = await completeChat({
      userId,
      feature: 'ocr',
      preset,
      provider: config.runtimeProvider === 'dashscope' ? 'dashscope' : 'openai_compatible',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model,
      messages: [userMessage],
      temperature: 0,
    });
    return {
      content: result.content,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Vision OCR 失败: ${message}`);
  }
}

export async function ocrWithVision(
  userId: number,
  buffer: Buffer,
  mimeType: string
): Promise<{
  text: string;
  parsed: ParsedWord[];
  provider: VisionProvider;
  preset: AiProviderPreset;
  model: string;
  totalTokens: number;
}> {
  const config = getVisionConfig(userId);
  if (!config) {
    throw new Error('未配置视觉 API Key，请在「模型服务」页面填写你的 API Key');
  }

  const provider = config.runtimeProvider;
  const preset = getActiveProviderPreset(userId);
  let totalTokens = 0;
  let modelUsed = config.visionModel;

  const firstPass = await callVisionModel(
    userId,
    buffer,
    mimeType,
    config.visionModel,
    VOCAB_PROMPT,
    provider
  );
  totalTokens += firstPass.totalTokens;
  let text = firstPass.content;
  let parsed = parseVisionVocabResponse(text);

  const shouldRetry =
    looksLikePosOnlyResult(text, parsed) ||
    (parsed.length === 0 && text.length > 0);

  if (shouldRetry) {
    const structureModel = config.structureModel;
    if (structureModel !== config.visionModel || provider === 'openai') {
      try {
        const retryPass = await callVisionModel(
          userId,
          buffer,
          mimeType,
          structureModel,
          STRUCTURE_PROMPT,
          provider
        );
        totalTokens += retryPass.totalTokens;
        const retryParsed = parseVisionVocabResponse(retryPass.content);
        if (scoreParsedWords(retryParsed) > scoreParsedWords(parsed)) {
          text = retryPass.content;
          parsed = retryParsed;
          modelUsed = structureModel;
        }
      } catch {
        // keep first pass result
      }
    }
  }

  return { text, parsed, provider, preset, model: modelUsed, totalTokens };
}
