const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export type AudioAccent = 'us' | 'uk' | 'any';
export type AudioSource = 'youdao' | 'bing' | 'dictionaryapi';

export interface PlayWordAudioOptions {
  accent?: AudioAccent;
  playbackRate?: number;
  waitUntilEnd?: boolean;
}

interface DictionaryPhonetic {
  audio?: string;
}

interface DictionaryEntry {
  word: string;
  phonetics?: DictionaryPhonetic[];
}

interface AudioCandidate {
  source: AudioSource;
  url: string;
}

const audioUrlCache = new Map<string, string | null>();
const failedSourcesCache = new Map<string, Set<AudioSource>>();
let sharedAudio: HTMLAudioElement | null = null;
let currentAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let unlockPromise: Promise<void> | null = null;
let preparedKey: string | null = null;

/** 极短静音 WAV，用于解除自动播放限制，不产生可闻声音 */
const SILENT_AUDIO_SRC =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function normalizeWordForDict(word: string): string {
  const cleaned = word.trim().toLowerCase().replace(/[^a-z0-9'\s-]/gi, '');
  const first = cleaned.split(/\s+/).find((part) => /[a-z]/.test(part));
  return first ?? '';
}

function cacheKey(query: string, accent: AudioAccent): string {
  return `${query}:${accent}`;
}

function preparationKey(url: string, playbackRate: number): string {
  return `${url}@${playbackRate}`;
}

function isUsAudio(url: string): boolean {
  return /(?:^|[/\-_])us(?:[.\-_/]|$)/i.test(url);
}

function isUkAudio(url: string): boolean {
  return /(?:^|[/\-_])uk(?:[.\-_/]|$)/i.test(url);
}

function collectAudioUrls(entries: DictionaryEntry[]): string[] {
  const urls: string[] = [];
  for (const entry of entries) {
    for (const phonetic of entry.phonetics ?? []) {
      const audio = phonetic.audio?.trim();
      if (audio) urls.push(audio);
    }
  }
  return urls;
}

function pickAudioUrl(urls: string[], accent: AudioAccent): string | null {
  if (urls.length === 0) return null;

  if (accent === 'us') {
    return urls.find(isUsAudio) ?? urls[0];
  }
  if (accent === 'uk') {
    return urls.find(isUkAudio) ?? urls[0];
  }
  return urls[0];
}

/** 有道词典语音（国内 CDN，URL 可直接拼接，无需预请求 JSON） */
export function buildYoudaoAudioUrl(query: string, accent: AudioAccent): string {
  const type = accent === 'uk' ? 2 : 1;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(query)}&type=${type}`;
}

/** 必应词典语音（国内访问较快，URL 可直接拼接） */
export function buildBingAudioUrl(query: string, accent: AudioAccent): string {
  const language = accent === 'uk' ? 'en-GB' : 'en-US';
  const params = new URLSearchParams({
    audio: '1',
    format: 'audio/mp3',
    language,
    word: query,
  });
  return `https://www.bing.com/dict/speech?${params.toString()}`;
}

function buildDirectCandidates(query: string, accent: AudioAccent): AudioCandidate[] {
  return [
    { source: 'youdao', url: buildYoudaoAudioUrl(query, accent) },
    { source: 'bing', url: buildBingAudioUrl(query, accent) },
  ];
}

function markSourceFailed(key: string, source: AudioSource): void {
  const failed = failedSourcesCache.get(key) ?? new Set<AudioSource>();
  failed.add(source);
  failedSourcesCache.set(key, failed);
}

function isSourceFailed(key: string, source: AudioSource): boolean {
  return failedSourcesCache.get(key)?.has(source) ?? false;
}

async function fetchDictionaryApiAudioUrl(
  query: string,
  accent: AudioAccent
): Promise<string | null> {
  try {
    const res = await fetch(`${DICT_API}/${encodeURIComponent(query)}`);
    if (!res.ok) return null;

    const entries = (await res.json()) as DictionaryEntry[];
    return pickAudioUrl(collectAudioUrls(entries), accent);
  } catch {
    return null;
  }
}

export async function fetchDictionaryAudioUrl(
  word: string,
  accent: AudioAccent = 'any'
): Promise<string | null> {
  const query = normalizeWordForDict(word);
  if (!query) return null;

  const key = cacheKey(query, accent);
  if (audioUrlCache.has(key)) {
    return audioUrlCache.get(key) ?? null;
  }

  return buildYoudaoAudioUrl(query, accent);
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

function invalidatePreparedAudio(): void {
  preparedKey = null;
}

/**
 * 在用户点击时调用，解除浏览器自动播放限制。
 * 复用同一 Audio 实例，避免首次真实播放时解码器未就绪。
 */
export function primeAudioPlayback(): Promise<void> {
  if (audioUnlocked) return Promise.resolve();
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    const audio = getSharedAudio();
    audio.volume = 0;
    audio.muted = true;
    audio.src = SILENT_AUDIO_SRC;
    audio.load();

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
      audio.muted = false;
      audio.volume = 1;
      audioUnlocked = true;
    } catch {
      // 解锁失败时仍保留实例，后续播放由用户重试触发
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

function waitForAudioEnd(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('audio playback error'));
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
  });
}

