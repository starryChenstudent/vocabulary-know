import db from '../db.js';
import {
  defaultTextModel,
  defaultVisionModel,
  listProviderModels,
  modelRequiresVisionInput,
  presetSupportsVisionOcr,
  type ProviderModelsResult,
} from './aiModelCatalog.js';

export type { ProviderModelsResult } from './aiModelCatalog.js';

export type AiProvider = 'dashscope' | 'openai_compatible';
export type AiProviderPreset = 'dashscope' | 'deepseek' | 'openai' | 'moonshot' | 'custom';
export type VisionRuntimeProvider = 'dashscope' | 'openai';
export type OcrEngineMode = 'auto' | 'vision' | 'tesseract' | 'dashscope' | 'openai';
export type ConfigSource = 'user' | 'none';

export interface StoredProviderConfig {
  preset: AiProviderPreset;
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
  structureModel: string;
}

export interface ConfiguredProviderSummary {
  preset: AiProviderPreset;
  provider: AiProvider;
  baseUrl: string;
  apiKeyMasked: string;
  textModel: string;
  visionModel: string;
  structureModel: string;
}

export interface UserAiPreferences {
  preset: AiProviderPreset;
  textModel: string;
  ocrEngine: OcrEngineMode;
}

export interface AiSettingsResponse {
  provider: AiProvider;
  preset: AiProviderPreset;
  baseUrl: string;
  visionModel: string;
  textModel: string;
  structureModel: string;
  ocrEngine: OcrEngineMode;
  apiKeyMasked: string;
  apiKeySet: boolean;
  source: ConfigSource;
  visionAvailable: boolean;
  translateAvailable: boolean;
  configuredProviders: ConfiguredProviderSummary[];
}

export interface AiSettingsUpdate {
  provider?: AiProvider;
  preset?: AiProviderPreset;
  apiKey?: string;
  baseUrl?: string;
  visionModel?: string;
  textModel?: string;
  structureModel?: string;
  ocrEngine?: OcrEngineMode;
  clearApiKey?: boolean;
}

export interface ResolvedLlmConfig {
  runtimeProvider: VisionRuntimeProvider;
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
  structureModel: string;
  source: ConfigSource;
}

const DEFAULTS: Record<
  AiProvider,
  Omit<StoredProviderConfig, 'preset' | 'apiKey'>
> = {
  dashscope: {
    provider: 'dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    visionModel: 'qwen-vl-ocr',
    textModel: 'qwen-turbo',
    structureModel: 'qwen-vl-ocr',
  },
  openai_compatible: {
    provider: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o-mini',
    textModel: 'gpt-4o-mini',
    structureModel: 'gpt-4o-mini',
  },
};

const PRESET_PROVIDER: Record<AiProviderPreset, AiProvider> = {
  dashscope: 'dashscope',
  deepseek: 'openai_compatible',
  openai: 'openai_compatible',
  moonshot: 'openai_compatible',
  custom: 'openai_compatible',
};

function inferPreset(stored: Partial<StoredProviderConfig & UserAiPreferences>): AiProviderPreset {
  if (
    stored.preset === 'dashscope' ||
    stored.preset === 'deepseek' ||
    stored.preset === 'openai' ||
    stored.preset === 'moonshot' ||
    stored.preset === 'custom'
  ) {
    return stored.preset;
  }
  const url = (stored.baseUrl ?? '').toLowerCase();
  if (stored.provider === 'dashscope' || url.includes('dashscope')) return 'dashscope';
  if (url.includes('deepseek')) return 'deepseek';
  if (url.includes('moonshot')) return 'moonshot';
  if (url.includes('openai.com')) return 'openai';
  return stored.provider === 'openai_compatible' ? 'custom' : 'dashscope';
}

function defaultProviderConfig(preset: AiProviderPreset): StoredProviderConfig {
  const provider = PRESET_PROVIDER[preset];
  const visionModel = defaultVisionModel(preset) || DEFAULTS[provider].visionModel;
  const textModel = defaultTextModel(preset) || DEFAULTS[provider].textModel;
  return {
    preset,
    provider,
    apiKey: '',
    baseUrl: DEFAULTS[provider].baseUrl,
    visionModel,
    textModel,
    structureModel: visionModel || DEFAULTS[provider].structureModel,
  };
}

function defaultPreferences(preset: AiProviderPreset = 'dashscope'): UserAiPreferences {
  const config = defaultProviderConfig(preset);
  return {
    preset,
    textModel: config.textModel,
    ocrEngine: 'auto',
  };
}

interface UserAiRow {
  user_id: number;
  provider: string;
  preset: string;
  api_key: string;
  base_url: string;
  vision_model: string;
  text_model: string;
  structure_model: string;
  ocr_engine: string;
}

