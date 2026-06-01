import { useNow } from '../hooks/useTime';
import { formatClockTime, formatFullDate, formatShortDate } from '../utils/time';
import './ClockDisplay.css';

interface ClockDisplayProps {
  collapsed?: boolean;
  variant?: 'sidebar' | 'mobile';
}

export default function ClockDisplay({ collapsed = false, variant = 'sidebar' }: ClockDisplayProps) {
  const now = useNow();

  const timeText = formatClockTime(now, !collapsed || variant === 'mobile');
  const dateText = variant === 'mobile' ? formatShortDate(now) : formatFullDate(now);

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
