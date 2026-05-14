import { useEffect, useState } from 'react';
import { Button } from './Button';
import type {
  FeedbackInvokes,
  JiraConfig,
  JiraUser,
  ToastFn,
} from '../types';

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'valid'; user: JiraUser }
  | { kind: 'invalid'; reason: string }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'keyring-error'; reason: string };

function classifyVerifyError(msg: string): 'invalid' | 'unreachable' | 'keyring-error' {
  if (/OS keyring|keyring/i.test(msg)) return 'keyring-error';
  if (/\(401\)|\(403\)|Unauthorized|Forbidden/i.test(msg)) return 'invalid';
  return 'unreachable';
}

export interface JiraTokenSettingsProps {
  /** Current saved Jira config. `null` while still loading from host store. */
  jira: JiraConfig | null;

  /** Invoked when the user saves new credentials. Host should persist
   * `{baseUrl, email}` (token is stored separately via `invokes.jiraSetToken`). */
  onSave: (jira: JiraConfig) => Promise<void>;
  /** Invoked when the user clears the saved config (calls
   * `invokes.jiraClearToken` first if a token exists). */
  onClear: () => Promise<void>;

  invokes: FeedbackInvokes;

  /** Default Atlassian URL filled in when no saved settings exist. */
  defaultBaseUrl?: string;

  /** Optional — opens the host's "feedback help" article when the user
   * clicks the help link. */
  onOpenHelp?: () => void;

  toast?: ToastFn;
}

/**
 * Jira credential entry + connection verify section. Mirrors ME's
 * `<JiraSection>` shape; host-specific help links / hint strings are inject
 * points so each tool decorates its own context.
 */
export function JiraTokenSettings({
  jira,
  onSave,
  onClear,
  invokes,
  defaultBaseUrl = '',
  onOpenHelp,
  toast,
}: JiraTokenSettingsProps) {
  const [baseUrl, setBaseUrl] = useState(jira?.baseUrl ?? defaultBaseUrl);
  const [email, setEmail] = useState(jira?.email ?? '');
  const [token, setToken] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState<boolean | null>(null);
  const [keyringError, setKeyringError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const baseTrim = baseUrl.trim().replace(/\/$/, '');
  const emailTrim = email.trim();
  const canTest =
    baseTrim.length > 0 &&
    emailTrim.length > 0 &&
    (token.trim().length > 0 || hasStoredToken !== false);
  const canSave = verifyState.kind === 'valid';

  const runVerify = async (tokenArg: string | null) => {
    setVerifyState({ kind: 'verifying' });
    try {
      const user = await invokes.jiraTestConnection(baseTrim, emailTrim, tokenArg);
      setVerifyState({ kind: 'valid', user });
      if (tokenArg === null) setHasStoredToken(true);
    } catch (e) {
      const msg = String(e);
      const cls = classifyVerifyError(msg);
      setVerifyState({ kind: cls, reason: msg });
    }
  };

  // Bootstrap: token 존재 점검 + 저장된 설정 있으면 자동 verify.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await invokes
          .jiraHasToken()
          .catch((e) => {
            if (!cancelled) setKeyringError(String(e));
            return null;
          });
        if (cancelled) return;
        setHasStoredToken(stored?.has_token ?? null);
        if (jira?.baseUrl && jira?.email) {
          await runVerify(null);
        }
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    setVerifyState({ kind: 'idle' });
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, email, token]);

  const onTest = () => {
    setError(null);
    setSaved(false);
    const tokenArg = token.trim().length > 0 ? token.trim() : null;
    runVerify(tokenArg);
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (token.trim().length > 0) {
        await invokes.jiraSetToken(token.trim());
        setHasStoredToken(true);
        setToken('');
      }
      await onSave({ baseUrl: baseTrim, email: emailTrim });
      setSaved(true);
      toast?.('저장 완료', 'success');
    } catch (e) {
      setError(String(e));
    }
  };

  const handleClear = async () => {
    setError(null);
    try {
      await invokes.jiraClearToken();
      await onClear();
      setHasStoredToken(false);
      setVerifyState({ kind: 'idle' });
      setToken('');
      setSaved(false);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <section className="sol-ui-jira-settings">
      <VerifyBanner
        state={verifyState}
        hasStoredToken={hasStoredToken}
        keyringError={keyringError}
        hasSavedSettings={!!jira?.baseUrl}
        onOpenHelp={onOpenHelp}
      />

      <dl className="sol-ui-kv">
        <dt>Atlassian URL</dt>
        <dd>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaultBaseUrl || 'https://example.atlassian.net'}
            style={{ width: 320 }}
          />
        </dd>
        <dt>이메일</dt>
        <dd>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={{ width: 320 }}
            autoComplete="email"
          />
        </dd>
        <dt>API token</dt>
        <dd>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasStoredToken ? '저장된 토큰 사용 — 갱신만 입력' : '토큰 입력'}
            style={{ width: 320 }}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="sol-ui-hint" style={{ marginTop: 4 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                invokes
                  .openExternalUrl('https://id.atlassian.com/manage-profile/security/api-tokens')
                  .catch((err) => setError(`외부 브라우저 열기 실패: ${err}`));
              }}
            >
              토큰 발급 페이지 열기 ↗
            </a>
          </div>
        </dd>
      </dl>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button onClick={onTest} disabled={!canTest || verifyState.kind === 'verifying'}>
          {verifyState.kind === 'verifying' ? '확인 중...' : '연결 테스트'}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          저장
        </Button>
        {(hasStoredToken === true || !!jira?.baseUrl) && (
          <Button onClick={handleClear}>로그아웃 (토큰 삭제)</Button>
        )}
      </div>

      {error && (
        <div className="sol-ui-error" style={{ marginTop: 10 }}>에러: {error}</div>
      )}
      {saved && !error && (
        <div className="sol-ui-success" style={{ marginTop: 10 }}>저장 완료</div>
      )}
    </section>
  );
}

