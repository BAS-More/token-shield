# hooks/ — Token Shield installable hook bundle

## Rules

- Schema-validate stdin JSON (`event` payload from Claude Code). Cap stdin reads (1 MB).
- Fail-open on any error: catch, log via console.error (stderr), exit 0. NEVER block silently — the user's session must continue.
- Output structured JSON only when emitting block decisions (`{"decision":"block","reason":"..."}`). Otherwise stay silent or emit informative stdout text.
- Windows-safe path handling: use `path.join` + `os.homedir`. Account for shell differences (cmd.exe vs PowerShell vs bash) — no bash-only constructs (`$()`).
- Stop hook must check `event.stop_hook_active === true` to avoid recursion (per Anthropic spec).
- Don't write transcripts, full file contents, or vault values to logs.
- Honor the L1/L2/L3 contract documented in `~/.claude/CLAUDE.md` `Active 3-layer Token Shield` section. Don't bypass.
- Test every hook with mocked stdin in `test/`. RED→GREEN before wire.
