import { useEffect, useState } from 'react';

/** Countdown in whole seconds, e.g. for "Send a new code in 12 seconds". */
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const start = (seconds: number) => {
    const startedAt = Date.now();
    setNow(startedAt);
    setUntil(startedAt + seconds * 1000);
  };

  return { remaining, start };
}
