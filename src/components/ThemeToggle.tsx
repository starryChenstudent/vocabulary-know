import { useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import type { ThemePreference } from '../theme';
import './ThemeToggle.css';

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function TriggerIcon({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') return <SunIcon />;
  if (preference === 'dark') return <MoonIcon />;
  return <MonitorIcon />;
}

interface ThemeToggleProps {
  collapsed?: boolean;
  variant?: 'sidebar' | 'mobile';
}

export default function ThemeToggle({ collapsed = false, variant = 'sidebar' }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
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

  return (
    <div
      ref={rootRef}
      className={[
        'theme-toggle',
        collapsed ? 'theme-toggle--collapsed' : '',
        variant === 'mobile' ? 'theme-toggle--mobile' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {open && (
        <div className="theme-menu" role="menu" aria-label="外观模式">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              className={`theme-menu-item ${preference === option.value ? 'active' : ''}`}
              onClick={() => {
                setPreference(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="theme-trigger"
        aria-label="切换外观"
        aria-expanded={open}
        aria-haspopup="menu"
        title="切换外观"
        onClick={() => setOpen((value) => !value)}
      >
        <TriggerIcon preference={preference} />
        {!collapsed && variant === 'sidebar' && (
          <span className="theme-trigger-text">外观</span>
        )}
      </button>
    </div>
  );
}
