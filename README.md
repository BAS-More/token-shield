# Token Shield

**3-layer automatic token optimization for Claude Code.** Saves 80-95% of token costs by preventing context bloat, auto-generating session handoffs, and enabling seamless session continuity.

## The Problem

Claude Code sessions accumulate context monotonically. Turn 1 reads ~20K tokens. Turn 50 reads ~591K tokens. Every turn re-reads the entire history. A 50-turn marathon session costs $60-80 at API rates, with 90% spent on cache-read tokens.

## The Solution

Token Shield is 3 automated layers that work in the background:

| Layer | What | How |
|-------|------|-----|
| **Context Mode MCP** | Prevents context bloat | Sandboxes tool output — 98% reduction (315KB to 5.4KB) |
| **Context Guardian** | Auto-generates handoffs | Stop hook writes handoff when transcript exceeds 2MB |
| **Session Auto-Loader** | Enables seamless resume | SessionStart hook announces recent handoffs (<100 tokens) |

### Cost Projection

| Scenario | Tokens/Turn | 50-Turn Session | Est. Cost |
|----------|------------|-----------------|-----------|
| No Token Shield | 400-591K | ~200M | $60-80 |
| Context Mode only | 50-100K | ~25-50M | $8-15 |
| Full Token Shield | 30-60K | ~10-20M | $3-6 |

## Quick Install

```bash
git clone https://github.com/BAS-More/token-shield.git
cd token-shield
node bin/install.js
```

The installer will:
1. Copy the hook to `~/.claude/hooks/`
2. Install [Context Mode](https://github.com/mksglu/context-mode) globally (`npm install -g context-mode`)
3. Add Context Mode to `~/.claude/.mcp.json`
4. Wire SessionStart + Stop hooks into `~/.claude/settings.json`
5. Run validation to confirm everything works

### Dry Run

```bash
node bin/install.js --dry-run
```

### Verify Installation

```bash
node scripts/validate.js
```

## How It Works

### Layer 1: Context Mode MCP

[Context Mode](https://github.com/mksglu/context-mode) is an MCP server that sandboxes tool output. Instead of dumping large file reads, grep results, and git diffs into the context window, it stores a compact summary and keeps the full content in a local SQLite + FTS5 database.

- Installed globally via npm
- Configured in `~/.claude/.mcp.json`
- Zero interference with existing MCPs
- Extends productive session length from ~2h to 8+ hours

### Layer 2: Context Guardian (Stop Hook)

A Node.js hook that runs on every Claude Code `Stop` event:

1. Checks transcript size against a 2MB threshold (~300K tokens)
2. If exceeded: generates `session_handoff_auto.md` in the project memory directory
3. Outputs a warning suggesting a fresh session

The handoff captures session metadata, working directory, and pointers to plans/memory/hooks.

### Layer 3: Session Auto-Loader (SessionStart Hook)

The same hook also runs on `SessionStart`:

1. Scans the project memory directory for handoff files < 24 hours old
2. Announces the most recent handoff with a single-line pointer
3. Adds < 100 tokens to context — no bloat

## File Layout

```
token-shield/
  bin/install.js                   — Installer shim (→ src/install.js)
  hooks/token-shield-validator.js  — Unified hook (SessionStart + Stop). Self-contained: deploy artifact.
  scripts/validate.js              — Validation shim (→ src/validate.js)
  scripts/gap-analysis.js          — Gap-analysis shim (→ src/gap-analysis.js)
  src/                             — All logic. Importable. See ARCHITECTURE.md.
    ├── install.js                 installer entry + main()
    ├── validate.js                validator entry + main()
    ├── gap-analysis.js            gap-report entry (accepts --cwd, --claude-md)
    ├── index.js                   public API re-exports
    └── lib/                       reusable helpers (paths, fs, settings, mcp, handoff, logger)
  test/                            — node:test suites, zero deps
  commands/token-shield.md         — Slash command (EZRA-compatible)
  docs/                            — Long-form architecture, patterns, templates
```

Previous v0 PowerShell scripts are preserved at the `v0-powershell-legacy`
git tag.

### Installed files

```
~/.claude/hooks/token-shield-validator.js   — The hook
~/.claude/.mcp.json                          — context-mode MCP entry
~/.claude/settings.json                      — Hook wiring
~/.claude/context-mode.db                    — Context Mode database
```

## Compatibility

- **Platforms**: Windows, macOS, Linux
- **Node.js**: 18+ (20 LTS recommended; pinned in `.nvmrc`)
- **Claude Code**: Any version with hook support
- **EZRA**: Compatible — ships as EZRA hook + command too
- **Other hooks**: Non-interfering — preserves all existing hooks

## EZRA Integration

Token Shield also ships inside [EZRA](https://github.com/BAS-More/ezra-claude-code). If you use EZRA, running `/ezra:install` will deploy the hook automatically. The `/ezra:token-shield` command runs on-demand validation.

## Alternatives Researched

| Tool | Approach | Notes |
|------|----------|-------|
| [Context Mode](https://github.com/mksglu/context-mode) | Tool output sandboxing | **Used by Token Shield** as Layer 1 |
| [Cozempic](https://github.com/Ruya-AI/cozempic) | 13 pruning strategies | Python, tiered system |
| [VNX Pipeline](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation) | Auto session rotation | Requires tmux (Linux) |
| [claude-mem](https://github.com/thedotmack/claude-mem) | AI-compressed memory | 46K stars, SQLite + vectors |
| [Headroom](https://github.com/chopratejas/headroom) | Content-aware compression | 87% reduction, proxy-based |

## License

MIT