interface VerifyBannerProps {
  state: VerifyState;
  hasStoredToken: boolean | null;
  keyringError: string | null;
  hasSavedSettings: boolean;
  onOpenHelp?: () => void;
}

function VerifyBanner({
  state,
  hasStoredToken,
  keyringError,
  hasSavedSettings,
  onOpenHelp,
}: VerifyBannerProps) {
  if (state.kind === 'verifying') {
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--verifying">
        ⋯ 저장된 자격으로 연결 확인 중...
      </div>
    );
  }
  if (state.kind === 'valid') {
    const u = state.user;
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--valid">
        ✓ 연결됨 — <code>{u.displayName}</code>
        {u.emailAddress && <> ({u.emailAddress})</>} · accountId:{' '}
        <code>{u.accountId}</code>
      </div>
    );
  }
  if (state.kind === 'invalid') {
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--invalid">
        ✗ 토큰이 유효하지 않습니다 — 만료 / 회수 / 이메일 오타 가능. 새 토큰을 발급해
        다시 입력해 주세요.
        {onOpenHelp && (
          <>
            {' '}
            <button type="button" className="sol-ui-link-btn" onClick={onOpenHelp}>
              재발급 가이드 ↗
            </button>
          </>
        )}
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>원본 응답</summary>
          <code style={{ fontSize: 11 }}>{state.reason}</code>
        </details>
      </div>
    );
  }
  if (state.kind === 'unreachable') {
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--unreachable">
        ⚠ Atlassian 서버에 도달하지 못했습니다 — 네트워크 / 프록시 / VPN 확인 후 다시
        시도. 토큰 자체는 유효할 수 있음.
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>원본 응답</summary>
          <code style={{ fontSize: 11 }}>{state.reason}</code>
        </details>
      </div>
    );
  }
  if (state.kind === 'keyring-error') {
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--unreachable">
        ⚠ OS keyring 에서 토큰을 읽지 못했습니다. 토큰을 다시 입력하고 "연결 테스트" 가
        통과하면 해당 세션은 사용 가능.
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>원본 응답</summary>
          <code style={{ fontSize: 11 }}>{state.reason}</code>
        </details>
      </div>
    );
  }
  // idle.
  if (keyringError) {
    return (
      <div className="sol-ui-jira-verify sol-ui-jira-verify--unreachable">
        ⚠ OS keyring 접근 실패 — "연결 테스트" 또는 토큰 재입력 후 저장 시도.
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>원본 응답</summary>
          <code style={{ fontSize: 11 }}>{keyringError}</code>
        </details>
      </div>
    );
  }
  if (hasSavedSettings && hasStoredToken !== false) {
    return null;
  }
  return (
    <div className="sol-ui-jira-verify sol-ui-jira-verify--idle">
      토큰 미저장 — 아래 발급 페이지에서 token 받아 입력 후 "연결 테스트".
    </div>
  );
}
