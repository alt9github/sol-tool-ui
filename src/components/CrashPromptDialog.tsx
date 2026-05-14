import { useEffect } from 'react';
import { Button } from './Button';
import { useCrashStore } from '../stores/crashStore';
import type { CrashRecord } from '../types';

/**
 * Auto-displayed prompt that surfaces every `pending` crash captured by the
 * shared crash store. The host wires it once near the application root —
 * choosing "리포트 등록" sets `active` so the host's `<ReportDialog>`
 * gateway opens with prefill.
 */
export interface CrashPromptDialogProps {
  /**
   * Called when the user clicks "리포트 등록" — host typically (a) verifies
   * Jira auth, then (b) opens its `<ReportDialog>`. Defaults to setting
   * crash store active so a `<ReportDialog crash={active}>` opens on its own.
   */
  onReport?: (record: CrashRecord) => void;
}

export function CrashPromptDialog({ onReport }: CrashPromptDialogProps = {}) {
  const pending = useCrashStore((s) => s.pending);
  const dismiss = useCrashStore((s) => s.dismiss);
  const setActive = useCrashStore((s) => s.setActive);
  const clear = useCrashStore((s) => s.clear);

  const open = pending.length > 0;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pending.length > 0) {
        dismiss(pending[pending.length - 1].id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, pending, dismiss]);

  const handleReport = (r: CrashRecord) => {
    if (onReport) {
      onReport(r);
    } else {
      setActive(r);
    }
  };

  if (!open) return null;

  return (
    <div
      className="sol-ui-crash-prompt-overlay"
      role="dialog"
      aria-live="polite"
    >
      <div className="sol-ui-crash-prompt">
        <header className="sol-ui-crash-prompt-header">
          <h3>{pending.length}건의 오류가 발견되었습니다</h3>
          <Button variant="text" onClick={clear} title="모두 무시">✕</Button>
        </header>
        <ul className="sol-ui-crash-prompt-list">
          {pending.map((r) => (
            <li key={r.id} className="sol-ui-crash-prompt-item">
              <div className="sol-ui-crash-prompt-meta">
                <span
                  className={`sol-ui-crash-prompt-kind sol-ui-crash-prompt-kind--${r.kind}`}
                >
                  {labelForKind(r.kind)}
                </span>
                {r.count > 1 && (
                  <span className="sol-ui-crash-prompt-count">×{r.count}</span>
                )}
                <span className="sol-ui-crash-prompt-time">{shortTime(r.timestamp)}</span>
              </div>
              <div className="sol-ui-crash-prompt-message">
                <code>{firstLine(r.message)}</code>
              </div>
              {r.stack && (
                <details>
                  <summary>stack</summary>
                  <pre className="sol-ui-crash-prompt-stack">{r.stack}</pre>
                </details>
              )}
              <div className="sol-ui-crash-prompt-actions">
                <Button onClick={() => dismiss(r.id)}>무시</Button>
                <Button variant="primary" onClick={() => handleReport(r)}>
                  리포트 등록
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="sol-ui-hint">
          리포트 등록은 stack trace + 환경 정보를 자동 첨부합니다. 등록 전 다이얼로그에서
          내용을 확인 / 수정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function labelForKind(k: CrashRecord['kind']): string {
  switch (k) {
    case 'react': return 'React';
    case 'window': return 'Runtime';
    case 'unhandledrejection': return 'Promise';
  }
}

function firstLine(msg: string): string {
  const line = msg.split('\n')[0].trim();
  return line.length > 200 ? line.slice(0, 200) + '…' : line;
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
}
