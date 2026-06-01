const HEIC_PATTERN = /\.heic$/i;
const HEIC_MIME = /^image\/hei[cf]$/i;

export function isHeicFile(file: File): boolean {
  if (file.type && HEIC_MIME.test(file.type)) return true;
  return HEIC_PATTERN.test(file.name);
}

export function revokePreviewUrl(url: string | null): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export async function loadImagePreview(
  file: File,
  previewApi: (file: File) => Promise<{ previewDataUrl: string }>
): Promise<string> {
  if (isHeicFile(file)) {
    const { previewDataUrl } = await previewApi(file);
    return previewDataUrl;
  }

  return URL.createObjectURL(file);
}
