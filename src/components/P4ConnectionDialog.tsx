import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import type {
  DiagnosticsLike,
  P4ConnectionSettings,
  P4Workspace,
  ToastFn,
} from '../types';

export interface P4ConnectionDialogProps {
  open: boolean;
  onClose: () => void;

  /** Saved connection (server / user / client). Used to prefill the form. */
  initial?: Partial<P4ConnectionSettings>;
  /** Default P4 server suggestion when no saved value. */
  defaultServer?: string;

  /** Host's diagnostics — used to highlight the workspace matching the
   * current project root. Pass `null` to disable matching. */
  diagnostics?: DiagnosticsLike | null;

  /** Host adapter: list workspaces matching server/user (`p4 clients -u <u>`). */
  onListWorkspaces: (server: string, user: string) => Promise<P4Workspace[]>;
  /** Host adapter: activate the connection (`p4 set` or sol-p4-tools::set_p4_connection). */
  onApplyConnection: (settings: P4ConnectionSettings) => Promise<void>;

  /** Optional host-supplied toast. If omitted, errors are surfaced inline only. */
  toast?: ToastFn;

  /** Called after a successful apply. Host typically re-runs diagnostics here. */
  onApplied?: (selected: P4Workspace) => void;
}

const FALLBACK_SERVER = '';

export function P4ConnectionDialog({
  open,
  onClose,
  initial,
  defaultServer = FALLBACK_SERVER,
  diagnostics,
  onListWorkspaces,
  onApplyConnection,
  toast,
  onApplied,
}: P4ConnectionDialogProps) {
  const [server, setServer] = useState(initial?.server || defaultServer);
  const [user, setUser] = useState(initial?.user ?? '');
  const [workspaces, setWorkspaces] = useState<P4Workspace[]>([]);
  const [selectedClient, setSelectedClient] = useState(initial?.client ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServer(initial?.server || defaultServer);
    setUser(initial?.user ?? '');
    setSelectedClient(initial?.client ?? '');
    setWorkspaces([]);
    setError(null);
    setApplied(false);
  }, [open, initial, defaultServer]);

  const projectRoot = diagnostics?.chosen_project_root ?? null;

  function rootContainsProject(root: string, project: string | null): boolean {
    if (!project) return false;
    const r = root.replace(/\\/g, '/').toLowerCase();
    const p = project.replace(/\\/g, '/').toLowerCase();
    return p === r || p.startsWith(r + '/');
  }

  const sortedWorkspaces = projectRoot
    ? [...workspaces].sort((a, b) => {
        const am = rootContainsProject(a.root, projectRoot) ? 0 : 1;
        const bm = rootContainsProject(b.root, projectRoot) ? 0 : 1;
        return am - bm;
      })
    : workspaces;

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const ws = await onListWorkspaces(server.trim(), user.trim());
      setWorkspaces(ws);
      const auto = ws.find((w) => rootContainsProject(w.root, projectRoot));
      if (auto) setSelectedClient(auto.name);
      else if (ws.length > 0 && !selectedClient) setSelectedClient(ws[0].name);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      toast?.(`p4 clients 실패: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!selectedClient || applied) return;
    setApplied(true);
    try {
      const settings: P4ConnectionSettings = {
        server: server.trim(),
        user: user.trim(),
        client: selectedClient.trim(),
      };
      await onApplyConnection(settings);
      const selected = workspaces.find((w) => w.name === selectedClient);
      toast?.(`P4 워크스페이스 적용: ${selectedClient}`, 'success');
      if (selected) onApplied?.(selected);
      onClose();
    } catch (e) {
      setApplied(false);
      const msg = String(e);
      toast?.(`set_p4_connection 실패: ${msg}`, 'error');
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="P4 워크스페이스 변경"
      width={640}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={apply} disabled={!selectedClient || applied}>
            적용
          </Button>
        </>
      }
    >
      {projectRoot && (
        <div className="sol-ui-hint" style={{ marginBottom: 12 }}>
          현재 작업 디렉토리: <code>{projectRoot}</code>
          <br />
          이 경로를 client root 로 갖는 워크스페이스를 선택해 주세요.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <label className="sol-ui-field" style={{ flex: 1 }}>
          <span className="sol-ui-field-label">P4 Server</span>
          <input
            className="sol-ui-field-input"
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder={defaultServer}
          />
        </label>
        <label className="sol-ui-field" style={{ flex: 1 }}>
          <span className="sol-ui-field-label">P4 User</span>
          <input
            className="sol-ui-field-input"
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="P4USER (필수)"
          />
        </label>
        <Button onClick={fetchWorkspaces} disabled={loading}>
          {loading ? '조회 중…' : '워크스페이스 조회'}
        </Button>
      </div>

      {error && <div className="sol-ui-error">{error}</div>}

      {workspaces.length > 0 && (
        <div className="sol-ui-list" role="listbox" aria-label="워크스페이스 목록" style={{ marginTop: 12 }}>
          <div className="sol-ui-list-header">
            <span>이름</span>
            <span>스트림</span>
            <span>Root</span>
          </div>
          {sortedWorkspaces.map((w) => {
            const matches = rootContainsProject(w.root, projectRoot);
            const selected = w.name === selectedClient;
            return (
              <div
                key={w.name}
                role="option"
                aria-selected={selected}
                className={
                  'sol-ui-list-item' +
                  (selected ? ' is-selected' : '') +
                  (matches ? ' is-matches' : '')
                }
                onClick={() => setSelectedClient(w.name)}
                onDoubleClick={() => {
                  setSelectedClient(w.name);
                  void apply();
                }}
                title={matches ? '현재 작업 디렉토리와 일치' : ''}
              >
                <span>
                  {matches && <span className="sol-ui-match-badge" aria-label="일치">✓</span>}
                  {w.name}
                </span>
                <span>{w.stream || '—'}</span>
                <span><code>{w.root}</code></span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/**
 * Pure helper — true if the host's diagnostics says the active P4 client
 * doesn't contain the project root. Useful at startup: open
 * `P4ConnectionDialog` automatically when mismatch is detected.
 */
export function isP4ClientMismatch(diag: DiagnosticsLike | null | undefined): boolean {
  if (!diag) return false;
  if (!diag.chosen_project_root) return false;
  return diag.client_matches_exe === false;
}
