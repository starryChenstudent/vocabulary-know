import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export function useElapsedTimer(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;

    const startedAt = Date.now();
    setElapsed(0);

    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  return elapsed;
}
