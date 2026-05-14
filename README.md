# sol-tool-ui

Shared React UI for the `sol-*` tooling stack — P4 / feedback / metadata
helpers. Drop-in dialogs and primitives so each tool gets the same UX without
re-implementing.

## Install

```jsonc
// package.json
{
  "dependencies": {
    "@alt9github/sol-tool-ui": "github:alt9github/sol-tool-ui#v0.1.0"
  }
}
```

Peer requirements: `react >= 18`, `react-dom >= 18`, `@tauri-apps/api >= 2`.

## Bring in styles once at app entry

```ts
import '@alt9github/sol-tool-ui/src/styles/tokens.css';
import '@alt9github/sol-tool-ui/src/styles/components.css';
```

Host can override any `--sol-ui-*` CSS variable in its own root stylesheet to
theme without forking.

## Surface (v0.1)

### Components

| Component | Purpose |
|---|---|
| `<Modal>` | Generic overlay panel with header/body/footer slots. |
| `<Button>` | `default` / `primary` / `text` variants, `sm` / `md` sizes. |
| `<P4ConnectionDialog>` | Switch active P4 workspace. Host injects `onListWorkspaces` / `onApplyConnection`. |
| `<SyncPromptDialog>` | External-changes summary (depot stale / concurrent edits) + binary self-update. Host injects `onSyncFiles` / `onRecheckFreshness` / `onUpdateSelf`. |

### Adapters

Every dialog receives only **plain props/callbacks** — no Zustand, no store
imports. The host (ME / LME / future tool) glues its own state and Tauri
invokes to these callbacks. That keeps the package framework-stack-agnostic
beyond React itself.

### Types

`P4Workspace / P4Change / P4SyncResult / P4ConnectionSettings / DiagnosticsLike / ToastFn / ConfirmFn`.

## Usage example

```tsx
import { P4ConnectionDialog } from '@alt9github/sol-tool-ui';
import { invoke } from '@tauri-apps/api/core';

function MyTool() {
  const [open, setOpen] = useState(false);
  return (
    <P4ConnectionDialog
      open={open}
      onClose={() => setOpen(false)}
      initial={{ server, user, client }}
      diagnostics={diag}
      onListWorkspaces={(s, u) => invoke('list_p4_workspaces', { server: s, user: u })}
      onApplyConnection={(c) => invoke('set_p4_connection', c)}
      toast={(m, kind) => myToast(m, kind)}
      onApplied={(w) => refreshDiagnostics()}
    />
  );
}
```

## License

MIT.
