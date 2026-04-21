# Security Policy

## Supported versions

Only the latest minor line receives security updates.

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| 0.x     | No (legacy PowerShell; see tag `v0-powershell-legacy`) |

## Reporting a vulnerability

Please email the maintainer listed on the [GitHub profile](https://github.com/BAS-More) rather than opening a public issue. Include:

- A description of the issue and its impact.
- Steps to reproduce (or a proof-of-concept patch).
- The affected version and platform.

You'll receive an acknowledgement within 72 hours. A fix and disclosure timeline will be coordinated privately before any public advisory.

## Threat model

Token Shield runs with the user's privileges inside their Claude Code session. It:

- Reads and writes `~/.claude/settings.json`, `~/.claude/.mcp.json`, and files under `~/.claude/hooks/` and `~/.claude/projects/`.
- Executes `npm install -g context-mode` on first install (can be skipped via `--skip-npm`).
- Reads the transcript path provided by Claude Code on `Stop` events.

The installer uses `execFileSync` with explicit argv arrays — no shell interpretation, no untrusted input. The hook reads up to 1 MB of JSON from stdin and exits on overflow. Invalid JSON on stdin or disk is swallowed and the hook exits 0 (fail-open) to avoid ever blocking a session.

## Things Token Shield does **not** do

- No network calls at runtime (installer excepted, and only to the npm registry).
- No credential storage or transmission.
- No writes outside `~/.claude/` (plus backup files adjacent to originals).
