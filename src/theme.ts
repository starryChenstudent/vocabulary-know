export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vocabulary-iknow-theme';

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return getSystemTheme();
  return preference;
}

export function getStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignore
  }
  return 'system';
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore
  }
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  return resolved;
}

export function initTheme(): ThemePreference {
  const preference = getStoredTheme();
  applyTheme(preference);
  return preference;
}
