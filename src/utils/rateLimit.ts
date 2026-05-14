/**
 * In-process rate limit for feedback submissions. Defaults to 5 submits per
 * rolling 60-second window — enough margin for legitimate bursts (e.g. a user
 * filing related issues back-to-back) but stops spam from runaway crash loops.
 *
 * The state is per process (module-level array) — `resetRateLimit` is
 * provided for tests.
 */

const WINDOW_MS = 60_000;
const LIMIT = 5;

const recentSubmits: number[] = [];

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the oldest entry expires (0 when allowed). */
  retryAfterMs: number;
  /** Count of entries still inside the window. */
  countInWindow: number;
}

export function checkSubmitAllowed(now: number = Date.now()): RateLimitResult {
  pruneExpired(now);
  const count = recentSubmits.length;
  if (count < LIMIT) {
    return { allowed: true, retryAfterMs: 0, countInWindow: count };
  }
  const oldest = recentSubmits[0];
  const retryAfterMs = Math.max(0, oldest + WINDOW_MS - now);
  return { allowed: false, retryAfterMs, countInWindow: count };
}

export function recordSubmit(now: number = Date.now()): void {
  recentSubmits.push(now);
}

export function resetRateLimit(): void {
  recentSubmits.length = 0;
}

function pruneExpired(now: number): void {
  while (recentSubmits.length > 0 && recentSubmits[0] + WINDOW_MS <= now) {
    recentSubmits.shift();
  }
}

/** "N초" / "N분 N초" — Korean-friendly UI hint. */
export function formatRetryAfter(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}
