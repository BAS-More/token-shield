# Token Usage Patterns

## Why Marathon Sessions Are Expensive

Context is cumulative. Turn 1 reads 20K tokens. Turn 50 reads 591K tokens. Each turn re-reads EVERYTHING. 500 turns x avg 400K = 200M tokens just from context re-reads.

The Apr 7-10 EZRA session consumed ~320M tokens ($240 at API rates), with 90% being cache-read costs.

## The Real Cost Driver: Cache-Read Tokens

| Activity | Tokens | % of Total |
|----------|--------|------------|
| Context re-reads (cache read) | ~288M | 90% |
| New content entering context | ~32M | 10% |
| Output (responses) | ~455K | 0.14% |
| Background agents (29 total) | ~5.5M | 1.7% |

Agents are cheap. The main conversation thread is expensive.

## Strategies

1. **Start a new session every 2-3 hours** — fresh context = ~20K, not ~591K
2. **Use session handoff files** to pass state between sessions
3. **Dispatch subagents** for investigation work — they get fresh 190K contexts
4. **Avoid topic pivots** within a session — each pivot adds dead context still re-read every turn
5. **Keep plan files short** (<200 lines) — they get pulled into context on every reference
6. **Use verification scripts** to confirm state without re-investigating
