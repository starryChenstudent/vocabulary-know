export function formatClockTime(date: Date, withSeconds = true): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`;
}

export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
