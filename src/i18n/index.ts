export type Locale = 'zh' | 'en';

export const LOCALE_STORAGE_KEY = 'vocabulary-iknow-locale';

export type Messages = typeof import('./locales/zh.js').zh;

export function getStoredLocale(): Locale {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (value === 'en' || value === 'zh') return value;
  } catch {
    // ignore
  }
  return 'zh';
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
}

export function initLocale(): Locale {
  const locale = getStoredLocale();
  applyLocale(locale);
  return locale;
}

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as object)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === 'string' ? value : undefined;
}

export function createTranslator(messages: Messages) {
  return (key: string, vars?: Record<string, string | number>) => {
    let text = getByPath(messages as unknown as Record<string, unknown>, key) ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}
