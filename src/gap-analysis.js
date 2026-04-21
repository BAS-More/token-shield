/**
 * Token Shield gap analysis — reports the health of all 5 layers/categories
 * for a given working directory. Replaces the previous hardcoded-path version.
 */

const fs = require('node:fs');
const path = require('node:path');
const { MCP_JSON, SETTINGS_JSON, HOOKS_DIR } = require('./lib/paths');
const { loadMcp } = require('./lib/mcp-io');
const { loadSettings } = require('./lib/settings-io');
const { findProjectMemory } = require('./lib/handoff-memory');

/**
 * @typedef {object} GapOptions
 * @property {string} [cwd]        Working directory used for memory resolution
 * @property {string} [claudeMd]   Path to CLAUDE.md to inspect
 */

/** @param {GapOptions} [options] */
function runGapAnalysis(options = {}) {
  const cwd = options.cwd || process.cwd();
  const claudeMdPath = options.claudeMd || process.env.CLAUDE_MD || findClaudeMd(cwd);

  console.log('=== GAP ANALYSIS: Token Shield System ===\n');

  // Category 1: Tool Output Bloat
  console.log('## Category 1: Tool Output Bloat');
  const { mcp, existed: mcpExisted } = loadMcp(MCP_JSON);
  const hasContextMode = mcpExisted && 'context-mode' in mcp.mcpServers;
  console.log(`  [${hasContextMode ? 'PASS' : 'FAIL'}] Context Mode MCP configured in .mcp.json`);
  const cmDbPath = mcp.mcpServers['context-mode']?.env?.CONTEXT_MODE_DB;
  console.log(`  [${cmDbPath ? 'PASS' : 'WARN'}] Context Mode DB path: ${cmDbPath || 'not set'}`);
  console.log('  [INFO] Context Mode active sandboxing requires live session verification\n');

  // Category 2: Context Accumulation
  console.log('## Category 2: Context Accumulation');
  if (claudeMdPath && fs.existsSync(claudeMdPath)) {
    const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');
    console.log(
      `  [${claudeMd.includes('Compact Instructions') ? 'PASS' : 'FAIL'}] Compact Instructions in ${claudeMdPath}`
    );
  } else {
    console.log(
      `  [SKIP] No CLAUDE.md located (pass --claude-md=<path> or set $CLAUDE_MD). cwd=${cwd}`
    );
  }
  console.log('');

  // Category 3: Hook Overhead
  console.log('## Category 3: Hook Overhead');
  const { settings, existed: sExisted, invalid: sInvalid } = loadSettings(SETTINGS_JSON);
  if (!sExisted || sInvalid) {
    console.log(`  [FAIL] settings.json unreadable (existed=${sExisted}, invalid=${sInvalid})`);
  } else {
    const hookMap = settings.hooks || {};
    let totalHooks = 0;
    for (const entries of Object.values(hookMap)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries)
        if (Array.isArray(entry?.hooks)) totalHooks += entry.hooks.length;
    }
    console.log(`  [INFO] Total hooks: ${totalHooks} across ${Object.keys(hookMap).length} stages`);
    console.log(`  [${hookMap.Stop ? 'PASS' : 'FAIL'}] Stop hook (Context Guardian) configured`);
    const ssHookCount = hookMap.SessionStart?.[0]?.hooks?.length || 0;
    console.log(
      `  [${ssHookCount >= 1 ? 'PASS' : 'FAIL'}] SessionStart includes Auto-Loader (${ssHookCount} hooks)`
    );
  }
  console.log('');

  // Category 4: Session Continuity
  console.log('## Category 4: Session Continuity');
  const memDir = findProjectMemory(cwd);
  if (memDir) {
    const handoffs = fs.readdirSync(memDir).filter((f) => f.startsWith('session_handoff'));
    console.log(
      `  [${handoffs.length > 0 ? 'PASS' : 'FAIL'}] Handoff files in ${memDir}: ${handoffs.join(', ') || '(none)'}`
    );
  } else {
    console.log(`  [SKIP] No project memory directory found for cwd=${cwd}`);
  }
  console.log(
    `  [${fs.existsSync(path.join(HOOKS_DIR, 'token-shield-validator.js')) ? 'PASS' : 'FAIL'}] Validator hook deployed`
  );
  console.log('');

  // Category 5: MCP Stack
  console.log('## Category 5: MCP Stack');
  const mcpServers = Object.keys(mcp.mcpServers);
  console.log(`  [INFO] Servers: ${mcpServers.join(', ') || '(none)'}`);
  for (const [name, config] of Object.entries(mcp.mcpServers)) {
    const cmd = typeof config?.command === 'string' ? config.command : '';
    const exists = cmd && (fs.existsSync(cmd) || fs.existsSync(cmd.replace(/\.cmd$/, '')));
    console.log(`  [${exists ? 'PASS' : 'WARN'}] ${name}: ${cmd || '(no command)'}`);
  }

  // Summary
  const summaryHooks = settings.hooks || {};
  console.log('\n=== SUMMARY ===');
  console.log(`Layer 1 (Context Mode):     ${hasContextMode ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`Layer 2 (Context Guardian): ${summaryHooks.Stop ? 'WIRED' : 'MISSING'}`);
  console.log(`Layer 3 (Auto-Loader):      ${summaryHooks.SessionStart ? 'WIRED' : 'MISSING'}`);
}

/**
 * Best-effort search for a CLAUDE.md in cwd or two parents up.
 * @param {string} cwd
 * @returns {string | null}
 */
function findClaudeMd(cwd) {
  let current = cwd;
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(current, 'CLAUDE.md');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** @param {readonly string[]} argv */
function parseArgs(argv) {
  const options = /** @type {GapOptions} */ ({});
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '--cwd' || arg === '--claude-md') {
      const value = argv[i + 1];
      if (!value) continue;
      if (arg === '--cwd') options.cwd = value;
      else options.claudeMd = value;
      i++;
    } else if (arg.startsWith('--cwd=')) {
      options.cwd = arg.slice('--cwd='.length);
    } else if (arg.startsWith('--claude-md=')) {
      options.claudeMd = arg.slice('--claude-md='.length);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  runGapAnalysis(options);
}

module.exports = { runGapAnalysis, parseArgs, findClaudeMd, main };

if (require.main === module) main();
