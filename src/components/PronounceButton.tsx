import { useState } from 'react';
import { useLocale } from './LocaleProvider';
import { normalizeWordForDict, playWordAudio } from '../utils/dictionaryAudio';
import './PronounceButton.css';

interface PronounceButtonProps {
  word: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function PronounceButton({
  word,
  className,
  size = 'md',
}: PronounceButtonProps) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSpeak = Boolean(normalizeWordForDict(word));

  async function handleClick() {
    if (!canSpeak || loading) return;

    setLoading(true);
    setError(null);
    const result = await playWordAudio(word);
    setLoading(false);

    if (result === 'not_found') {
      setError(t('pronounce.notFound'));
    } else if (result === 'play_failed') {
      setError(t('pronounce.playFailed'));
    }
  }

  if (!canSpeak) return null;

  return (
    <span className={className ? `pronounce-wrap ${className}` : 'pronounce-wrap'}>
      <button
        type="button"
        className={`pronounce-btn pronounce-btn--${size}${loading ? ' pronounce-btn--loading' : ''}`}
        onClick={handleClick}
        disabled={loading}
        aria-label={t('pronounce.play')}
        title={t('pronounce.play')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M11 5 6 9H4v6h2l5 4V5Z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M17.66 6.34a8 8 0 0 1 0 11.32" />
        </svg>
      </button>
      {error && <span className="pronounce-error">{error}</span>}
    </span>
  );
}
