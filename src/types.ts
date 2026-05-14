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
