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

export function isHeicFile(mimeType?: string, filename?: string): boolean {
  if (mimeType && HEIC_MIME.test(mimeType)) return true;
  if (filename && HEIC_PATTERN.test(filename)) return true;
  return false;
}

async function convertWithSips(buffer: Buffer, outExt: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const input = path.join(tmpDir, `${randomUUID()}.heic`);
  const output = path.join(tmpDir, `${randomUUID()}.${outExt}`);
  await fs.writeFile(input, buffer);
  await execFileAsync('sips', ['-s', 'format', outExt === 'png' ? 'png' : 'jpeg', input, '--out', output]);
  return output;
}

async function convertWithHeifConvert(buffer: Buffer): Promise<Buffer> {
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

async function getImageSize(filePath: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath]);
  const width = Number(stdout.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
  const height = Number(stdout.match(/pixelHeight: (\d+)/)?.[1] ?? 0);
  return { width, height };
}

async function upscaleWithSips(inputPath: string): Promise<string> {
  const { width, height } = await getImageSize(inputPath);
  if (width >= MIN_OCR_WIDTH) return inputPath;

  const scale = MIN_OCR_WIDTH / Math.max(width, 1);
  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);
  const output = path.join(os.tmpdir(), `${randomUUID()}.png`);
  await execFileAsync('sips', ['-z', String(newH), String(newW), inputPath, '--out', output]);
  return output;
}

async function prepareWithSips(buffer: Buffer, mimeType?: string, filename?: string): Promise<Buffer> {
  let filePath: string;
  if (isHeicFile(mimeType, filename)) {
    filePath = await convertWithSips(buffer, 'jpeg');
  } else {
    const ext = mimeType?.includes('png') ? 'png' : 'jpg';
    const tmp = path.join(os.tmpdir(), `${randomUUID()}.${ext}`);
    await fs.writeFile(tmp, buffer);
    filePath = tmp;
  }

  const upscaled = await upscaleWithSips(filePath);
  return fs.readFile(upscaled);
}

export async function preprocessForOcr(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<Buffer> {
  if (isHeicFile(mimeType, filename)) {
    if (process.platform === 'darwin') {
      return prepareWithSips(buffer, mimeType, filename);
    }
    // Linux: use sharp to convert HEIC to JPEG
    try {
      const sharpFn = await import('sharp').then(m => m.default || m);
      return await sharpFn(buffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .toFormat('jpeg')
        .toBuffer();
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      throw new Error(
        'HEIC 图片转换失败，请在 iPhone「设置→相机→格式」中改为「最兼容」后重拍，或先转为 JPG'
      );
    }
  }

  if (process.platform === 'darwin') {
    return prepareWithSips(buffer, mimeType, filename);
  }

  // Linux: use sharp to convert to PNG for tesseract.js compatibility
  try {
    const sharpFn = await import('sharp').then(m => m.default || m);
    return await sharpFn(buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .toFormat('png')
      .toBuffer();
  } catch {
    // fallback to original buffer if sharp fails
    return buffer;
  }
}

export async function createPreviewDataUrl(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<string> {
  const processed = await preprocessForOcr(buffer, mimeType, filename);
  const previewMime = isHeicFile(mimeType, filename)
    ? 'image/jpeg'
    : mimeType?.startsWith('image/')
      ? mimeType
      : 'image/jpeg';
  return `data:${previewMime};base64,${processed.toString('base64')}`;
}
