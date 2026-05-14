import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { useCrashStore } from '../stores/crashStore';
import {
  checkSubmitAllowed,
  formatRetryAfter,
  recordSubmit,
} from '../utils/rateLimit';
import { sanitizeContextRecord } from '../utils/sanitize';
import type {
  CrashRecord,
  CreatedIssue,
  FeedbackInvokes,
  FeedbackToolConfig,
  JiraConfig,
  JiraIssuePayload,
  JiraIssueSummary,
  ToastFn,
} from '../types';

/**
 * Feedback / report submission dialog. Mirrors the ME upstream surface but
 * receives all integration points as props — no zustand / store imports
 * outside the bundled crash store.
 */
export interface ReportDialogProps {
  open: boolean;
  onClose: () => void;

  jira: JiraConfig;
  tool: FeedbackToolConfig;
  invokes: FeedbackInvokes;

  /** Optional crash record for prefill. If supplied (typically via crashStore
   * `active`), the title / description / labels populate accordingly. */
  crash?: CrashRecord | null;

  /** Optional workstream value (e.g. derived from `p4 stream`). Sent in the
   * issue payload's `work_stream` field. */
  workStream?: string | null;

  /** Host-supplied: open the host's Jira settings page (e.g. for token entry). */
  onOpenJiraSettings: () => void;

  /** Optional toast — used for success / clipboard feedback. */
  toast?: ToastFn;
}

type Kind = 'bug' | 'improvement';

