# Contributing

Thanks for helping improve Token Shield.

## Prerequisites

- Node.js **18+** (the repo pins 20 via `.nvmrc`). `nvm use` if you have nvm.
- No runtime dependencies. Dev tooling (TypeScript, Biome) is installed ad-hoc in CI; see scripts below.

## Quick loop

```bash
git clone https://github.com/BAS-More/token-shield.git
cd token-shield

# Run the unit tests (no install required)
node --test

# Or via the npm script
npm test

# Dry-run the installer without touching ~/.claude/
node bin/install.js --dry-run --skip-npm
```

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Runs `node --test` with auto-discovery — the unit suite. |
| `npm run validate` | Runs the live validator against your real `~/.claude/` install. |
| `npm run gap-analysis` | Prints a gap report. Supports `--cwd` and `--claude-md`. |
| `npm run install-hooks` | Full installer. Accepts `--dry-run`, `--verify`, `--skip-npm`. |
| `npm run typecheck` | `tsc --noEmit` using `tsconfig.json` (installs TS on demand). |
| `npm run lint` | Biome lint + format check (installs Biome on demand). |
| `npm run format` | Biome auto-format. |

## Code layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). TL;DR:

- `src/` — all logic. Importable. Unit tests target this.
- `bin/`, `scripts/` — thin shebang shims that call into `src/`.
- `hooks/token-shield-validator.js` — **deploy artifact**. Kept self-contained so the installer can copy a single file into `~/.claude/hooks/`. Do not split it into requires.
- `test/` — `node:test` suites. New lib code should ship with tests next to this dir.

## Ground rules

- **No new runtime dependencies.** The point of Token Shield is to be a zero-dep drop-in.
- **Idempotency.** Installer, settings/mcp editors, and hook wiring must be safe to re-run.
- **Fail open in the hook.** The hook must never block a session — swallow errors, exit 0.
- **Back up before mutating user JSON.** `saveSettings` and `saveMcp` do this automatically via `src/lib/fs-atomic.js`. Use them, don't reinvent.
- **Typecheck clean.** CI runs `tsc --checkJs`. Add JSDoc types on new exports.

## Git conventions

- Feature branches: `feat/<thing>`, bug fixes: `fix/<thing>`, structural: `refactor/<thing>`.
- Conventional-Commits-ish messages are preferred (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- One logical change per PR. Note any behavior-visible changes in `CHANGELOG.md` under `[Unreleased]`.

## Releasing

1. Move `[Unreleased]` in `CHANGELOG.md` to a new version section.
2. Bump `version` in `package.json`.
3. Tag `vX.Y.Z`, push. CI runs tests/typecheck/lint on tags too.