interface ProviderConfigRow {
  user_id: number;
  preset: string;
  provider: string;
  api_key: string;
  base_url: string;
  vision_model: string;
  text_model: string;
  structure_model: string;
}

function rowToProviderConfig(row: ProviderConfigRow): StoredProviderConfig {
  const preset = inferPreset({ preset: row.preset as AiProviderPreset, provider: row.provider as AiProvider, baseUrl: row.base_url });
  const base = defaultProviderConfig(preset);
  return {
    preset,
    provider: row.provider === 'openai_compatible' ? 'openai_compatible' : 'dashscope',
    apiKey: row.api_key ?? '',
    baseUrl: row.base_url || base.baseUrl,
    visionModel: row.vision_model || base.visionModel,
    textModel: row.text_model || base.textModel,
    structureModel: row.structure_model || base.structureModel,
  };
}

function loadPreferences(userId: number): UserAiPreferences {
  const row = db
    .prepare('SELECT preset, text_model, ocr_engine FROM user_ai_settings WHERE user_id = ?')
    .get(userId) as Pick<UserAiRow, 'preset' | 'text_model' | 'ocr_engine'> | undefined;

  if (!row) return defaultPreferences();

  const preset = inferPreset({ preset: row.preset as AiProviderPreset });
  return {
    preset,
    textModel: row.text_model || defaultProviderConfig(preset).textModel,
    ocrEngine: (row.ocr_engine as OcrEngineMode) || 'auto',
  };
}

