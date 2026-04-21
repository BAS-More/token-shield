/**
 * Token Shield validator — verifies all 3 layers are installed and configured.
 * Prints a PASS/FAIL report and returns a structured result.
 */

const fs = require('node:fs');
const { HOOKS_DIR, MCP_JSON, SETTINGS_JSON, HOOK_TARGET } = require('./lib/paths');
const { loadMcp } = require('./lib/mcp-io');
const { loadSettings, HOOK_MARKER } = require('./lib/settings-io');

/**
 * @typedef {object} Check
 * @property {'pass' | 'fail' | 'warn'} status
 * @property {string} label
 */

/**
 * @typedef {object} ValidationResult
 * @property {Check[]} checks
 * @property {number} passed
 * @property {number} failed
 * @property {number} warned
 */

/**
 * Run all validation checks and print the report.
 * @param {object} [options]
 * @param {boolean} [options.silent]
 * @returns {ValidationResult}
 */
function runValidation(options = {}) {
  const { silent = false } = options;
  /** @type {(line: string) => void} */
  const out = silent ? () => {} : (line) => console.log(line);

  /** @type {Check[]} */
  const checks = [];
  /** @param {Check['status']} status @param {string} label */
  const record = (status, label) => checks.push({ status, label });

  out('============================================');
  out(' TOKEN SHIELD — VALIDATION');
  out(` ${new Date().toISOString()}`);
  out('============================================\n');

  out('--- Layer 1: Context Mode MCP ---');
  const { mcp, existed: mcpExisted, invalid: mcpInvalid } = loadMcp(MCP_JSON);
  if (!mcpExisted) {
    record('fail', '.mcp.json exists');
  } else if (mcpInvalid) {
    record('fail', '.mcp.json valid JSON');
  } else {
    const cm = mcp.mcpServers['context-mode'];
    record(cm ? 'pass' : 'fail', 'Context Mode in .mcp.json');
    if (cm) {
      record(cm.env?.CONTEXT_MODE_DB ? 'pass' : 'fail', 'DB path configured');
      const cmd = typeof cm.command === 'string' ? cm.command : '';
      record(cmd && fs.existsSync(cmd) ? 'pass' : 'fail', `Binary exists: ${cmd || '(none)'}`);
    }
  }
  out('');

  out('--- Layer 2: Hook Deployment ---');
  record(fs.existsSync(HOOK_TARGET) ? 'pass' : 'fail', `Hook deployed to ${HOOKS_DIR}`);
  if (fs.existsSync(HOOK_TARGET)) {
    const content = fs.readFileSync(HOOK_TARGET, 'utf8');
    record(content.includes('THRESHOLD_KB') ? 'pass' : 'fail', 'Has threshold parameter');
    record(content.includes('handleStop') ? 'pass' : 'fail', 'Has Stop handler');
    record(content.includes('handleSessionStart') ? 'pass' : 'fail', 'Has SessionStart handler');
  }
  out('');

  out('--- Layer 3: Hook Wiring ---');
  const { settings, existed: sExisted, invalid: sInvalid } = loadSettings(SETTINGS_JSON);
  if (!sExisted) {
    record('fail', 'settings.json exists');
  } else if (sInvalid) {
    record('fail', 'settings.json valid JSON');
  } else {
    record('pass', 'settings.json valid JSON');
    const hookMap = settings.hooks || {};
    const stopHooks = hookMap.Stop?.[0]?.hooks || [];
    record(
      stopHooks.some((h) => typeof h?.command === 'string' && h.command.includes(HOOK_MARKER))
        ? 'pass'
        : 'fail',
      'Wired in Stop hooks'
    );
    const ssHooks = hookMap.SessionStart?.[0]?.hooks || [];
    record(
      ssHooks.some((h) => typeof h?.command === 'string' && h.command.includes(HOOK_MARKER))
        ? 'pass'
        : 'fail',
      'Wired in SessionStart hooks'
    );
  }
  out('');

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const warned = checks.filter((c) => c.status === 'warn').length;

  for (const c of checks) {
    const tag = c.status === 'pass' ? '[PASS]' : c.status === 'fail' ? '[FAIL]' : '[WARN]';
    out(`  ${tag} ${c.label}`);
  }

  out('\n============================================');
  out(` RESULTS: ${passed} passed, ${failed} failed, ${warned} warnings`);
  out('============================================');
  out(
    failed === 0
      ? '\n TOKEN SHIELD: ALL CHECKS PASSED'
      : '\n ISSUES FOUND — run: node bin/install.js'
  );

  return { checks, passed, failed, warned };
}

function main() {
  const { failed } = runValidation();
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { runValidation, main };

if (require.main === module) main();
