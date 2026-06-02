import Tesseract from 'tesseract.js';
import fs from 'fs';
import { parseWordsFromText } from './wordParser.js';
import { preprocessForOcr, createPreviewDataUrl, isHeicFile } from './imagePreprocessor.js';
import {
  mergeParsedWords,
  parseWordsAggressive,
  scoreParsedWords,
} from './wordExtractor.js';
import { ocrWithVision, isVisionOcrAvailable, getVisionProvider } from './visionOcrService.js';
import type { ImportResult, ParsedWord } from '../types.js';

type OcrEngine = 'dashscope' | 'openai' | 'tesseract';

interface OcrPass {
  lang: string;
  psm: string;
}

const TESSERACT_PASSES: OcrPass[] = [
  { lang: 'eng+chi_sim', psm: '6' },
  { lang: 'eng+chi_sim', psm: '4' },
  { lang: 'eng', psm: '7' },
  { lang: 'chi_sim', psm: '7' },
  { lang: 'eng+chi_sim', psm: '11' },
];

async function runTesseractPass(buffer: Buffer, pass: OcrPass): Promise<string> {
  const worker = await Tesseract.createWorker(pass.lang, 1, { logger: () => {} });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: pass.psm as unknown as Tesseract.PSM,
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function ocrWithTesseract(buffer: Buffer): Promise<{ text: string; parsed: ParsedWord[] }> {
  const texts: string[] = [];
  let bestText = '';
  let bestParsed: ParsedWord[] = [];
  let bestScore = -1;

  for (const pass of TESSERACT_PASSES) {
    try {
      const text = await runTesseractPass(buffer, pass);
      texts.push(text);
      const parsed = mergeParsedWords(
        parseWordsFromText(text),
        parseWordsAggressive(text)
      );
      const score = scoreParsedWords(parsed);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
        bestParsed = parsed;
      }
    } catch {
      // try next pass
    }
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

function resolveEngine(): OcrEngine | 'auto' {
  const mode = process.env.OCR_ENGINE || 'auto';
  if (mode === 'vision' || mode === 'dashscope' || mode === 'openai' || mode === 'tesseract') {
    if (mode === 'vision') return 'auto';
    return mode;
  }
  return 'auto';
}

export async function ocrAndParseImage(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<ImportResult & { ocrEngine: OcrEngine; handwritingHint?: string }> {
  const imageBuffer = await preprocessForOcr(buffer, mimeType, filename);
  const previewDataUrl = `data:${
    mimeType && !isHeicFile(mimeType, filename) && mimeType.startsWith('image/')
      ? mimeType
      : 'image/jpeg'
  };base64,${imageBuffer.toString('base64')}`;
  const engine = resolveEngine();
  const debugLog = (msg: string) => {
    const msgLine = `[OCR DEBUG] ${new Date().toISOString()} ${msg}`;
    console.log(msgLine);
    fs.appendFileSync('/tmp/ocr-debug.log', msgLine + '\n');
  };
  debugLog(`Engine resolved to: ${engine}`);

  let text = '';
  let parsed: ParsedWord[] = [];
  let ocrEngine: OcrEngine = 'tesseract';
  let handwritingHint: string | undefined;

  const tryVision =
    engine === 'dashscope' ||
    engine === 'openai' ||
    (engine === 'auto' && isVisionOcrAvailable());
  
  debugLog(`Will try Vision OCR: ${tryVision}`);

  if (tryVision) {
    try {
      const vision = await ocrWithVision(imageBuffer, mimeType || 'image/jpeg');
      text = vision.text;
      parsed = vision.parsed;
      ocrEngine = vision.provider;

      if (
        parsed.length > 0 &&
        parsed.filter((word) => /^[a-z][a-z\-']{1,}$/i.test(word.english)).length <
          Math.ceil(parsed.length * 0.6)
      ) {
        handwritingHint =
          '英文单词识别不完整，请在预览中手动补全英文，或重新上传图片再试。';
      }
    } catch (err) {
      const errLog = `[OCR ERROR] ${new Date().toISOString()} Vision OCR failed: ${JSON.stringify(err)}\n`;
      fs.appendFileSync('/tmp/ocr-debug.log', errLog);
      console.error('Vision OCR failed (fallback to Tesseract):', err);
      if (engine === 'dashscope' || engine === 'openai') throw err;
    }
  }

  if (ocrEngine === 'tesseract') {
    const tesseract = await ocrWithTesseract(imageBuffer);
    text = tesseract.text;
    parsed = tesseract.parsed;

    if (parsed.length === 0 && !isVisionOcrAvailable()) {
      handwritingHint =
        '手写笔记识别率较低。建议：① 配置 DASHSCOPE_API_KEY 启用百炼 OCR；② 使用打印体或粘贴文本；③ 识别后在下方手动修正再导入。';
    } else if (parsed.length === 0 && getVisionProvider()) {
      handwritingHint = 'AI 识别未提取到词条，请查看原始文本或手动修正后导入。';
    } else if (
      parsed.length > 0 &&
      parsed.filter((word) => /^[a-z][a-z\-']{1,}$/i.test(word.english)).length <
        Math.ceil(parsed.length * 0.6)
    ) {
      handwritingHint =
        '识别结果可能缺少英文单词。建议：① 将 DASHSCOPE_VISION_MODEL 设为 qwen-vl-plus；② 重新上传或在下方手动补全英文。';
    }
  }

  return {
    imported: 0,
    duplicates: 0,
    parsed,
    rawText: text,
    previewDataUrl,
    ocrEngine,
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
    rawText: text,
  };
}
