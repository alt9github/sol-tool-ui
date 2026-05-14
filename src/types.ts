/**
 * Shared types used across sol-tool-ui components. Mirrors the Tauri command
 * payloads exposed by `sol-p4-tools` / `sol-feedback-tools`.
 */

export interface P4Workspace {
  name: string;
  stream: string;
  root: string;
}

export interface P4Change {
  number: number;
  user: string;
  userFullname: string;
  client: string;
  time: number; // unix epoch seconds
  description: string;
}

export interface P4SyncResult {
  updated: string[];
  already_current: string[];
  errors: string[];
  raw_stderr: string;
}

export interface DiagnosticsLike {
  /** Resolved project root the tool is using (host-resolved). */
  chosen_project_root?: string | null;
  /** Whether the active P4 client root contains the project root. */
  client_matches_exe?: boolean;
}

export interface P4ConnectionSettings {
  server: string;
  user: string;
  client: string;
}

export type ToastFn = (
  message: string,
  kind?: 'info' | 'success' | 'warn' | 'error',
  durationMs?: number,
) => void;

export type ConfirmFn = (opts: {
  title: string;
  body: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: 'info' | 'warn' | 'error';
}) => Promise<boolean>;

// ─── Feedback / Jira ────────────────────────────────────────────────────

export type CrashKind = 'react' | 'window' | 'unhandledrejection';

export interface CrashRecord {
  /** Stable fingerprint id used for dedup + UI key. */
  id: string;
  kind: CrashKind;
  message: string;
  stack: string | null;
  /** React error 의 component stack. null = 비-React 출처. */
  componentStack: string | null;
  /** ISO timestamp. */
  timestamp: string;
  /** Same-fingerprint repeat count within the session. */
  count: number;
}

/**
 * Tool-supplied issue tracker config. Each tool puts its own Jira / Atlassian
 * specifics here — `<ReportDialog>` reads them at submit time.
 */
export interface FeedbackToolConfig {
  /** Jira project key, e.g. "SL". */
  projectKey: string;
  /** Jira issue type name, e.g. "일감" / "Task". */
  issueTypeName: string;
  /** Parent issue keys for the bug / improvement sub-issues. */
  parentBugKey: string;
  parentImprovementKey: string;
  /** Source label applied to every issue, e.g. "metadata-editor". */
  sourceLabel: string;
  /** Selectable "area" labels (added as `area:<value>`). Empty string = (미지정). */
  areaOptions: readonly string[];
  /**
   * Optional async builder for the auto-context dump. Called when the user
   * keeps "include auto context" enabled. Returns a JSON-stringifiable record.
   */
  autoContext?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface JiraConfig {
  /** Atlassian base URL, e.g. "https://example.atlassian.net". */
  baseUrl: string;
  /** Atlassian account email (Basic auth username). */
  email: string;
}

export interface JiraIssuePayload {
  project_key: string;
  issue_type_name: string;
  summary: string;
  description: string;
  parent_key: string | null;
  labels: string[];
  /** Workstream select customfield value. Tool maps its own
   *  customfield id at the Rust wrapper layer. */
  work_stream: string | null;
  /** Optional fenced JSON code block appended to description. */
  auto_context: string | null;
}

export interface CreatedIssue {
  key: string;
  id: string;
  url: string;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  url: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

/**
 * The Tauri invokes a host tool must supply to wire the feedback dialogs.
 * Each callback is just a thin invoke wrapper.
 */
export interface FeedbackInvokes {
  jiraHasToken: () => Promise<{ has_token: boolean }>;
  jiraSetToken: (token: string) => Promise<void>;
  jiraClearToken: () => Promise<void>;
  jiraTestConnection: (baseUrl: string, email: string, token: string | null) => Promise<JiraUser>;
  jiraCreateIssue: (baseUrl: string, email: string, payload: JiraIssuePayload) => Promise<CreatedIssue>;
  jiraSearchByLabel: (baseUrl: string, email: string, label: string) => Promise<JiraIssueSummary[]>;
  jiraAddComment: (baseUrl: string, email: string, issueKey: string, body: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
}
