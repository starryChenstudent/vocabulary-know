/**
 * Compress and resize images before upload for faster OCR.
 * Mobile photos can be 5-12MB; this reduces them to ~200-500KB
 * while maintaining OCR quality.
 */

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB threshold

export function needsCompression(file: File): boolean {
  return file.size > MAX_FILE_SIZE || isHeicLike(file);
}

function isHeicLike(file: File): boolean {
  return (
    /^image\/hei[cf]$/i.test(file.type) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

export async function compressImage(file: File): Promise<File> {
  // HEIC always needs conversion via server, skip client compression
  if (isHeicLike(file)) return file;

  // Small files don't need compression
  if (file.size <= MAX_FILE_SIZE) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const ratio = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed'));
            return;
          }
          // Use .jpg extension to match the actual JPEG content
          const newName = file.name.replace(/\.\w+$/, '') + '.jpg';
          const compressed = new File([blob], newName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}
