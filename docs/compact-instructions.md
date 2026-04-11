# Compact Instructions Template

Add this section to your project's `CLAUDE.md` file to control what Claude Code preserves during automatic context compaction:

```markdown
## Compact Instructions
When compacting, always preserve:
- Current task state and what is being worked on right now
- All file paths mentioned in the last 10 turns
- Architectural decisions made this session
- Any errors, blockers, or failing tests encountered
- The active plan file path and current step
- Hook/MCP configuration changes made this session
```

## Why This Matters

When Claude Code auto-compacts (summarizes conversation history to free context), it may lose early conversation details. The Compact Instructions section tells it what to prioritize keeping. Without it, you might lose track of which files were modified or what the current task is after compaction fires.