export function stopWordAudio(): void {
  const audio = currentAudio ?? sharedAudio;
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  currentAudio = null;
}

const LOAD_TIMEOUT_MS = 8000;
const MIN_DURATION_SEC = 0.08;
const DECODER_SETTLE_MS = 80;

async function settleAudioDecoder(audio: HTMLAudioElement): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((resolve) => setTimeout(resolve, DECODER_SETTLE_MS));
  try {
    audio.currentTime = 0;
  } catch {
    // ignore seek errors on empty buffer
  }
}

async function waitForAudioReady(audio: HTMLAudioElement): Promise<'ok' | 'play_failed'> {
  const isValid = () =>
    Number.isFinite(audio.duration) &&
    audio.duration >= MIN_DURATION_SEC &&
    audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;

  if (isValid()) return 'ok';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: 'ok' | 'play_failed') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('error', onError);
      resolve(result);
    };

    const timer = setTimeout(() => finish('play_failed'), LOAD_TIMEOUT_MS);

    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration < MIN_DURATION_SEC) {
        finish('play_failed');
      }
    };

    const onCanPlay = () => {
      if (isValid()) {
        setTimeout(() => finish('ok'), DECODER_SETTLE_MS);
      }
    };

    const onError = () => finish('play_failed');

    audio.addEventListener('loadedmetadata', onMeta, { once: true });
    audio.addEventListener('canplaythrough', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
  });
}

async function prepareAudioUrl(url: string, playbackRate: number): Promise<'ok' | 'play_failed'> {
  const key = preparationKey(url, playbackRate);
  const audio = getSharedAudio();

  if (preparedKey === key) {
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && audio.src) {
      return 'ok';
    }
  }

  stopWordAudio();
  invalidatePreparedAudio();

  audio.muted = false;
  audio.volume = 1;
  audio.playbackRate = playbackRate;
  audio.src = url;
  audio.load();

  const ready = await waitForAudioReady(audio);
  if (ready === 'play_failed') {
    audio.removeAttribute('src');
    audio.load();
    return 'play_failed';
  }

  await settleAudioDecoder(audio);
  preparedKey = key;
  return 'ok';
}

async function playPreparedAudio(waitUntilEnd?: boolean): Promise<'ok' | 'play_failed'> {
  const audio = getSharedAudio();
  if (!audio.src) return 'play_failed';

  try {
    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;
    await settleAudioDecoder(audio);
    currentAudio = audio;
    await audio.play();
    if (waitUntilEnd) {
      await waitForAudioEnd(audio);
    }
    return 'ok';
  } catch {
    currentAudio = null;
    return 'play_failed';
  }
}