export function ReportDialog({
  open,
  onClose,
  jira,
  tool,
  invokes,
  crash,
  workStream,
  onOpenJiraSettings,
  toast,
}: ReportDialogProps) {
  // ME 의 ReportDialog 가 activeCrash 를 crashStore 의 active 와 직접 연결.
  // 본 컴포넌트도 store 의 active 와 props 로 들어온 crash 양쪽 호환:
  // crash prop 이 있으면 그것 우선, 없으면 store 의 active.
  const storeActive = useCrashStore((s) => s.active);
  const consumeCrash = useCrashStore((s) => s.consume);
  const setStoreActive = useCrashStore((s) => s.setActive);
  const activeCrash = crash ?? storeActive;

  const [kind, setKind] = useState<Kind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState<string>('');
  const [includeContext, setIncludeContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<CreatedIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean | null>(null);
  const [contextRecord, setContextRecord] = useState<Record<string, unknown> | null>(null);
  const [dedupCandidates, setDedupCandidates] = useState<JiraIssueSummary[]>([]);
  const [dedupSearching, setDedupSearching] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentBody, setCommentBody] = useState('');

  // Auth + autoContext on open.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitted(null);
    let cancelled = false;
    (async () => {
      const [tokRes, ctx] = await Promise.all([
        invokes.jiraHasToken().catch(() => ({ has_token: false })),
        tool.autoContext ? Promise.resolve(tool.autoContext()).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setAuthReady(tokRes.has_token === true && !!jira.baseUrl && !!jira.email);
      setContextRecord(ctx as Record<string, unknown> | null);
    })();
    return () => { cancelled = true; };
  }, [open, jira.baseUrl, jira.email, invokes, tool]);

  // Crash prefill.
  useEffect(() => {
    if (!open || !activeCrash) return;
    setKind('bug');
    setTitle(`[Crash] ${firstLineShort(activeCrash.message)}`);
    setDescription(buildCrashDescription(activeCrash));
    setArea('');
    setError(null);
    setSubmitted(null);
    setDedupCandidates([]);
    setCommenting(false);
    setCommentBody('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCrash?.id]);

  // Dedup hint search — same fingerprint label.
  useEffect(() => {
    if (!open || !activeCrash || !authReady || !jira.baseUrl || !jira.email) return;
    let cancelled = false;
    setDedupSearching(true);
    invokes
      .jiraSearchByLabel(jira.baseUrl, jira.email, `fingerprint:${activeCrash.id}`)
      .then((hits) => { if (!cancelled) setDedupCandidates(hits); })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[ReportDialog] dedup search failed:', e);
        if (!cancelled) setDedupCandidates([]);
      })
      .finally(() => { if (!cancelled) setDedupSearching(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCrash?.id, authReady]);

  // Esc close.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  // Sanitized auto-context dump (string).
  const autoContextStr = useMemo(() => {
    if (!includeContext || !contextRecord) return null;
    const sanitized = sanitizeContextRecord(contextRecord);
    return JSON.stringify(sanitized, null, 2);
  }, [includeContext, contextRecord]);

  const canSubmit = !!authReady && title.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const limit = checkSubmitAllowed();
    if (!limit.allowed) {
      setError(
        `등록이 너무 잦습니다. ${formatRetryAfter(limit.retryAfterMs)} 후 다시 시도하세요. (직전 60초에 ${limit.countInWindow}건)`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const labels = [tool.sourceLabel, `kind:${kind}`];
      if (activeCrash) {
        labels.push('kind:crash');
        labels.push(`fingerprint:${activeCrash.id}`);
      }
      if (area) labels.push(`area:${area}`);
      const payload: JiraIssuePayload = {
        project_key: tool.projectKey,
        issue_type_name: tool.issueTypeName,
        summary: title.trim(),
        description: description.trim(),
        parent_key: kind === 'bug' ? tool.parentBugKey : tool.parentImprovementKey,
        labels,
        work_stream: workStream ?? null,
        auto_context: autoContextStr,
      };
      const created = await invokes.jiraCreateIssue(jira.baseUrl, jira.email, payload);
      setSubmitted(created);
      recordSubmit();
      if (activeCrash) consumeCrash(activeCrash.id);
      navigator.clipboard?.writeText(`${created.key} ${created.url}`).catch(() => undefined);
      toast?.(`리포트 등록: ${created.key} (URL 클립보드 복사)`, 'success', 8000);
    } catch (e) {
      const msg = String(e);
      if (/\(401\)|\(403\)|Unauthorized|Forbidden/i.test(msg)) {
        setError('Jira 토큰이 무효합니다 (revoke / 만료). Settings 에서 재발급 후 다시 시도하세요.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthError =
    error != null && /\(401\)|\(403\)|무효|Unauthorized|Forbidden/i.test(error);

  const onAddComment = async (target: JiraIssueSummary) => {
    if (!activeCrash) return;
    if (commentBody.trim().length === 0) {
      setError('코멘트 내용을 입력해 주세요.');
      return;
    }
    setCommenting(true);
    setError(null);
    try {
      const body = autoContextStr
        ? `${commentBody.trim()}\n\n--- 자동 컨텍스트 ---\n${autoContextStr}`
        : commentBody.trim();
      await invokes.jiraAddComment(jira.baseUrl, jira.email, target.key, body);
      consumeCrash(activeCrash.id);
      toast?.(`코멘트 추가: ${target.key}`, 'success', 6000);
      setSubmitted({ key: target.key, id: '', url: target.url });
    } catch (e) {
      setError(`코멘트 추가 실패: ${String(e)}`);
    } finally {
      setCommenting(false);
    }
  };

  const handleClose = () => {
    if (activeCrash) setStoreActive(null);
    onClose();
  };

  const onOpenSettingsAndClose = () => {
    handleClose();
    onOpenJiraSettings();
  };

  if (!open) return null;

  return (
    <div
      className="sol-ui-modal-overlay"
      onMouseDown={() => { if (!submitting) handleClose(); }}
    >
      <div
        className="sol-ui-modal sol-ui-report-dialog"
        style={{ width: 640 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sol-ui-modal-header">
          <h3 className="sol-ui-modal-title">피드백 / 리포트 등록</h3>
          <Button variant="text" onClick={handleClose} aria-label="닫기" disabled={submitting}>✕</Button>
        </div>

        <div className="sol-ui-modal-body">
          {authReady === false && (
            <div className="sol-ui-auth-warn">
              ⚠ Jira 인증이 설정되지 않았습니다.{' '}
              <button
                type="button"
                className="sol-ui-link-btn"
                onClick={onOpenSettingsAndClose}
              >
                Settings → 피드백 으로 이동 ↗
              </button>
            </div>
          )}

          {!submitted && activeCrash && dedupCandidates.length > 0 && (
            <DedupHintBanner
              candidates={dedupCandidates}
              commenting={commenting}
              commentBody={commentBody}
              onCommentBodyChange={setCommentBody}
              onAddComment={onAddComment}
              openExternalUrl={invokes.openExternalUrl}
            />
          )}
          {!submitted && activeCrash && dedupSearching && (
            <div className="sol-ui-dedup-searching">
              같은 fingerprint 의 기존 issue 검색 중…
            </div>
          )}

          {submitted ? (
            <SubmittedView
              created={submitted}
              onClose={handleClose}
              onNew={() => {
                setSubmitted(null);
                setTitle('');
                setDescription('');
                setArea('');
                setError(null);
              }}
              openExternalUrl={invokes.openExternalUrl}
            />
          ) : (
            <div className="sol-ui-report-body">
              <div className="sol-ui-report-row">
                <label>종류</label>
                <div className="sol-ui-report-radio">
                  <label>
                    <input
                      type="radio"
                      checked={kind === 'bug'}
                      onChange={() => setKind('bug')}
                    />{' '}
                    버그
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={kind === 'improvement'}
                      onChange={() => setKind('improvement')}
                    />{' '}
                    개선 / 요청
                  </label>
                </div>
              </div>

              <div className="sol-ui-report-row">
                <label htmlFor="sol-ui-rd-title">제목</label>
                <input
                  id="sol-ui-rd-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="간단한 한 줄 요약 (필수)"
                  maxLength={200}
                />
              </div>

              <div className="sol-ui-report-row">
                <label htmlFor="sol-ui-rd-desc">설명</label>
                <textarea
                  id="sol-ui-rd-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="재현 절차 / 기대 동작 / 실제 동작. 빈 줄로 단락 구분."
                  rows={6}
                />
              </div>

              <div className="sol-ui-report-row">
                <label htmlFor="sol-ui-rd-area">영역 (선택)</label>
                <select
                  id="sol-ui-rd-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  {tool.areaOptions.map((a) => (
                    <option key={a} value={a}>
                      {a || '(미지정)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sol-ui-report-row">
                <label>자동 컨텍스트</label>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={includeContext}
                      onChange={(e) => setIncludeContext(e.target.checked)}
                    />{' '}
                    버전 / OS / 환경 정보를 description 끝에 첨부
                  </label>
                  {includeContext && autoContextStr && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                        미리보기
                      </summary>
                      <pre className="sol-ui-report-context-preview">
                        {autoContextStr}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {error && (
                <div className="sol-ui-error" style={{ marginTop: 6 }}>
                  등록 실패: {error}
                  {isAuthError && (
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        className="sol-ui-link-btn"
                        onClick={onOpenSettingsAndClose}
                      >
                        Settings → 피드백 으로 이동 ↗
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!submitted && (
          <div className="sol-ui-modal-footer">
            <span className="sol-ui-hint" style={{ marginRight: 'auto' }}>
              → {kind === 'bug'
                ? `Bug · ${tool.parentBugKey}`
                : `Improvement · ${tool.parentImprovementKey}`}
              {workStream && <> · 작업스트림: <code>{workStream}</code></>}
            </span>
            <Button onClick={handleClose} disabled={submitting}>취소</Button>
            <Button variant="primary" onClick={onSubmit} disabled={!canSubmit}>
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmittedView({
  created,
  onClose,
  onNew,
  openExternalUrl,
}: {
  created: CreatedIssue;
  onClose: () => void;
  onNew: () => void;
  openExternalUrl: (url: string) => Promise<void>;
}) {
  return (
    <div className="sol-ui-report-body">
      <div className="sol-ui-success">✓ 리포트가 등록되었습니다.</div>
      <dl className="sol-ui-kv">
        <dt>Issue</dt>
        <dd><code>{created.key}</code></dd>
        <dt>URL</dt>
        <dd>
          <button
            type="button"
            className="sol-ui-link-btn"
            onClick={() => openExternalUrl(created.url)}
          >
            {created.url} ↗
          </button>
        </dd>
      </dl>
      <p className="sol-ui-hint">URL 은 클립보드에도 복사되었습니다.</p>
      <div className="sol-ui-report-actions">
        <Button onClick={onNew}>리포트 추가 등록</Button>
        <Button variant="primary" onClick={onClose}>닫기</Button>
      </div>
    </div>
  );
}

function buildCrashDescription(crash: CrashRecord): string {
  const lines: string[] = [];
  lines.push(`자동 캡처된 ${labelForCrashKind(crash.kind)} 오류입니다.`);
  if (crash.count > 1) lines.push(`(같은 fingerprint 의 반복 발생: ${crash.count}회)`);
  lines.push('');
  lines.push(`에러 메시지:`);
  lines.push(crash.message);
  if (crash.stack) {
    lines.push('');
    lines.push(`스택:`);
    lines.push('```');
    lines.push(crash.stack);
    lines.push('```');
  }
  if (crash.componentStack) {
    lines.push('');
    lines.push(`React component stack:`);
    lines.push('```');
    lines.push(crash.componentStack);
    lines.push('```');
  }
  lines.push('');
  lines.push('--- 추가 메모 ---');
  return lines.join('\n');
}

function labelForCrashKind(k: CrashRecord['kind']): string {
  switch (k) {
    case 'react':
      return 'React render';
    case 'window':
      return 'Runtime';
    case 'unhandledrejection':
      return 'Promise rejection';
  }
}

function firstLineShort(msg: string): string {
  const line = (msg || '').split('\n')[0].trim();
  return line.length > 80 ? line.slice(0, 80) + '…' : line;
}

function DedupHintBanner({
  candidates,
  commenting,
  commentBody,
  onCommentBodyChange,
  onAddComment,
  openExternalUrl,
}: {
  candidates: JiraIssueSummary[];
  commenting: boolean;
  commentBody: string;
  onCommentBodyChange: (v: string) => void;
  onAddComment: (target: JiraIssueSummary) => void;
  openExternalUrl: (url: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const primary = candidates[0];
  return (
    <div className="sol-ui-dedup">
      <div className="sol-ui-dedup-header">
        <span className="sol-ui-dedup-title">
          ⚠ 같은 crash 가 이미 등록되어 있습니다 ({candidates.length}건)
        </span>
        <span className="sol-ui-dedup-meta">
          중복 등록 대신 코멘트로 추가하면 트리아지에 도움 ↓
        </span>
      </div>
      <ul className="sol-ui-dedup-list">
        {(expanded ? candidates : candidates.slice(0, 1)).map((c) => (
          <li key={c.key}>
            <button
              type="button"
              className="sol-ui-link-btn"
              onClick={() => openExternalUrl(c.url).catch(() => undefined)}
            >
              <code>{c.key}</code>
            </button>
            <span className="sol-ui-dedup-status">[{c.status}]</span>
            <span className="sol-ui-dedup-summary">{c.summary}</span>
          </li>
        ))}
      </ul>
      {candidates.length > 1 && (
        <button
          type="button"
          className="sol-ui-link-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '접기' : `... 외 ${candidates.length - 1}건 보기`}
        </button>
      )}
      <div className="sol-ui-dedup-comment">
        <label htmlFor="sol-ui-dedup-comment">코멘트로 추가</label>
        <textarea
          id="sol-ui-dedup-comment"
          value={commentBody}
          onChange={(e) => onCommentBodyChange(e.target.value)}
          placeholder="추가 발생 정보 / 재현 조건 등 — 자동 컨텍스트가 함께 첨부됩니다."
          rows={3}
          disabled={commenting}
        />
        <Button
          variant="primary"
          onClick={() => onAddComment(primary)}
          disabled={commenting || commentBody.trim().length === 0}
          title={`${primary.key} 에 코멘트 추가`}
        >
          {commenting ? '추가 중…' : `${primary.key} 에 코멘트 추가`}
        </Button>
      </div>
    </div>
  );
}
