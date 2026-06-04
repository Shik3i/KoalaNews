const rateMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateMap.forEach((entry, key) => {
    if (now > entry.resetAt) rateMap.delete(key);
  });
}, 300_000);

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}
