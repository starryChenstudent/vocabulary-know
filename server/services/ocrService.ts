import Tesseract from 'tesseract.js';
import fs from 'fs';
import { parseWordsFromText } from './wordParser.js';
import { preprocessForOcr, preprocessForVision, createPreviewDataUrl } from './imagePreprocessor.js';
import {
  mergeParsedWords,
  parseWordsAggressive,
  scoreParsedWords,
} from './wordExtractor.js';
import { ocrWithVision, isVisionOcrAvailable, getVisionProvider } from './visionOcrService.js';
import { resolveOcrEngineMode } from './aiConfigService.js';
import type { ImportResult, OcrUsageInfo, ParsedWord } from '../types.js';

interface OcrPass {
  lang: string;
  psm: string;
}

const TESSERACT_DEFAULT_LANG = 'eng+chi_sim';

/** Most effective passes first so early exit triggers sooner. */
const TESSERACT_PASSES: OcrPass[] = [
  { lang: 'eng+chi_sim', psm: '6' },
  { lang: 'eng+chi_sim', psm: '11' },
  { lang: 'eng+chi_sim', psm: '4' },
  { lang: 'eng', psm: '7' },
  { lang: 'chi_sim', psm: '7' },
];

const EARLY_EXIT_MIN_WORDS = 5;
const EARLY_EXIT_MIN_SCORE = 520;

async function setWorkerLanguage(
  worker: Tesseract.Worker,
  activeLang: { current: string },
  lang: string
): Promise<void> {
  if (activeLang.current === lang) return;
  await worker.reinitialize(lang, 1);
  activeLang.current = lang;
}

async function ocrWithTesseract(buffer: Buffer): Promise<{ text: string; parsed: ParsedWord[] }> {
  const worker = await Tesseract.createWorker(TESSERACT_DEFAULT_LANG, 1, { logger: () => {} });
  const activeLang = { current: TESSERACT_DEFAULT_LANG };
  const texts: string[] = [];
  let bestText = '';
  let bestParsed: ParsedWord[] = [];
  let bestScore = -1;

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });

    for (const pass of TESSERACT_PASSES) {
      try {
        await setWorkerLanguage(worker, activeLang, pass.lang);
        await worker.setParameters({
          tessedit_pageseg_mode: pass.psm as unknown as Tesseract.PSM,
        });

        const { data } = await worker.recognize(buffer);
        const text = data.text;
        texts.push(text);

        const parsed = mergeParsedWords(parseWordsFromText(text), parseWordsAggressive(text));
        const score = scoreParsedWords(parsed);
        if (score > bestScore) {
          bestScore = score;
          bestText = text;
          bestParsed = parsed;
        }

        if (bestParsed.length >= EARLY_EXIT_MIN_WORDS && bestScore >= EARLY_EXIT_MIN_SCORE) {
          break;
        }
      } catch {
        // try next pass
      }
    }
  } finally {
    await worker.terminate();
  }

  const mergedParsed = mergeParsedWords(
    bestParsed,
    ...texts.map((t) => parseWordsFromText(t)),
    ...texts.map((t) => parseWordsAggressive(t))
  );

  const mergedText = texts.filter(Boolean).join('\n\n---\n\n') || bestText;

  return {
    text: mergedText,
    parsed: mergedParsed.length > 0 ? mergedParsed : bestParsed,
  };
}

export async function ocrAndParseImage(
  userId: number,
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<ImportResult & { handwritingHint?: string }> {
  const previewPromise = createPreviewDataUrl(buffer, mimeType, filename);
  const mode = resolveOcrEngineMode(userId);
  const forceTesseract = mode === 'tesseract';
  const forceVision =
    mode === 'vision' || mode === 'dashscope' || mode === 'openai';
  const debugLog = (msg: string) => {
    const msgLine = `[OCR DEBUG] ${new Date().toISOString()} ${msg}`;
    console.log(msgLine);
    fs.appendFileSync('/tmp/ocr-debug.log', msgLine + '\n');
  };
  debugLog(`OCR mode: ${mode}`);

  let text = '';
  let parsed: ParsedWord[] = [];
  let ocrUsage: OcrUsageInfo | undefined;
  let handwritingHint: string | undefined;

  const tryVision =
    !forceTesseract &&
    (forceVision || (mode === 'auto' && isVisionOcrAvailable(userId)));

  debugLog(`Will try Vision OCR: ${tryVision}`);

  if (tryVision) {
    if (!isVisionOcrAvailable(userId)) {
      throw new Error('未配置 API Key，请在「模型服务」页面填写后使用 AI 识图');
    }
    try {
      const visionImage = await preprocessForVision(buffer, mimeType, filename);
      const vision = await ocrWithVision(userId, visionImage.buffer, visionImage.mimeType);
      text = vision.text;
      parsed = vision.parsed;
      ocrUsage = {
        preset: vision.preset,
        model: vision.model,
        totalTokens: vision.totalTokens,
      };

      if (
        parsed.length > 0 &&
        parsed.filter((word) => word.english.trim().length >= 2 && word.chinese.trim()).length <
          Math.ceil(parsed.length * 0.5)
      ) {
        handwritingHint =
          '识别结果可能不完整，请在预览中核对或手动补全后再导入。';
      }
    } catch (err) {
      const errLog = `[OCR ERROR] ${new Date().toISOString()} Vision OCR failed: ${JSON.stringify(err)}\n`;
      fs.appendFileSync('/tmp/ocr-debug.log', errLog);
      console.error('Vision OCR failed:', err);
      if (forceVision) throw err;
    }
  }

  if (!ocrUsage && !forceVision) {
    const tesseractBuffer = await preprocessForOcr(buffer, mimeType, filename);
    const tesseract = await ocrWithTesseract(tesseractBuffer);
    text = tesseract.text;
    parsed = tesseract.parsed;
    ocrUsage = {
      preset: 'tesseract',
      model: 'eng+chi_sim',
      totalTokens: 0,
    };

    if (parsed.length === 0 && !isVisionOcrAvailable(userId)) {
      handwritingHint =
        '当前使用本地 Tesseract 识别，手写笔记效果有限。建议：① 在「模型服务」配置 API Key 启用 AI 识图；② 使用打印体或粘贴文本；③ 识别后手动修正再导入。';
    } else if (parsed.length === 0 && getVisionProvider(userId)) {
      handwritingHint = 'AI 识别未提取到词条，请手动添加或修正后导入。';
    } else if (
      parsed.length > 0 &&
      parsed.filter((word) => word.english.trim().length >= 2 && word.chinese.trim()).length <
        Math.ceil(parsed.length * 0.5)
    ) {
      handwritingHint =
        '识别结果可能不完整，请在预览中核对或手动补全后再导入。';
    }
  }

  const previewDataUrl = await previewPromise;

  return {
    imported: 0,
    duplicates: 0,
    parsed,
    previewDataUrl,
    ocrUsage,
    handwritingHint,
  };
}

export async function createImagePreview(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<{ previewDataUrl: string }> {
  const previewDataUrl = await createPreviewDataUrl(buffer, mimeType, filename);
  return { previewDataUrl };
}

export function parseTextImport(text: string): ImportResult {
  const parsed = mergeParsedWords(parseWordsFromText(text), parseWordsAggressive(text));
  return {
    imported: 0,
    duplicates: 0,
    parsed,
  };
}
