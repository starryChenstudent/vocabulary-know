import { useEffect, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import type { Locale } from '../i18n';
import './LocaleToggle.css';

const OPTIONS: Locale[] = ['zh', 'en'];

interface LocaleToggleProps {
  collapsed?: boolean;
  variant?: 'sidebar' | 'mobile' | 'login';
}

export default function LocaleToggle({
  collapsed = false,
  variant = 'sidebar',
}: LocaleToggleProps) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerLabel = locale === 'zh' ? '中' : 'EN';

  return (
    <div
      ref={rootRef}
      className={[
        'locale-toggle',
        collapsed ? 'locale-toggle--collapsed' : '',
        variant === 'mobile' ? 'locale-toggle--mobile' : '',
        variant === 'login' ? 'locale-toggle--login' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {open && (
        <div className="locale-menu" role="menu" aria-label={t('locale.switch')}>
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={locale === option}
              className={`locale-menu-item ${locale === option ? 'active' : ''}`}
              onClick={() => {
                setLocale(option);
                setOpen(false);
              }}
            >
              {t(`locale.${option}`)}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="locale-trigger"
        aria-label={t('locale.switch')}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('locale.switch')}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="locale-trigger-badge">{triggerLabel}</span>
        {!collapsed && variant === 'sidebar' && (
          <span className="locale-trigger-text">{t(`locale.${locale}`)}</span>
        )}
      </button>
    </div>
  );
}
