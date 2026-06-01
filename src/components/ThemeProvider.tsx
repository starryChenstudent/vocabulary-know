import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  getStoredTheme,
  storeTheme,
  type ThemePreference,
} from '../theme';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    storeTheme(next);
    setPreferenceState(next);
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
    }),
    [preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
