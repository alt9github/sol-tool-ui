import { useEffect, useState } from 'react';
import { Button } from './Button';
import type { ConfirmFn, P4Change, P4SyncResult, ToastFn } from '../types';

export interface SyncPromptDialogProps {
  open: boolean;
  onClose: () => void;

  /** depot 가 더 최신인 file 목록. ME 의 `staleFiles` 와 동일. 디스플레이
   * 문자열 (`"//foo.json (local #5 < depot #7)"`) 도 허용 — `' ('` 앞부분이
   * depot path 로 추출되어 `onSyncFiles` 에 전달. */
  staleFiles: string[];
  /** 다른 사용자가 편집 중인 파일 (sync 대상 아님 — 정보 표시만). */
  concurrentFiles: string[];
  /** Pending changelist 요약 — file 목록보다 CL 단위로 보여줄 때 사용. */
  pendingChanges?: P4Change[];
  /** Binary 자기 업데이트 가능 시 표시 라벨 ("metadata-editor.exe v0.4 → v0.5" 등).
   * null 이면 self-update 섹션 미노출. */
  staleBinary?: string | null;

  /** 도구 측 미저장 변경 수 — > 0 이면 self-update 비활성. */
  dirtyCount?: number;

  /** Host adapter: 선택된 depot path 들 sync. sol-p4-tools::p4_sync 호출. */
  onSyncFiles: (paths: string[]) => Promise<P4SyncResult>;
  /** Host adapter: sync 후 외부 변경 재검사. 결과로 UI 가 store 갱신을 가정. */
  onRecheckFreshness: () => Promise<{ stale: number; concurrent: number }>;
  /** Host adapter: 자기 binary 업데이트 + 재시작. 호출 직후 프로세스 종료 예상. */
  onUpdateSelf?: () => Promise<void>;

  /** 확인 dialog (자기 업데이트 진행 전 사용). 미공급 시 self-update 즉시 진행. */
  confirm?: ConfirmFn;
  /** Toast (선택). */
  toast?: ToastFn;
}

const FILE_LIST_LIMIT = 30;

