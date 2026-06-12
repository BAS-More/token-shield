# token-shield · Node ≥18 · CLI + hooks

L1 (Context Mode), L2 (Stop hook validator), L3 (SessionStart auto-loader). Target 10/10 PASS.

## Mission

Three-layer transcript-token defence: sandbox tool output to SQLite + auto-handoff at >2MB + surface fresh handoffs.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node ≥18 |
| Lint | biome |
| Tests | bash + node test (`test/`) |

## Commands

- `npm run validate` — runs `scripts/validate.js` (target 10/10)
- `npm test` / `:watch`
- `npm run gap-analysis`
- `npm run install-hooks` / `:dry`
- `npm run typecheck` · `npm run lint` · `npm run format`

## Key paths

- `src/index.js`, `src/install.js`, `src/validate.js`, `src/gap-analysis.js`
- `hooks/` — installable hook bundle
- `commands/` — slash-command sources
- `stuck-detector/` — sub-tool
- `bin/`

## Don'ts

- Don't change the validator threshold without updating user-level CLAUDE.md (`Active 3-layer Token Shield` section).
- Don't conflate Token Shield with total-recall — different fact classes (transcript vs cross-session memory).
- Hooks must be Windows-safe (no bash-only constructs leaking through; emit JSON).
- Never write hook output that bypasses Stop-hook auto-handoff.

## Risk-sensitive folders → nested CLAUDE.md

- `hooks/CLAUDE.md` — schema-validate stdin; fail-open on malformed JSON; never block silently.
- `stuck-detector/CLAUDE.md` — sentinel logic; document false-positive thresholds.

## See also

User-level rules: `Active 3-layer Token Shield` section in `~/.claude/CLAUDE.md`, `plan-first-workflow`, `test-and-gap-mandatory`.
