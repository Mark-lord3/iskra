import { useEffect, useState } from 'react';

export function useCountdown(target) {
  const [diff, setDiff] = useState(() => Math.max(0, new Date(target) - Date.now()));
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setDiff(Math.max(0, new Date(target) - Date.now())), 1000);
    setDiff(Math.max(0, new Date(target) - Date.now()));
    return () => clearInterval(id);
  }, [target]);
  return {
    days: Math.floor(diff / 864e5),
    hrs:  Math.floor(diff / 36e5) % 24,
    min:  Math.floor(diff / 6e4) % 60,
    sec:  Math.floor(diff / 1e3) % 60
  };
}
