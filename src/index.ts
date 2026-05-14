// Components
export { Button } from './components/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/Button';
export { Modal } from './components/Modal';
export type { ModalProps } from './components/Modal';
export { P4ConnectionDialog, isP4ClientMismatch } from './components/P4ConnectionDialog';
export type { P4ConnectionDialogProps } from './components/P4ConnectionDialog';
export { SyncPromptDialog } from './components/SyncPromptDialog';
export type { SyncPromptDialogProps } from './components/SyncPromptDialog';

// Types
export type {
  ConfirmFn,
  DiagnosticsLike,
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
