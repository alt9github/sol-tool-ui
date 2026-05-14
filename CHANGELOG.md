# Changelog

## v0.1.3 (2026-05-14)

File-list wrap fix.

### Components

- `.sol-ui-file-list li` switched from `word-break: break-all` to single-line
  ellipsis (`white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`).
  Long paths display in one row; full path remains in the `title` attribute
  on hover. The JS-side `shorten()` middle-truncation still runs first.
- `.sol-ui-file-list li` / `.sol-ui-change-list li` lose their horizontal
  padding so each row uses the list's full width — matches the wider line
  budget callers had with the previous ME layout.

## v0.1.2 (2026-05-14)

Visual regression follow-up — drop the outer border on the sync file/change
lists.

### Components

- `.sol-ui-file-list` / `.sol-ui-change-list` no longer carry an outer
  border or border-radius. Lists now flow as plain text against the modal
  body. `max-height` + scroll still bounds long lists.

## v0.1.1 (2026-05-14)

Visual regression fix in `<SyncPromptDialog>`'s file-list section.

### Components

- `.sol-ui-file-list li` no longer carries a per-row `border-bottom`. The
  list still has an outer 1px border via `.sol-ui-file-list`, matching the
  original ME behaviour (file rows flow without internal separators).
- `.sol-ui-change-list` keeps its grid layout without per-row borders for
  consistency. Outer border + grid columns convey structure.

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