function savePreferences(userId: number, prefs: UserAiPreferences): void {
  const active = loadActiveProviderConfig(userId, prefs.preset);
  db.prepare(
    `INSERT INTO user_ai_settings (
       user_id, provider, preset, api_key, base_url,
       vision_model, text_model, structure_model, ocr_engine, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(user_id) DO UPDATE SET
       provider = excluded.provider,
       preset = excluded.preset,
       text_model = excluded.text_model,
       ocr_engine = excluded.ocr_engine,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    active?.provider ?? PRESET_PROVIDER[prefs.preset],
    prefs.preset,
    active?.apiKey ?? '',
    active?.baseUrl ?? defaultProviderConfig(prefs.preset).baseUrl,
    active?.visionModel ?? defaultProviderConfig(prefs.preset).visionModel,
    prefs.textModel,
    active?.structureModel ?? defaultProviderConfig(prefs.preset).structureModel,
    prefs.ocrEngine
  );
}

function loadProviderConfig(userId: number, preset: AiProviderPreset): StoredProviderConfig | null {
  const row = db
    .prepare('SELECT * FROM user_ai_provider_configs WHERE user_id = ? AND preset = ?')
    .get(userId, preset) as ProviderConfigRow | undefined;
  if (!row) return null;
  return rowToProviderConfig(row);
}

function loadConfiguredProviders(userId: number): StoredProviderConfig[] {
  const rows = db
    .prepare(
      `SELECT * FROM user_ai_provider_configs
       WHERE user_id = ? AND trim(api_key) != ''
       ORDER BY updated_at DESC`
    )
    .all(userId) as ProviderConfigRow[];
  return rows.map(rowToProviderConfig);
}

function loadActiveProviderConfig(
  userId: number,
  preset: AiProviderPreset
): StoredProviderConfig | null {
  return loadProviderConfig(userId, preset);
}

function saveProviderConfig(userId: number, config: StoredProviderConfig): void {
  db.prepare(
    `INSERT INTO user_ai_provider_configs (
       user_id, preset, provider, api_key, base_url,
       vision_model, text_model, structure_model, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(user_id, preset) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       base_url = excluded.base_url,
       vision_model = excluded.vision_model,
       text_model = excluded.text_model,
       structure_model = excluded.structure_model,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    config.preset,
    config.provider,
    config.apiKey,
    config.baseUrl,
    config.visionModel,
    config.textModel,
    config.structureModel
  );
}

function clearProviderConfig(userId: number, preset: AiProviderPreset): void {
  db.prepare('DELETE FROM user_ai_provider_configs WHERE user_id = ? AND preset = ?').run(
    userId,
    preset
  );
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-4)}`;
}

function toSummary(config: StoredProviderConfig): ConfiguredProviderSummary {
  return {
    preset: config.preset,
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKeyMasked: maskApiKey(config.apiKey),
    textModel: config.textModel,
    visionModel: config.visionModel,
    structureModel: config.structureModel,
  };
}

function resolveFromProviderConfig(config: StoredProviderConfig): ResolvedLlmConfig | null {
  const apiKey = config.apiKey.trim();
  if (!apiKey) return null;
  return {
    runtimeProvider: config.provider === 'dashscope' ? 'dashscope' : 'openai',
    apiKey,
    baseUrl: config.baseUrl.trim() || DEFAULTS[config.provider].baseUrl,
    visionModel: config.visionModel.trim() || DEFAULTS[config.provider].visionModel,
    textModel: config.textModel.trim() || DEFAULTS[config.provider].textModel,
    structureModel:
      config.structureModel.trim() || DEFAULTS[config.provider].structureModel,
    source: 'user',
  };
}

function resolveActivePreset(
  preferences: UserAiPreferences,
  configured: StoredProviderConfig[]
): AiProviderPreset {
  const configuredPresets = configured.map((c) => c.preset);
  if (configuredPresets.includes(preferences.preset)) return preferences.preset;
  return configuredPresets[0] ?? preferences.preset;
}

function isProviderConfigUpdate(update: AiSettingsUpdate): boolean {
  return (
    update.clearApiKey === true ||
    update.apiKey !== undefined ||
    update.baseUrl !== undefined ||
    update.visionModel !== undefined ||
    update.structureModel !== undefined ||
    update.provider !== undefined
  );
}

export function resolveLlmConfig(userId: number): ResolvedLlmConfig | null {
  const preferences = loadPreferences(userId);
  const configured = loadConfiguredProviders(userId);
  const preset = resolveActivePreset(preferences, configured);
  const config = configured.find((c) => c.preset === preset) ?? loadProviderConfig(userId, preset);
  if (!config) return null;
  return resolveFromProviderConfig(config);
}

export function isVisionOcrAvailable(userId: number): boolean {
  const preferences = loadPreferences(userId);
  const configured = loadConfiguredProviders(userId);
  const preset = resolveActivePreset(preferences, configured);
  const config = configured.find((c) => c.preset === preset);
  if (!config?.apiKey.trim()) return false;
  return presetSupportsVisionOcr(preset);
}

export function getVisionRuntimeProvider(userId: number): VisionRuntimeProvider | null {
  return resolveLlmConfig(userId)?.runtimeProvider ?? null;
}

export function resolveOcrEngineMode(userId: number): OcrEngineMode {
  return loadPreferences(userId).ocrEngine;
}

export function getActiveProviderPreset(userId: number): AiProviderPreset {
  const preferences = loadPreferences(userId);
  const configured = loadConfiguredProviders(userId);
  return resolveActivePreset(preferences, configured);
}

export function getAiSettings(userId: number): AiSettingsResponse {
  const preferences = loadPreferences(userId);
  const configured = loadConfiguredProviders(userId);
  const configuredSummaries = configured.map(toSummary);
  const activePreset = resolveActivePreset(preferences, configured);
  const activeConfig =
    configured.find((c) => c.preset === activePreset) ??
    loadProviderConfig(userId, activePreset) ??
    defaultProviderConfig(activePreset);
  const effective = resolveFromProviderConfig(activeConfig);

  return {
    provider: activeConfig.provider,
    preset: activePreset,
    baseUrl: activeConfig.baseUrl,
    visionModel: activeConfig.visionModel,
    textModel: preferences.textModel || activeConfig.textModel,
    structureModel: activeConfig.structureModel,
    ocrEngine: preferences.ocrEngine,
    apiKeyMasked: maskApiKey(activeConfig.apiKey),
    apiKeySet: Boolean(activeConfig.apiKey.trim()),
    source: effective?.source ?? 'none',
    visionAvailable: isVisionOcrAvailable(userId),
    translateAvailable: Boolean(effective),
    configuredProviders: configuredSummaries,
  };
}

export function updateAiSettings(userId: number, update: AiSettingsUpdate): AiSettingsResponse {
  const preferences = loadPreferences(userId);
  const targetPreset: AiProviderPreset =
    update.preset === 'dashscope' ||
    update.preset === 'deepseek' ||
    update.preset === 'openai' ||
    update.preset === 'moonshot' ||
    update.preset === 'custom'
      ? update.preset
      : preferences.preset;

  if (update.clearApiKey) {
    clearProviderConfig(userId, targetPreset);
    const configured = loadConfiguredProviders(userId);
    const nextPreset = resolveActivePreset(preferences, configured);
    savePreferences(userId, {
      ...preferences,
      preset: nextPreset,
      textModel:
        configured.find((c) => c.preset === nextPreset)?.textModel ?? preferences.textModel,
    });
    return getAiSettings(userId);
  }

  if (isProviderConfigUpdate(update)) {
    const existing =
      loadProviderConfig(userId, targetPreset) ?? defaultProviderConfig(targetPreset);
    let apiKey = existing.apiKey;
    if (update.apiKey !== undefined && update.apiKey.trim()) {
      apiKey = update.apiKey.trim();
    }

    const provider: AiProvider =
      update.provider === 'openai_compatible' || update.provider === 'dashscope'
        ? update.provider
        : existing.provider;
    const defaults = defaultProviderConfig(targetPreset);

    const nextConfig: StoredProviderConfig = {
      preset: targetPreset,
      provider,
      apiKey,
      baseUrl: (update.baseUrl ?? existing.baseUrl).trim() || defaults.baseUrl,
      visionModel: (update.visionModel ?? existing.visionModel).trim() || defaults.visionModel,
      textModel: (update.textModel ?? existing.textModel).trim() || defaults.textModel,
      structureModel:
        (update.structureModel ?? existing.structureModel).trim() || defaults.structureModel,
    };

    if (nextConfig.apiKey.trim()) {
      saveProviderConfig(userId, nextConfig);
    }

    savePreferences(userId, {
      preset: targetPreset,
      textModel: update.textModel?.trim() || preferences.textModel || nextConfig.textModel,
      ocrEngine: update.ocrEngine ?? preferences.ocrEngine,
    });
    return getAiSettings(userId);
  }

  const configured = loadConfiguredProviders(userId);
  const configuredPresets = configured.map((c) => c.preset);
  if (update.preset && configuredPresets.length > 0 && !configuredPresets.includes(update.preset)) {
    throw new Error('请先配置该提供商的 API Key');
  }

  savePreferences(userId, {
    preset: update.preset ?? preferences.preset,
    textModel: update.textModel?.trim() || preferences.textModel,
    ocrEngine: update.ocrEngine ?? preferences.ocrEngine,
  });
  return getAiSettings(userId);
}

export function getVisionConfig(userId: number): ResolvedLlmConfig | null {
  return resolveLlmConfig(userId);
}

export interface AiConnectionTestInput {
  provider?: AiProvider;
  preset?: AiProviderPreset;
  apiKey?: string;
  baseUrl?: string;
  visionModel?: string;
  textModel?: string;
}

export async function testAiConnection(
  userId: number,
  input: AiConnectionTestInput = {}
): Promise<{ ok: boolean; message: string }> {
  const preferences = loadPreferences(userId);
  const preset =
    input.preset === 'dashscope' ||
    input.preset === 'deepseek' ||
    input.preset === 'openai' ||
    input.preset === 'moonshot' ||
    input.preset === 'custom'
      ? input.preset
      : preferences.preset;

  const stored = loadProviderConfig(userId, preset) ?? defaultProviderConfig(preset);
  const provider: AiProvider =
    input.provider === 'openai_compatible' || input.provider === 'dashscope'
      ? input.provider
      : stored.provider;

  const effectiveKey = input.apiKey?.trim() || stored.apiKey.trim() || '';
  if (!effectiveKey) {
    return { ok: false, message: '请先填写 API Key' };
  }

  const baseUrl =
    (input.baseUrl ?? stored.baseUrl ?? DEFAULTS[provider].baseUrl).trim() ||
    DEFAULTS[provider].baseUrl;
  const visionModel =
    (input.visionModel ?? stored.visionModel ?? DEFAULTS[provider].visionModel).trim() ||
    DEFAULTS[provider].visionModel;

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: visionModel,
      temperature: 0,
      max_tokens: 8,
      messages: buildConnectionTestMessages(visionModel, provider),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return { ok: false, message: err.slice(0, 240) || `HTTP ${response.status}` };
  }

  return { ok: true, message: '连接成功' };
}

export interface ProviderModelsInput {
  preset: AiProviderPreset;
  baseUrl?: string;
  apiKey?: string;
}

export async function getProviderModels(
  userId: number,
  input: ProviderModelsInput
): Promise<ProviderModelsResult> {
  const stored = loadProviderConfig(userId, input.preset);
  return listProviderModels({
    preset: input.preset,
    baseUrl: input.baseUrl ?? stored?.baseUrl,
    apiKey: input.apiKey,
    storedApiKey: stored?.apiKey,
    storedBaseUrl: input.baseUrl ?? stored?.baseUrl,
  });
}

/** 64×64 PNG — meets DashScope min dimension (>10) and min_pixels (3072). */
const TEST_PING_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAe0lEQVR4nNXOQREAAAyDMPyrRcJE9LEjCoJxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxGIdxfAdWB9BRAqRA9DWJAAAAAElFTkSuQmCC';

function buildConnectionTestMessages(model: string, provider: AiProvider) {
  const prompt = 'Reply with exactly: OK';
  if (!modelRequiresVisionInput(model)) {
    return [{ role: 'user' as const, content: prompt }];
  }

  const textPart = { type: 'text', text: prompt };
  const imagePart: Record<string, unknown> = {
    type: 'image_url',
    image_url: { url: TEST_PING_IMAGE },
  };

  if (provider === 'dashscope') {
    imagePart.min_pixels = 3072;
    imagePart.max_pixels = 8388608;
  }

  const content =
    provider === 'dashscope' && /qwen-vl-ocr/i.test(model)
      ? [imagePart, textPart]
      : [textPart, imagePart];

  return [{ role: 'user' as const, content }];
}
