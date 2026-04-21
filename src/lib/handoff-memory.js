const fs = require('node:fs');
const path = require('node:path');
const { PROJECTS_DIR } = require('./paths');

const HANDOFF_MAX_AGE_HOURS = 24;
const HANDOFF_FILENAME = 'session_handoff_auto.md';

/**
 * Find the memory directory for a given cwd by scoring project slugs under
 * ~/.claude/projects. Returns the best match or null.
 * @param {string} cwd
 * @param {string} [projectsDir]
 * @returns {string | null}
 */
function findProjectMemory(cwd, projectsDir = PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return null;
  const cwdNorm = cwd.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  let entries;
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return null;
  }

  for (const dir of entries) {
    const slugParts = dir.name
      .toLowerCase()
      .split('-')
      .filter((p) => p.length >= 2);
    if (slugParts.length === 0) continue;

    let matchScore = 0;
    for (const part of slugParts) if (cwdNorm.includes(part)) matchScore++;

    if (matchScore >= slugParts.length / 2) {
      const candidate = path.join(projectsDir, dir.name, 'memory');
      if (fs.existsSync(candidate) && matchScore > bestScore) {
        bestScore = matchScore;
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

/**
 * Build the memory directory path for a cwd, creating it on disk.
 * @param {string} cwd
 * @param {string} [projectsDir]
 * @returns {string}
 */
function createProjectMemory(cwd, projectsDir = PROJECTS_DIR) {
  const slug = cwd
    .replace(/[:\\/]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  const memDir = path.join(projectsDir, slug, 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  return memDir;
}

/**
 * Find the most recent handoff file in a memory directory within the age cutoff.
 * @param {string} memDir
 * @param {number} [maxAgeHours]
 * @returns {{ path: string, mtime: number, size: number } | null}
 */
function findRecentHandoff(memDir, maxAgeHours = HANDOFF_MAX_AGE_HOURS) {
  const cutoff = Date.now() - maxAgeHours * 3600_000;
  try {
    const files = fs
      .readdirSync(memDir)
      .filter((f) => f.startsWith('session_handoff'))
      .map((f) => {
        const full = path.join(memDir, f);
        const stat = fs.statSync(full);
        return { path: full, mtime: stat.mtimeMs, size: stat.size };
      })
      .filter((f) => f.mtime > cutoff)
      .sort((a, b) => b.mtime - a.mtime);

    return files[0] || null;
  } catch {
    return null;
  }
}

/**
 * Render a handoff markdown document.
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.cwd
 * @param {string} opts.memDir
 * @param {number} opts.sizeKB
 * @param {string} [opts.handoffPath]
 * @returns {string}
 */
function buildHandoffContent({ sessionId, cwd, memDir, sizeKB, handoffPath }) {
  const estTokens = Math.round(sizeKB * 150);
  const path_ = handoffPath || path.join(memDir, HANDOFF_FILENAME);
  return `---
name: Auto-generated session handoff
description: Token Shield auto-handoff when transcript reached ${sizeKB}KB (~${estTokens}K tokens)
type: project
generated: ${new Date().toISOString()}
session_id: ${sessionId}
transcript_size_kb: ${sizeKB}
working_directory: ${cwd}
---

# Session Handoff (Auto-Generated)

**Generated:** ${new Date().toISOString()}
**Session:** ${sessionId}
**Transcript size:** ${sizeKB}KB (~${estTokens}K tokens)
**Working directory:** ${cwd}

## How to Use
Start a new Claude Code session and say:
\`Read the auto-generated handoff at ${path_} then continue where the previous session left off.\`

## Key Locations
- Plans: ~/.claude/plans/
- Memory: ${memDir}
- Scripts: ~/.claude/scripts/
- Hooks: ~/.claude/hooks/
`;
}

module.exports = {
  HANDOFF_MAX_AGE_HOURS,
  HANDOFF_FILENAME,
  findProjectMemory,
  createProjectMemory,
  findRecentHandoff,
  buildHandoffContent,
};
