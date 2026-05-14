// Components
export { Button } from './components/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/Button';
export { Modal } from './components/Modal';
export type { ModalProps } from './components/Modal';
export { P4ConnectionDialog, isP4ClientMismatch } from './components/P4ConnectionDialog';
export type { P4ConnectionDialogProps } from './components/P4ConnectionDialog';
export { SyncPromptDialog } from './components/SyncPromptDialog';
export type { SyncPromptDialogProps } from './components/SyncPromptDialog';
export { ReportDialog } from './components/ReportDialog';
export type { ReportDialogProps } from './components/ReportDialog';
export { CrashPromptDialog } from './components/CrashPromptDialog';
export type { CrashPromptDialogProps } from './components/CrashPromptDialog';
export { JiraTokenSettings } from './components/JiraTokenSettings';
export type { JiraTokenSettingsProps } from './components/JiraTokenSettings';

// Stores
export {
  useCrashStore,
  reportReactCrash,
  installCrashListeners,
  isFrameworkOnlyStack,
} from './stores/crashStore';

// Utils
export {
  checkSubmitAllowed,
  recordSubmit,
  resetRateLimit,
  formatRetryAfter,
} from './utils/rateLimit';
export type { RateLimitResult } from './utils/rateLimit';
export { redactHomePath, sanitizeContextRecord } from './utils/sanitize';

// Types
export type {
  ConfirmFn,
  CrashKind,
  CrashRecord,
  CreatedIssue,
  DiagnosticsLike,
  FeedbackInvokes,
  FeedbackToolConfig,
  JiraConfig,
  JiraIssuePayload,
  JiraIssueSummary,
  JiraUser,
  P4Change,
  P4ConnectionSettings,
  P4SyncResult,
  P4Workspace,
  ToastFn,
} from './types';

// Styles — host imports these once at app entry.
// (CSS modules / scoped CSS 미사용 — host bundler 가 import 처리.)
// Usage:
//   import '@alt9github/sol-tool-ui/src/styles/tokens.css';
//   import '@alt9github/sol-tool-ui/src/styles/components.css';
