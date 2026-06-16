export type AiProviderPreset = 'dashscope' | 'deepseek' | 'openai' | 'moonshot' | 'aliyun_token_plan' | 'custom';
export type ModelCapability = 'ocr' | 'multimodal' | 'text';
export type ModelSource = 'builtin' | 'api';

export interface ProviderModelEntry {
  id: string;
  capability: ModelCapability;
  source: ModelSource;
}

export interface ProviderModelsResult {
  preset: AiProviderPreset;
  visionSupported: boolean;
  visionModels: ProviderModelEntry[];
  textModels: ProviderModelEntry[];
  fetchedFromApi: boolean;
}

interface BuiltinModel {
  id: string;
  capability: ModelCapability;
}

const BUILTIN: Record<
  AiProviderPreset,
  { vision: BuiltinModel[]; text: BuiltinModel[]; visionSupported: boolean }
> = {
  dashscope: {
    visionSupported: true,
    vision: [
      { id: 'qwen-vl-ocr', capability: 'ocr' },
      { id: 'qwen-vl-ocr-latest', capability: 'ocr' },
      { id: 'qwen-vl-ocr-2025-11-20', capability: 'ocr' },
      { id: 'qwen3-vl-flash', capability: 'multimodal' },
      { id: 'qwen3-vl-plus', capability: 'multimodal' },
      { id: 'qwen-vl-max', capability: 'multimodal' },
      { id: 'qwen-vl-plus', capability: 'multimodal' },
      { id: 'qwen2.5-vl-72b-instruct', capability: 'multimodal' },
      { id: 'qwen2.5-vl-7b-instruct', capability: 'multimodal' },
    ],
    text: [
      { id: 'qwen-turbo', capability: 'text' },
      { id: 'qwen-plus', capability: 'text' },
      { id: 'qwen-max', capability: 'text' },
      { id: 'qwen3.6-flash', capability: 'text' },
    ],
  },
  aliyun_token_plan: {
    visionSupported: true,
    vision: [
      { id: 'qwen-vl-ocr', capability: 'ocr' },
      { id: 'qwen-vl-ocr-latest', capability: 'ocr' },
      { id: 'qwen-vl-ocr-2025-11-20', capability: 'ocr' },
      { id: 'qwen3-vl-flash', capability: 'multimodal' },
      { id: 'qwen3-vl-plus', capability: 'multimodal' },
      { id: 'qwen-vl-max', capability: 'multimodal' },
      { id: 'qwen-vl-plus', capability: 'multimodal' },
      { id: 'qwen2.5-vl-72b-instruct', capability: 'multimodal' },
      { id: 'qwen2.5-vl-7b-instruct', capability: 'multimodal' },
    ],
    text: [
      { id: 'qwen-turbo', capability: 'text' },
      { id: 'qwen-plus', capability: 'text' },
      { id: 'qwen-max', capability: 'text' },
      { id: 'qwen3.6-flash', capability: 'text' },
    ],
  },
  openai: {
    visionSupported: true,
    vision: [
      { id: 'gpt-4o', capability: 'multimodal' },
      { id: 'gpt-4o-mini', capability: 'multimodal' },
      { id: 'gpt-4.1', capability: 'multimodal' },
      { id: 'gpt-4.1-mini', capability: 'multimodal' },
      { id: 'gpt-4-turbo', capability: 'multimodal' },
    ],
    text: [
      { id: 'gpt-4o-mini', capability: 'text' },
      { id: 'gpt-4o', capability: 'text' },
      { id: 'gpt-4.1-mini', capability: 'text' },
      { id: 'o1-mini', capability: 'text' },
    ],
  },
  moonshot: {
    visionSupported: true,
    vision: [
      { id: 'moonshot-v1-8k-vision-preview', capability: 'multimodal' },
      { id: 'moonshot-v1-32k-vision-preview', capability: 'multimodal' },
      { id: 'moonshot-v1-128k-vision-preview', capability: 'multimodal' },
      { id: 'kimi-k2.5', capability: 'multimodal' },
    ],
    text: [
      { id: 'moonshot-v1-8k', capability: 'text' },
      { id: 'moonshot-v1-32k', capability: 'text' },
      { id: 'moonshot-v1-128k', capability: 'text' },
    ],
  },
  deepseek: {
    visionSupported: false,
    vision: [],
    text: [
      { id: 'deepseek-chat', capability: 'text' },
      { id: 'deepseek-reasoner', capability: 'text' },
      { id: 'deepseek-v4-flash', capability: 'text' },
      { id: 'deepseek-v4-pro', capability: 'text' },
    ],
  },
  custom: {
    visionSupported: true,
    vision: [
      { id: 'gpt-4o-mini', capability: 'multimodal' },
      { id: 'gpt-4o', capability: 'multimodal' },
    ],
    text: [{ id: 'gpt-4o-mini', capability: 'text' }],
  },
};

