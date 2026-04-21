# Architecture

Token Shield is three layers of automatic context-budget management. Each
layer is independent — you can install only one and the rest still behave
sensibly.

## The three layers

| # | Layer | Surface | Job |
|---|-------|---------|-----|
| 1 | Context Mode MCP | `~/.claude/.mcp.json` | Sandboxes tool output; swap-in store for large reads, greps, diffs. Out-of-process SQLite + FTS5 DB. |
| 2 | Context Guardian | Stop hook in `~/.claude/settings.json` | On transcript > threshold, writes `session_handoff_auto.md` into the project memory dir and warns the user. |
| 3 | Session Auto-Loader | SessionStart hook in `~/.claude/settings.json` | Scans for recent (< 24 h) handoff files and announces the most recent one in < 100 tokens. |

Layers 2 and 3 are the **same Node script** — `token-shield-validator.js` —
dispatched on the `event.event` or an inferred event type.

## Repo layout

```
token-shield/
├── bin/install.js                       shim → src/install.js
├── hooks/token-shield-validator.js      SELF-CONTAINED deploy artifact
├── scripts/
│   ├── validate.js                      shim → src/validate.js
│   └── gap-analysis.js                  shim → src/gap-analysis.js
├── src/
│   ├── index.js                         public API re-exports
│   ├── install.js                       installer entry + main()
│   ├── validate.js                      validator entry + main()
│   ├── gap-analysis.js                  gap-report entry + main()
│   └── lib/
│       ├── paths.js                     ~/.claude path constants
│       ├── fs-atomic.js                 atomic JSON write + BOM-safe read + .bak
│       ├── settings-io.js               settings.json reader/writer + hook wiring
│       ├── mcp-io.js                    .mcp.json reader/writer + binary discovery
│       ├── handoff-memory.js            project memory dir resolution + handoff rendering
│       └── logger.js                    optional fail-open logger shim
├── test/                                node:test suites (no deps)
│   ├── helpers/tmpdir.js
│   ├── fs-atomic.test.js
│   ├── settings-io.test.js
│   ├── mcp-io.test.js
│   ├── handoff-memory.test.js
│   ├── install-cli.test.js
│   └── gap-analysis-cli.test.js
├── commands/token-shield.md             EZRA slash command manifest
├── docs/                                long-form design notes
├── .github/workflows/ci.yml
├── biome.json  tsconfig.json  .nvmrc  .npmignore  .gitignore
├── package.json  LICENSE  README.md
├── CHANGELOG.md  CONTRIBUTING.md  SECURITY.md  ARCHITECTURE.md
```

## Why the hook is a single file

The installer's job is to copy **one** file into `~/.claude/hooks/`. If the
hook were split across modules, the installer would have to copy a tree and
rewrite settings to point at `hooks/token-shield/validator.js`. We kept the
single-file contract. Duplicate logic between `hooks/token-shield-validator.js`
and `src/lib/` is accepted but small (~50 LOC of project-memory slug matching
that has a clear extraction path later if we ship a multi-file layout).

## Installer flow

1. `ensureDir(~/.claude/)` and `~/.claude/hooks/`.
2. `copyFileSync(hooks/token-shield-validator.js, ~/.claude/hooks/token-shield-validator.js)`.
3. Check `npm list -g context-mode`. If missing, `npm install -g context-mode`. Skip with `--skip-npm`.
4. Load `.mcp.json`, locate the `context-mode` binary, add or preserve the entry. Back up the original to `.mcp.json.bak`. Write atomically.
5. Load `settings.json`. Add the hook entry to `SessionStart` and `Stop` stages if not already wired. Back up and write atomically. If the file is invalid JSON, abort — do not overwrite.
6. Run the validator.

`--dry-run` skips every write. `--verify` runs only step 6.

## Hook flow

Entry: `hooks/token-shield-validator.js` reads up to 1 MB of JSON from stdin,
then branches:

- `event.event === 'Stop'` (or `event.transcript_path` present) →
  check transcript size; if over 2 MB (~300 K tokens), render a handoff
  markdown file and emit a JSON warning; exit 0.
- Otherwise → `SessionStart`. Locate the project memory directory by scoring
  slugs under `~/.claude/projects/`, look for a `session_handoff*` file < 24 h
  old, announce it. Run a light validation and print any failures.

All errors are caught and the process exits 0 — **never block a session**.

## Data on disk

- `~/.claude/.mcp.json` — authoritative MCP server list. Token Shield owns the `context-mode` entry only.
- `~/.claude/settings.json` — authoritative hook wiring. Token Shield owns one entry under `hooks.SessionStart[0].hooks` and one under `hooks.Stop[0].hooks`.
- `~/.claude/hooks/token-shield-validator.js` — the deployed hook.
- `~/.claude/context-mode.db` — Context Mode's sandbox database.
- `~/.claude/projects/<slug>/memory/session_handoff_auto.md` — auto-generated handoff.
- `*.bak` files next to each mutated JSON — one-deep backup, overwritten on each mutate.
