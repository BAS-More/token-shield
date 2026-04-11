# Token Shield Architecture

## Problem

Claude Code sessions accumulate context monotonically. Every turn re-reads the entire conversation history:

| Turn | Context Size | Cost per Turn |
|------|-------------|---------------|
| 1    | ~20K tokens | ~$0.006       |
| 10   | ~100K       | ~$0.03        |
| 30   | ~400K       | ~$0.12        |
| 50   | ~591K       | ~$0.18        |

A 50-turn session costs ~$60-80 at API rates. 90% of that is cache-read tokens — re-reading the growing context every turn.

## Solution: 3-Layer Token Shield

### Layer 1: Context Mode MCP (Prevent Bloat)

[Context Mode](https://github.com/mksglu/context-mode) is an MCP server that sandboxes tool output. Instead of dumping 315KB of file content into context, it stores a 5.4KB summary and keeps the full content in a local SQLite + FTS5 database for retrieval when needed.

- **Impact**: 98% reduction in tool output context
- **Effect**: Extends productive session from ~2 hours to 8+ hours

### Layer 2: Context Guardian (Stop Hook)

A Node.js hook (`token-shield-validator.js`) that runs on every Claude Code `Stop` event:

1. Reads the session transcript path from stdin (hook protocol)
2. Checks transcript file size against a 2MB threshold (~300K tokens)
3. If exceeded: generates `session_handoff_auto.md` in the project memory directory
4. Outputs a warning suggesting a fresh session

The handoff file contains session metadata, working directory, and pointers to key locations (plans, memory, scripts, hooks).

### Layer 3: Session Auto-Loader (SessionStart Hook)

The same hook also runs on `SessionStart`:

1. Scans the project memory directory for handoff files < 24 hours old
2. If found: outputs a single line announcing the handoff location
3. Adds < 100 tokens to context — just a pointer, not the full content

## Cost Projection

| Scenario | Tokens/Turn | 50-Turn Session | Est. Cost |
|----------|------------|-----------------|-----------|
| No Token Shield | 400-591K | ~200M | $60-80 |
| Context Mode only | 50-100K | ~25-50M | $8-15 |
| Full Token Shield | 30-60K | ~10-20M | $3-6 |

**Expected savings: 80-95% reduction in token consumption.**

## File Layout

```
~/.claude/hooks/token-shield-validator.js   — The unified hook
~/.claude/.mcp.json                          — context-mode MCP entry
~/.claude/settings.json                      — SessionStart + Stop hook entries
~/.claude/context-mode.db                    — Context Mode's SQLite database
~/.claude/projects/{slug}/memory/            — Auto-generated handoff files
```
