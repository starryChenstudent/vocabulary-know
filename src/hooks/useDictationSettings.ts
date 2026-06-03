import { useCallback, useEffect, useState } from 'react';
import type { AudioAccent } from '../utils/dictionaryAudio';

export interface DictationSettings {
  playCount: 1 | 2 | 3;
  playbackRate: 0.75 | 1 | 1.25;
  accent: AudioAccent;
}

const STORAGE_KEY = 'vocabulary-iknow-dictation-settings';

const DEFAULT_SETTINGS: DictationSettings = {
  playCount: 3,
  playbackRate: 1,
  accent: 'us',
};

function readSettings(): DictationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DictationSettings>;
    return {
      playCount: parsed.playCount === 1 || parsed.playCount === 2 || parsed.playCount === 3
        ? parsed.playCount
        : DEFAULT_SETTINGS.playCount,
      playbackRate:
        parsed.playbackRate === 0.75 || parsed.playbackRate === 1 || parsed.playbackRate === 1.25
          ? parsed.playbackRate
          : DEFAULT_SETTINGS.playbackRate,
      accent:
        parsed.accent === 'us' || parsed.accent === 'uk' || parsed.accent === 'any'
          ? parsed.accent
          : DEFAULT_SETTINGS.accent,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useDictationSettings() {
  const [settings, setSettingsState] = useState<DictationSettings>(readSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const setSettings = useCallback((patch: Partial<DictationSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, setSettings };
}
