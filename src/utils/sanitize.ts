/**
 * Sanitize PII-leaking fields out of an auto-context dump before it ends up
 * inside a feedback report. Currently focuses on the most common offender —
 * user home paths embedded in workspace / config strings.
 */

export function redactHomePath(path: string | null | undefined): string | null {
  if (!path) return null;
  // POSIX: /Users/<name>/... → ~/... | /home/<name>/... → ~/...
  const posix = path.match(/^(\/Users|\/home)\/[^/]+(\/.*)?$/);
  if (posix) return '~' + (posix[2] ?? '');
  // Windows: C:\Users\<name>\... → ~\... (also forward-slash forms).
  const win = path.match(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+([\\/].*)?$/);
  if (win) return '~' + (win[1] ?? '').replace(/\\/g, '/');
  return path;
}

/**
 * Returns a shallow copy with every string-typed field redacted by
 * [`redactHomePath`]. Non-string values pass through unchanged.
 */
export function sanitizeContextRecord<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') {
      out[k] = redactHomePath(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