export function SyncPromptDialog({
  open,
  onClose,
  staleFiles,
  concurrentFiles,
  pendingChanges = [],
  staleBinary,
  dirtyCount = 0,
  onSyncFiles,
  onRecheckFreshness,
  onUpdateSelf,
  confirm,
  toast,
}: SyncPromptDialogProps) {
  const [showFileList, setShowFileList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<P4SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, busy, onClose]);

  if (!open) return null;

  const onSync = async () => {
    if (staleFiles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // display 문자열 ("//foo (local #5 < depot #7)") 의 ` (` 앞 depot path 추출.
      const depotPaths = staleFiles
        .map((f) => f.split(' (')[0].trim())
        .filter((p) => p.length > 0);
      const r = await onSyncFiles(depotPaths);
      setResult(r);
      const recheck = await onRecheckFreshness();
      if (r.errors.length > 0) {
        toast?.(
          `${r.updated.length}건 sync · ${r.errors.length}건 실패. 재검사: stale ${recheck.stale} / concurrent ${recheck.concurrent}.`,
          'warn',
          10000,
        );
      } else {
        toast?.(
          `${r.updated.length}건 sync 완료${
            r.already_current.length > 0 ? ` · ${r.already_current.length}건 이미 최신` : ''
          }.`,
          'success',
          6000,
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onUpdateClicked = async () => {
    if (!staleBinary || !onUpdateSelf) return;
    if (dirtyCount > 0) {
      toast?.(`미저장 변경 ${dirtyCount}건. 저장 또는 폐기 후 업데이트.`, 'warn', 8000);
      return;
    }
    if (confirm) {
      const ok = await confirm({
        title: '도구 업데이트 후 재시작',
        body: `새 버전이 P4 에 있습니다.\n\n${staleBinary}\n\n업데이트:\n1. 현재 binary 를 .old 로 이름 변경 (Windows lock 우회)\n2. p4 sync 로 새 binary 받기\n3. 새 binary 실행 + 현재 프로세스 종료\n4. (다음 시작 시) .old 자동 정리\n\n계속하시겠습니까?`,
        okLabel: '업데이트 + 재시작',
        cancelLabel: '취소',
        kind: 'warn',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await onUpdateSelf();
    } catch (e) {
      setBusy(false);
      setError(String(e));
    }
  };

  return (
    <div className="sol-ui-modal-overlay" onMouseDown={() => { if (!busy) onClose(); }}>
      <div
        className="sol-ui-modal"
        style={{ width: 640 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sol-ui-modal-header">
          <h3 className="sol-ui-modal-title">외부 변경 감지</h3>
          <Button variant="text" onClick={onClose} aria-label="닫기" disabled={busy}>✕</Button>
        </div>

        <div className="sol-ui-modal-body">
          {staleBinary && onUpdateSelf && (
            <section className="sol-ui-section">
              <h4>🔄 도구 업데이트 가능</h4>
              <p className="sol-ui-hint">새 버전이 P4 에 배포됨. 업데이트하면 자동으로 재시작.</p>
              <pre className="sol-ui-binary-info">{staleBinary}</pre>
              <Button
                variant="primary"
                onClick={onUpdateClicked}
                disabled={busy || dirtyCount > 0}
                title={
                  dirtyCount > 0 ? `미저장 변경 ${dirtyCount}건 — 저장/폐기 후 진행` : undefined
                }
              >
                업데이트 + 재시작
              </Button>
              {dirtyCount > 0 && (
                <span className="sol-ui-hint" style={{ marginLeft: 8 }}>
                  · 미저장 변경 {dirtyCount}건
                </span>
              )}
            </section>
          )}

          {staleFiles.length > 0 && (
            <section className="sol-ui-section">
              <h4>
                Depot 가 더 최신 (
                {pendingChanges.length > 0
                  ? `${pendingChanges.length} changelist${pendingChanges.length > 1 ? 's' : ''} · `
                  : ''}
                {staleFiles.length} files)
              </h4>
              <p className="sol-ui-hint">로컬이 뒤처져 있어 저장 시 stale 충돌 가능. 지금 sync 권장.</p>
              {pendingChanges.length > 0 ? (
                <ChangeList changes={pendingChanges} />
              ) : (
                <FileList files={staleFiles} />
              )}
              {pendingChanges.length > 0 && (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => setShowFileList((v) => !v)}
                  title={showFileList ? '파일 목록 숨기기' : '영향 받는 파일 보기'}
                >
                  {showFileList ? '▼ 파일 목록 숨기기' : `▶ 영향 받는 파일 보기 (${staleFiles.length})`}
                </Button>
              )}
              {pendingChanges.length > 0 && showFileList && <FileList files={staleFiles} />}
            </section>
          )}

          {concurrentFiles.length > 0 && (
            <section className="sol-ui-section">
              <h4>다른 사용자가 편집 중 ({concurrentFiles.length})</h4>
              <p className="sol-ui-hint">
                저장 시 충돌 가능 — 변경 영역이 겹치는지 사전 확인 권장. (도구는 이 파일을 자동 sync 하지 않음.)
              </p>
              <FileList files={concurrentFiles} />
            </section>
          )}

          {staleFiles.length === 0 && concurrentFiles.length === 0 && !staleBinary && (
            <div className="sol-ui-empty">감지된 외부 변경 없음.</div>
          )}

          {result && (
            <section className="sol-ui-section">
              <h4>Sync 결과</h4>
              <ul>
                {result.updated.length > 0 && <li>업데이트: {result.updated.length}</li>}
                {result.already_current.length > 0 && (
                  <li>이미 최신: {result.already_current.length}</li>
                )}
                {result.errors.length > 0 && (
                  <li>
                    실패 ({result.errors.length}):
                    <ul>
                      {result.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {result.errors.length > 5 && <li>...외 {result.errors.length - 5}건</li>}
                    </ul>
                  </li>
                )}
              </ul>
            </section>
          )}

          {error && <div className="sol-ui-error">{error}</div>}
        </div>

        <div className="sol-ui-modal-footer">
          <Button onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button
            variant="primary"
            onClick={onSync}
            disabled={busy || staleFiles.length === 0}
            title={staleFiles.length === 0 ? 'sync 할 파일 없음' : `${staleFiles.length}건 sync`}
          >
            {busy ? 'Sync 중…' : `지금 sync (${staleFiles.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileList({ files }: { files: string[] }) {
  const visible = files.slice(0, FILE_LIST_LIMIT);
  return (
    <ul className="sol-ui-file-list">
      {visible.map((f) => (
        <li key={f} title={f}>
          {shorten(f)}
        </li>
      ))}
      {files.length > visible.length && (
        <li className="sol-ui-hint">...외 {files.length - visible.length}건</li>
      )}
    </ul>
  );
}

function ChangeList({ changes }: { changes: P4Change[] }) {
  const visible = changes.slice(0, FILE_LIST_LIMIT);
  return (
    <ul className="sol-ui-change-list">
      {visible.map((c) => (
        <li key={c.number} title={`${formatTime(c.time)} · ${c.user}@${c.client}\n\n${c.description}`}>
          <span className="sol-ui-change-num">Change {c.number}</span>
          <span className="sol-ui-change-user">{c.userFullname || c.user}</span>
          <span className="sol-ui-change-desc">{c.description || '(설명 없음)'}</span>
        </li>
      ))}
      {changes.length > visible.length && (
        <li className="sol-ui-hint">...외 {changes.length - visible.length}건</li>
      )}
    </ul>
  );
}

function shorten(p: string): string {
  if (p.length <= 80) return p;
  return p.slice(0, 30) + '…' + p.slice(-50);
}

function formatTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
