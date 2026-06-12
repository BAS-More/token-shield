# stuck-detector/ — sentinel logic for repeat-edit loops

## Rules

- Sentinel triggers on N edits to same file without intervening test pass. Default N=5; document threshold + rationale in code.
- State file per session under `~/.claude/_logs/state-<session>.json`. Atomic writes (tmp + rename) — concurrent hooks must not corrupt state.
- Reset signal: explicit test_pass_ts marker set by upstream strike-counter on green test exit code.
- Document false-positive thresholds clearly. Stuck-detector is a safety net, not a hard gate — bypass via state-file edit must remain trivial.
- Cross-platform path handling — Windows `\` vs Unix `/` resolve via `path.resolve`.
- No external deps. Node built-ins only.
- Output `decision:"block"` JSON ONLY at the threshold. Below threshold: silent.
