/** Maps stored preset / provider ids (snake_case) to adminAi.providers i18n keys. */
const PROVIDER_PRESET_I18N_KEYS: Record<string, string> = {
  tesseract: 'adminAi.providers.tesseract',
  dashscope: 'adminAi.providers.dashscope',
  deepseek: 'adminAi.providers.deepseek',
  openai: 'adminAi.providers.openai',
  moonshot: 'adminAi.providers.moonshot',
  aliyun_token_plan: 'adminAi.providers.aliyunTokenPlan',
  custom: 'adminAi.providers.custom',
  openai_compatible: 'adminAi.providers.custom',
};

export function providerPresetI18nKey(preset: string): string {
  return PROVIDER_PRESET_I18N_KEYS[preset] ?? `adminAi.providers.${preset}`;
}

export function translateProviderPreset(
  preset: string,
  t: (key: string) => string
): string {
  const key = providerPresetI18nKey(preset);
  const translated = t(key);
  return translated === key ? preset : translated;
}
