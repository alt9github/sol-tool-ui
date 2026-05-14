import { create } from 'zustand';
import type { CrashKind, CrashRecord } from '../types';

/**
 * Crash capture store + `window.error` / `unhandledrejection` listener helpers.
 * The host tool is expected to:
 *   1. call `installCrashListeners()` once during app startup
 *   2. forward `<ErrorBoundary>` failures to [`reportReactCrash`]
 *   3. (optional) drain `crash-logs/*.json` from the Tauri panic hook into
 *      `useCrashStore.getState().push(...)` on launch
 *
 * Same-fingerprint repeats increment `count` instead of stacking pending
 * entries, so the UI shows one prompt for "the same crash, three times".
 */

interface CrashState {
  /** Crashes the user hasn't dismissed or filed yet. */
  pending: CrashRecord[];
  /** The crash currently being edited inside `<ReportDialog>`. */
  active: CrashRecord | null;

  push: (
    input: Omit<CrashRecord, 'id' | 'count' | 'timestamp'> & { timestamp?: string },
  ) => void;
  dismiss: (id: string) => void;
  consume: (id: string) => void;
  setActive: (record: CrashRecord | null) => void;
  clear: () => void;
}

export const useCrashStore = create<CrashState>((set) => ({
  pending: [],
  active: null,

  push(input) {
    // Skip frame-only stacks that originate entirely inside framework/library
    // code (typically dev-only StrictMode noise) — nothing the user can act on.
    if (isFrameworkOnlyStack(input.stack)) {
      // eslint-disable-next-line no-console
      console.warn('[sol-tool-ui/crashStore] skipping framework-only stack:', input.message);
      return;
    }
    const fp = fingerprint(input.message, input.stack);
    set((s) => {
      const existing = s.pending.find((r) => r.id === fp);
      if (existing) {
        return {
          pending: s.pending.map((r) =>
            r.id === fp ? { ...r, count: r.count + 1 } : r,
          ),
        };
      }
      const record: CrashRecord = {
        id: fp,
        kind: input.kind as CrashKind,
        message: input.message,
        stack: input.stack ?? null,
        componentStack: input.componentStack ?? null,
        timestamp: input.timestamp ?? new Date().toISOString(),
        count: 1,
      };
      return { pending: [...s.pending, record] };
    });
  },

  dismiss(id) {
    set((s) => ({ pending: s.pending.filter((r) => r.id !== id) }));
  },

  consume(id) {
    set((s) => ({
      pending: s.pending.filter((r) => r.id !== id),
      active: s.active?.id === id ? null : s.active,
    }));
  },

  setActive(record) {
    set({ active: record });
  },

  clear() {
    set({ pending: [], active: null });
  },
}));

/** Push a React render-time crash into the store. */
export function reportReactCrash(error: Error, componentStack: string | null): void {
  useCrashStore.getState().push({
    kind: 'react',
    message: error.message || String(error),
    stack: error.stack ?? null,
    componentStack,
  });
}

let listenersInstalled = false;
/**
 * Install `window.error` + `window.unhandledrejection` listeners that feed
 * the store. Idempotent — calling again does nothing.
 */
export function installCrashListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;

  window.addEventListener('error', (ev) => {
    const err = (ev as ErrorEvent).error;
    const message = err instanceof Error ? err.message : (ev as ErrorEvent).message || '(no message)';
    const stack = err instanceof Error ? err.stack ?? null : null;
    useCrashStore.getState().push({
      kind: 'window',
      message,
      stack,
      componentStack: null,
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const r = (ev as PromiseRejectionEvent).reason;
    const message =
      r instanceof Error ? r.message : typeof r === 'string' ? r : JSON.stringify(r);
    const stack = r instanceof Error ? r.stack ?? null : null;
    useCrashStore.getState().push({
      kind: 'unhandledrejection',
      message,
      stack,
      componentStack: null,
    });
  });
}

/**
 * True if every stack line points at framework / dependency code. Such crashes
 * are typically dev StrictMode + third-party library interplay that release
 * builds never see — surfacing them to the user is noise.
 */
export function isFrameworkOnlyStack(stack: string | null | undefined): boolean {
  if (!stack) return false;
  const lines = stack.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return false;
  for (const l of lines) {
    if (l.includes('/src/') || l.includes('(src/')) return false;
  }
  const hasFrameworkMarker = lines.some(
    (l) =>
      l.includes('node_modules') || l.includes('chunk-') || l.includes('vite/deps'),
  );
  return hasFrameworkMarker;
}

/** Stable fingerprint id from message first line + top 5 stack frames. */
function fingerprint(message: string, stack: string | null | undefined): string {
  const firstLine = (message || '').split('\n')[0].trim().slice(0, 200);
  const firstFrames = (stack ?? '').split('\n').slice(1, 6).map((s) => s.trim()).join('|');
  return djb2(`${firstLine}\n${firstFrames}`);
}

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
