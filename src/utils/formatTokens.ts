export function formatCompactTokens(value: number): string {
  const n = Math.max(0, Math.floor(value));
  if (n >= 1_000_000) {
    const scaled = n / 1_000_000;
    return scaled >= 100 ? `${Math.round(scaled)}M` : `${scaled.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 1_000) {
    const scaled = n / 1_000;
    return scaled >= 100 ? `${Math.round(scaled)}K` : `${scaled.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return n.toLocaleString();
}

export function formatTokenCount(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString();
}

export function defaultUsageDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { from: fmt(from), to: fmt(to) };
}
