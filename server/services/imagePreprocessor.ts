import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

const HEIC_PATTERN = /\.heic$/i;
const HEIC_MIME = /^image\/hei[cf]$/i;
const MIN_OCR_WIDTH = 2000;
const MAX_OCR_DIMENSION = 3200;
const OCR_THRESHOLD = 155;

export function isHeicFile(mimeType?: string, filename?: string): boolean {
  if (mimeType && HEIC_MIME.test(mimeType)) return true;
  if (filename && HEIC_PATTERN.test(filename)) return true;
  return false;
}

async function loadSharp() {
  const mod = await import('sharp');
  return mod.default ?? mod;
}

async function convertHeicWithSips(buffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const input = path.join(tmpDir, `${randomUUID()}.heic`);
  const output = path.join(tmpDir, `${randomUUID()}.jpeg`);
  try {
    await fs.writeFile(input, buffer);
    await execFileAsync('sips', ['-s', 'format', 'jpeg', input, '--out', output]);
    return await fs.readFile(output);
  } finally {
    await fs.unlink(input).catch(() => {});
    await fs.unlink(output).catch(() => {});
  }
}

async function convertHeicWithHeifConvert(buffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const input = path.join(tmpDir, `${randomUUID()}.heic`);
  const output = path.join(tmpDir, `${randomUUID()}.jpg`);
  try {
    await fs.writeFile(input, buffer);
    await execFileAsync('heif-convert', [input, output]);
    return await fs.readFile(output);
  } finally {
    await fs.unlink(input).catch(() => {});
    await fs.unlink(output).catch(() => {});
  }
}

async function convertHeicWithDecode(buffer: Buffer): Promise<Buffer> {
  const heicDecode = await import('heic-decode');
  const decoder = heicDecode.default ?? heicDecode;
  const { width, height, data } = await decoder({ buffer: new Uint8Array(buffer) });
  const sharpFn = await loadSharp();
  return sharpFn(data, { raw: { width, height, channels: 4 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function decodeInputBuffer(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<Buffer> {
  if (!isHeicFile(mimeType, filename)) {
    return buffer;
  }

  if (process.platform === 'darwin') {
    return convertHeicWithSips(buffer);
  }

  try {
    return await convertHeicWithHeifConvert(buffer);
  } catch {
    try {
      return await convertHeicWithDecode(buffer);
    } catch {
      const sharpFn = await loadSharp();
      return sharpFn(buffer).jpeg().toBuffer();
    }
  }
}

async function resizeForOcr(input: Buffer) {
  const sharpFn = await loadSharp();
  const info = await sharpFn(input).metadata();
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  let pipeline = sharpFn(input);

  if (width > 0 && width < MIN_OCR_WIDTH) {
    const scale = MIN_OCR_WIDTH / width;
    pipeline = pipeline.resize({
      width: MIN_OCR_WIDTH,
      height: Math.max(1, Math.round(height * scale)),
      kernel: 'lanczos3',
    });
  } else if (
    width > 0 &&
    height > 0 &&
    (width > MAX_OCR_DIMENSION || height > MAX_OCR_DIMENSION)
  ) {
    pipeline = pipeline.resize(MAX_OCR_DIMENSION, MAX_OCR_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  return pipeline;
}

async function enhanceForTesseract(input: Buffer): Promise<Buffer> {
  const resized = await resizeForOcr(input);
  return resized
    .greyscale()
    .normalize()
    .sharpen({ sigma: 0.8 })
    .threshold(OCR_THRESHOLD)
    .png()
    .toBuffer();
}

async function enhanceForPreview(input: Buffer): Promise<Buffer> {
  const resized = await resizeForOcr(input);
  return resized.jpeg({ quality: 88 }).toBuffer();
}

export async function preprocessForOcr(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<Buffer> {
  const decoded = await decodeInputBuffer(buffer, mimeType, filename);

  try {
    return await enhanceForTesseract(decoded);
  } catch (err) {
    console.error('OCR preprocess failed, using resized fallback:', err);
    try {
      const resized = await resizeForOcr(decoded);
      return resized.png().toBuffer();
    } catch {
      return decoded;
    }
  }
}

/** Color resize for cloud vision OCR (no binarization). */
export async function preprocessForVision(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const decoded = await decodeInputBuffer(buffer, mimeType, filename);

  try {
    const processed = await enhanceForPreview(decoded);
    return { buffer: processed, mimeType: 'image/jpeg' };
  } catch {
    return {
      buffer: decoded,
      mimeType: mimeType?.startsWith('image/') ? mimeType : 'image/jpeg',
    };
  }
}

export async function createPreviewDataUrl(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<string> {
  const decoded = await decodeInputBuffer(buffer, mimeType, filename);
  let processed: Buffer;

  try {
    processed = await enhanceForPreview(decoded);
  } catch {
    processed = decoded;
  }

  return `data:image/jpeg;base64,${processed.toString('base64')}`;
}
