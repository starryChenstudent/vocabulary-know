const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

interface DictionaryPhonetic {
  audio?: string;
}

interface DictionaryEntry {
  word: string;
  phonetics?: DictionaryPhonetic[];
}

const audioUrlCache = new Map<string, string | null>();
let currentAudio: HTMLAudioElement | null = null;

export function normalizeWordForDict(word: string): string {
  const cleaned = word.trim().toLowerCase().replace(/[^a-z0-9'\s-]/gi, '');
  const first = cleaned.split(/\s+/).find((part) => /[a-z]/.test(part));
  return first ?? '';
}

export async function fetchDictionaryAudioUrl(word: string): Promise<string | null> {
  const query = normalizeWordForDict(word);
  if (!query) return null;

  if (audioUrlCache.has(query)) {
    return audioUrlCache.get(query) ?? null;
  }

  try {
    const res = await fetch(`${DICT_API}/${encodeURIComponent(query)}`);
    if (!res.ok) {
      audioUrlCache.set(query, null);
      return null;
    }

    const entries = (await res.json()) as DictionaryEntry[];
    let audioUrl: string | null = null;

    for (const entry of entries) {
      for (const phonetic of entry.phonetics ?? []) {
        const audio = phonetic.audio?.trim();
        if (audio) {
          audioUrl = audio;
          break;
        }
      }
      if (audioUrl) break;
    }

    audioUrlCache.set(query, audioUrl);
    return audioUrl;
  } catch {
    audioUrlCache.set(query, null);
    return null;
  }
}

export function stopWordAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export async function playWordAudio(
  word: string
): Promise<'ok' | 'not_found' | 'play_failed'> {
  const url = await fetchDictionaryAudioUrl(word);
  if (!url) return 'not_found';

  try {
    stopWordAudio();
    currentAudio = new Audio(url);
    await currentAudio.play();
    return 'ok';
  } catch {
    stopWordAudio();
    return 'play_failed';
  }
}
