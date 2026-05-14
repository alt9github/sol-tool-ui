# Changelog

## v0.1.0 (2026-05-14)

Initial scaffolding — P4 workflow dialogs extracted from a downstream tool so
multiple tools share one implementation.

### Components

- `<Modal>` — overlay + header/body/footer panel. Escape / overlay-click close
  toggles via props.
- `<Button>` — `default | primary | text` variants, `md | sm` sizes.
- `<P4ConnectionDialog>` — switch active P4 workspace. Lists workspaces,
  auto-highlights the one whose root contains the host's project root, applies
  the connection on confirm. Host injects `onListWorkspaces` /
  `onApplyConnection` callbacks; no store coupling.
- `<SyncPromptDialog>` — external changes summary in a single modal:
  - depot-stale files (with pending changelist breakdown if supplied)
  - concurrent-edit files (info-only)
  - binary self-update offer (with dirty-count guard + confirm gate)
  Host injects `onSyncFiles` / `onRecheckFreshness` / `onUpdateSelf` / optional
  `confirm` / `toast` callbacks.

### Design tokens

`tokens.css` exposes `--sol-ui-*` CSS variables — color, spacing, radius,
shadow, font. Host overrides any of them in its own root stylesheet without
forking the package.

### Adapter contract

Every dialog receives plain props/callbacks. No Zustand / no global state
imports — the package is framework-stack-agnostic beyond React itself.

### Types

`P4Workspace / P4Change / P4SyncResult / P4ConnectionSettings /
DiagnosticsLike / ToastFn / ConfirmFn` mirror the payloads exposed by
`sol-p4-tools` Tauri commands.

### Tests

(deferred to v0.2 — initial release focuses on shape parity with the upstream
ME implementation; behavioural tests follow once two tools consume the
components and the prop API stabilises.)
