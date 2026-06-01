import type { Locale } from '../i18n';

export function formatClockTime(date: Date, withSeconds = true, locale: Locale = 'zh'): string {
  return date.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

export function formatFullDate(date: Date, locale: Locale = 'zh'): string {
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function formatShortDate(date: Date, locale: Locale = 'zh'): string {
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function formatDuration(totalSeconds: number, locale: Locale = 'zh'): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return locale === 'zh' ? `${seconds} 秒` : `${seconds}s`;
  }
  return locale === 'zh'
    ? `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function getGreeting(date: Date, t: (key: string) => string): string {
  const hour = date.getHours();
  if (hour < 6) return t('greeting.lateNight');
  if (hour < 11) return t('greeting.morning');
  if (hour < 13) return t('greeting.noon');
  if (hour < 18) return t('greeting.afternoon');
  return t('greeting.evening');
}
