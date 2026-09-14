<!-- bas-more-project-memory:v1:start -->
## Project memory
After the repository's mandatory entry and handover reads, read
.project-memory/config.json and .project-memory/POLICY.md from the repository root.
Setup is enabled by the owner. Continue incomplete setup within this repository
without asking again; preserve any working graph engine and its recorded pins.
Before coding, use the documented session/freshness, context and upstream-impact
workflow. After edits, refresh relevant graphs and record actual validation.
Graph readiness requires the policy's acceptance evidence; installed rules alone
do not establish that graphs, semantic retrieval, hooks or integrations work.
<!-- bas-more-project-memory:v1:end -->

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
