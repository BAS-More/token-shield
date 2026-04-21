# Changelog

All notable changes to Token Shield are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Modular `src/` layout with importable entry points (`install`, `validate`, `gapAnalysis`) exposed via `src/index.js`.
- Extracted `src/lib/` modules: `paths`, `fs-atomic`, `settings-io`, `mcp-io`, `handoff-memory`, `logger`.
- `node:test` suites covering settings wiring, MCP config, handoff memory resolution, atomic file IO, and CLI argument parsing.
- GitHub Actions CI (`.github/workflows/ci.yml`) running tests on Linux/macOS/Windows × Node 18/20/22, plus `tsc --checkJs` typecheck and Biome lint jobs.
- `tsconfig.json` with strict `checkJs`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `biome.json` for lint + format, `.nvmrc` pinning Node 20 LTS, `.npmignore` for publish hygiene.
- Root docs: `CONTRIBUTING.md`, `SECURITY.md`, `ARCHITECTURE.md`.
- Atomic JSON writes with automatic `.bak` backups for `settings.json` and `.mcp.json`.
- `--skip-npm` flag on installer to allow fully offline dry-runs in CI.

### Changed
- `bin/install.js`, `scripts/validate.js`, `scripts/gap-analysis.js` are now two-line shims that delegate to the `src/` modules.
- `gap-analysis` no longer hardcodes `C:/Dev/Ezra/CLAUDE.md` or the EZRA memory slug — accepts `--cwd` and `--claude-md` (or `CLAUDE_MD` env var) and walks up to two parents to auto-discover.
- Installer swaps `execSync` for `execFileSync` with explicit argv arrays — no shell interpretation.
- Installer skips `settings.json` write when the file is invalid JSON, rather than silently overwriting, to preserve user data.

### Preserved
- `hooks/token-shield-validator.js` remains a single self-contained file (the deploy artifact). Semantics and on-disk install path (`~/.claude/hooks/token-shield-validator.js`) are unchanged.

### Removed
- `legacy/` PowerShell scripts. Still available at the `v0-powershell-legacy` git tag and in the `v1.0.0` npm release.

## [1.0.0] — 2026-04-16

Initial release. Unified Node.js hook, cross-platform installer, 3-layer
architecture (Context Mode MCP + Stop hook + SessionStart hook).
