import { useNow } from '../hooks/useTime';
import { formatClockTime, formatFullDate, formatShortDate } from '../utils/time';
import { useLocale } from './LocaleProvider';
import './ClockDisplay.css';

interface ClockDisplayProps {
  collapsed?: boolean;
  variant?: 'sidebar' | 'mobile';
}

export default function ClockDisplay({ collapsed = false, variant = 'sidebar' }: ClockDisplayProps) {
  const { locale } = useLocale();
  const now = useNow();

  const timeText = formatClockTime(now, !collapsed || variant === 'mobile', locale);
  const dateText =
    variant === 'mobile' ? formatShortDate(now, locale) : formatFullDate(now, locale);

  return (
    <div
      className={[
        'clock-display',
        collapsed ? 'clock-display--collapsed' : '',
        variant === 'mobile' ? 'clock-display--mobile' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
      aria-label={`当前时间 ${timeText}，${dateText}`}
    >
      <time className="clock-time" dateTime={now.toISOString()}>
        {timeText}
      </time>
      {!collapsed && <span className="clock-date">{dateText}</span>}
    </div>
  );
}