function sourceFromUrl(url: string): AudioSource {
  if (url.includes('youdao.com')) return 'youdao';
  if (url.includes('bing.com')) return 'bing';
  return 'dictionaryapi';
}

async function prepareWordAudio(
  query: string,
  accent: AudioAccent,
  playbackRate: number
): Promise<'ok' | 'not_found' | 'play_failed'> {
  const key = cacheKey(query, accent);

  if (audioUrlCache.has(key)) {
    const cached = audioUrlCache.get(key);
    if (!cached) return 'not_found';

    const cachedResult = await prepareAudioUrl(cached, playbackRate);
    if (cachedResult === 'ok') return 'ok';
    audioUrlCache.delete(key);
    markSourceFailed(key, sourceFromUrl(cached));
    invalidatePreparedAudio();
  }

  for (const candidate of buildDirectCandidates(query, accent)) {
    if (isSourceFailed(key, candidate.source)) continue;

    const result = await prepareAudioUrl(candidate.url, playbackRate);
    if (result === 'ok') {
      audioUrlCache.set(key, candidate.url);
      return 'ok';
    }

    markSourceFailed(key, candidate.source);
    invalidatePreparedAudio();
  }

  if (!isSourceFailed(key, 'dictionaryapi')) {
    const apiUrl = await fetchDictionaryApiAudioUrl(query, accent);
    if (apiUrl) {
      const apiResult = await prepareAudioUrl(apiUrl, playbackRate);
      if (apiResult === 'ok') {
        audioUrlCache.set(key, apiUrl);
        return 'ok';
      }
    }
    markSourceFailed(key, 'dictionaryapi');
    invalidatePreparedAudio();
  }

  audioUrlCache.set(key, null);
  return 'not_found';
}

/** 预加载单词音频（不播放），适合在拉题后、自动播放前调用 */
export async function preloadWordAudio(
  word: string,
  options?: Pick<PlayWordAudioOptions, 'accent' | 'playbackRate'>
): Promise<boolean> {
  const query = normalizeWordForDict(word);
  if (!query) return false;

  const accent = options?.accent ?? 'any';
  const playbackRate = options?.playbackRate ?? 1;
  const result = await prepareWordAudio(query, accent, playbackRate);
  return result === 'ok';
}

async function playWithFallback(
  query: string,
  accent: AudioAccent,
  options?: PlayWordAudioOptions
): Promise<'ok' | 'not_found' | 'play_failed'> {
  const playbackRate = options?.playbackRate ?? 1;
  const key = cacheKey(query, accent);
  const cachedUrl = audioUrlCache.get(key);

  if (cachedUrl && preparedKey === preparationKey(cachedUrl, playbackRate)) {
    const playResult = await playPreparedAudio(options?.waitUntilEnd);
    if (playResult === 'ok') return 'ok';
    invalidatePreparedAudio();
  }

  const prepareResult = await prepareWordAudio(query, accent, playbackRate);
  if (prepareResult !== 'ok') return prepareResult;

  return playPreparedAudio(options?.waitUntilEnd);
}

export async function playWordAudio(
  word: string,
  options?: PlayWordAudioOptions
): Promise<'ok' | 'not_found' | 'play_failed'> {
  const query = normalizeWordForDict(word);
  if (!query) return 'not_found';

  const accent = options?.accent ?? 'any';
  return playWithFallback(query, accent, options);
}

export async function playWordAudioSequence(
  word: string,
  options: PlayWordAudioOptions & { repeat?: number; gapMs?: number }
): Promise<'ok' | 'not_found' | 'play_failed'> {
  const repeat = Math.max(1, options.repeat ?? 1);
  const gapMs = options.gapMs ?? 450;

  for (let i = 0; i < repeat; i++) {
    const result = await playWordAudio(word, { ...options, waitUntilEnd: true });
    if (result !== 'ok') return result;
    if (i < repeat - 1) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
  }

  return 'ok';
}
