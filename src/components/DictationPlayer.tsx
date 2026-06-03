import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import type { DictationSettings } from '../hooks/useDictationSettings';
import { normalizeWordForDict, playWordAudioSequence, stopWordAudio } from '../utils/dictionaryAudio';
import './DictationPlayer.css';

interface DictationPlayerProps {
  word: string;
  settings: DictationSettings;
  autoPlay?: boolean;
  playKey?: string | number;
}

export default function DictationPlayer({
  word,
  settings,
  autoPlay = false,
  playKey,
}: DictationPlayerProps) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playRound, setPlayRound] = useState(0);
  const sessionRef = useRef(0);

  const canSpeak = Boolean(normalizeWordForDict(word));

  const runPlayback = useCallback(async () => {
    if (!canSpeak) return;

    const session = ++sessionRef.current;
    setLoading(true);
    setError(null);
    setPlayRound(0);

    for (let i = 0; i < settings.playCount; i++) {
      if (session !== sessionRef.current) return;

      setPlayRound(i + 1);
      const result = await playWordAudioSequence(word, {
        accent: settings.accent,
        playbackRate: settings.playbackRate,
        repeat: 1,
      });

      if (session !== sessionRef.current) return;

      if (result === 'not_found') {
        setError(t('dictation.audioNotFound'));
        setLoading(false);
        setPlayRound(0);
        return;
      }
      if (result === 'play_failed') {
        setError(t('dictation.audioFailed'));
        setLoading(false);
        setPlayRound(0);
        return;
      }

      if (i < settings.playCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    }

    if (session === sessionRef.current) {
      setLoading(false);
      setPlayRound(0);
    }
  }, [canSpeak, settings.accent, settings.playCount, settings.playbackRate, t, word]);

  useEffect(() => {
    if (!autoPlay || !canSpeak) return;
    void runPlayback();
    return () => {
      sessionRef.current += 1;
      stopWordAudio();
    };
  }, [autoPlay, canSpeak, playKey, runPlayback]);

  useEffect(
    () => () => {
      sessionRef.current += 1;
      stopWordAudio();
    },
    []
  );

  if (!canSpeak) {
    return <p className="dictation-player__unsupported">{t('dictation.unsupportedWord')}</p>;
  }

  return (
    <div className="dictation-player">
      <button
        type="button"
        className={`dictation-player__btn${loading ? ' dictation-player__btn--loading' : ''}`}
        onClick={() => void runPlayback()}
        disabled={loading}
        aria-label={t('dictation.replay')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M11 5 6 9H4v6h2l5 4V5Z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M17.66 6.34a8 8 0 0 1 0 11.32" />
        </svg>
        <span className="dictation-player__label">
          {loading
            ? t('dictation.playing', { current: playRound, total: settings.playCount })
            : t('dictation.replay')}
        </span>
      </button>
      {error && <p className="dictation-player__error">{error}</p>}
    </div>
  );
}