const VISION_ID_PATTERNS = [
  /qwen-vl-ocr/i,
  /qwen[\d.]*-vl/i,
  /qwen-vl/i,
  /gpt-4o/i,
  /gpt-4\.1/i,
  /gpt-4-turbo/i,
  /gpt-4-vision/i,
  /moonshot-v1-\d+k-vision/i,
  /kimi-k2/i,
  /gemini-.*-(pro|flash|vision)/i,
  /claude-.*-(sonnet|opus|haiku)/i,
];

const OCR_ID_PATTERNS = [/ocr/i, /qwen-vl-ocr/i];

const TEXT_ONLY_BLOCKLIST = [
  /^deepseek-/i,
  /^text-embedding/i,
  /^tts-/i,
  /^whisper/i,
  /^dall-e/i,
];

export function presetSupportsVisionOcr(preset: AiProviderPreset): boolean {
  return BUILTIN[preset]?.visionSupported ?? false;
}

/** Models that require image input in chat/completions (OCR / VL). */
export function modelRequiresVisionInput(model: string): boolean {
  return /qwen-vl-ocr|qwen[\d.]*-vl|qwen-vl|gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|moonshot-v1-\d+k-vision|kimi-k2/i.test(
    model.trim()
  );
}

export function defaultVisionModel(preset: AiProviderPreset): string {
  const vision = BUILTIN[preset]?.vision ?? [];
  const ocr = vision.find((m) => m.capability === 'ocr');
  if (ocr) return ocr.id;
  return vision[0]?.id ?? '';
}

export function defaultTextModel(preset: AiProviderPreset): string {
  return BUILTIN[preset]?.text[0]?.id ?? '';
}

function classifyModelId(id: string, preset: AiProviderPreset): ModelCapability | null {
  const normalized = id.trim();
  if (!normalized) return null;
  if (TEXT_ONLY_BLOCKLIST.some((re) => re.test(normalized))) {
    if (preset === 'deepseek') return 'text';
    if (preset !== 'custom') return null;
  }
  if (OCR_ID_PATTERNS.some((re) => re.test(normalized))) return 'ocr';
  if (VISION_ID_PATTERNS.some((re) => re.test(normalized))) {
    return OCR_ID_PATTERNS.some((re) => re.test(normalized)) ? 'ocr' : 'multimodal';
  }
  if (preset === 'custom') return 'text';
  return 'text';
}

function mergeModels(
  builtin: BuiltinModel[],
  apiIds: string[],
  preset: AiProviderPreset,
  kind: 'vision' | 'text'
): ProviderModelEntry[] {
  const map = new Map<string, ProviderModelEntry>();

  for (const item of builtin) {
    map.set(item.id, { id: item.id, capability: item.capability, source: 'builtin' });
  }

  for (const id of apiIds) {
    const capability = classifyModelId(id, preset);
    if (!capability) continue;
    if (kind === 'vision' && capability === 'text') continue;
    if (kind === 'text' && capability !== 'text') continue;
    if (!map.has(id)) {
      map.set(id, { id, capability, source: 'api' });
    }
  }

  const order = { ocr: 0, multimodal: 1, text: 2 };
  return [...map.values()].sort((a, b) => {
    const cap = order[a.capability] - order[b.capability];
    if (cap !== 0) return cap;
    if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

async function fetchRemoteModelIds(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  if (!Array.isArray(data.data)) return [];
  return data.data.map((item) => item.id?.trim() ?? '').filter(Boolean);
}

export interface ListProviderModelsInput {
  preset: AiProviderPreset;
  baseUrl?: string;
  apiKey?: string;
  storedApiKey?: string;
  storedBaseUrl?: string;
}

export async function listProviderModels(
  input: ListProviderModelsInput
): Promise<ProviderModelsResult> {
  const catalog = BUILTIN[input.preset] ?? BUILTIN.custom;
  const baseUrl = (input.baseUrl ?? input.storedBaseUrl ?? '').trim();
  const apiKey = (input.apiKey?.trim() || input.storedApiKey?.trim() || '').trim();

  let apiIds: string[] = [];
  let fetchedFromApi = false;
  if (apiKey && baseUrl) {
    try {
      apiIds = await fetchRemoteModelIds(baseUrl, apiKey);
      fetchedFromApi = apiIds.length > 0;
    } catch {
      fetchedFromApi = false;
    }
  }

  const allApiIds = apiIds;
  const visionModels = catalog.visionSupported
    ? mergeModels(catalog.vision, allApiIds, input.preset, 'vision')
    : [];
  const textModels = mergeModels(catalog.text, allApiIds, input.preset, 'text');

  return {
    preset: input.preset,
    visionSupported: catalog.visionSupported,
    visionModels,
    textModels,
    fetchedFromApi,
  };
}
