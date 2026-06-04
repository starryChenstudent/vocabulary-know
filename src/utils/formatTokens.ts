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

/** Display token budget limit in k (1 k = 1_000 tokens). */
export function formatBudgetK(tokens: number): string {
  const n = Math.max(0, Math.floor(tokens));
  if (n < 1000) return n.toLocaleString();
  const k = n / 1000;
  const text =
    k >= 100 || Number.isInteger(k)
      ? String(Math.round(k))
      : k.toFixed(1).replace(/\.0$/, '');
  return `${text}k`;
}

export function tokensToBudgetKInput(tokens: number): string {
  const k = tokens / 1000;
  if (Number.isInteger(k)) return String(k);
  return k.toFixed(2).replace(/\.?0+$/, '');
}

export function parseBudgetKInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const k = Number(trimmed);
  if (!Number.isFinite(k) || k < 0) return NaN;
  return Math.round(k * 1000);
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
