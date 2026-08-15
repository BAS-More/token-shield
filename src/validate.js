/**
 * Token Shield validator — verifies all 3 layers are installed and configured.
 * Prints a PASS/FAIL report and returns a structured result.
 */

const fs = require('node:fs');
const { HOOKS_DIR, MCP_JSON, SETTINGS_JSON, HOOK_TARGET, CONTEXT_MODE_DB } = require('./lib/paths');
const { loadMcp } = require('./lib/mcp-io');
const { loadSettings, HOOK_MARKER } = require('./lib/settings-io');

/** Plugin key L1 is registered under in settings.json `enabledPlugins`. */
const CONTEXT_MODE_PLUGIN_KEY = 'context-mode@context-mode';

/**
 * Expand Windows-style %VAR% references so a configured DB path can be stat'd.
 * @param {string} p
 * @returns {string}
 */
function expandEnvPath(p) {
  return p.replace(/%([^%]+)%/g, (whole, name) => process.env[name] ?? whole);
}

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

  // Settings are needed by BOTH Layer 1 (is the plugin actually enabled?) and Layer 3.
  const { settings, existed: sExisted, invalid: sInvalid } = loadSettings(SETTINGS_JSON);
  const settingsUsable = sExisted && !sInvalid;

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

      // The three checks above test PRESENCE (config entry, path string, file on disk).
      // All of them stay true when L1 is switched off, which is how this validator
      // reported 10/10 green through 45+ days of L1 being disabled. The two checks
      // below test whether L1 is actually OPERATING. They are warnings, not failures:
      // retiring L1 is a legitimate choice, but it must never read as "all passed".
      const enabledPlugins = /** @type {Record<string, unknown>} */ (
        settings.enabledPlugins ?? {}
      );
      const enabled = settingsUsable
        ? enabledPlugins[CONTEXT_MODE_PLUGIN_KEY] === true
        : undefined;
      if (enabled === undefined) {
        record('warn', 'L1 plugin enabled — UNKNOWN (settings.json unreadable)');
      } else {
        record(
          enabled ? 'pass' : 'warn',
          enabled
            ? `L1 plugin enabled (${CONTEXT_MODE_PLUGIN_KEY})`
            : `L1 plugin DISABLED — enabledPlugins["${CONTEXT_MODE_PLUGIN_KEY}"] is false; tool output is NOT sandboxed`
        );
      }

      const dbPath = cm.env?.CONTEXT_MODE_DB
        ? expandEnvPath(String(cm.env.CONTEXT_MODE_DB))
        : CONTEXT_MODE_DB;
      let dbStat = null;
      try {
        dbStat = fs.statSync(dbPath);
      } catch {
        dbStat = null;
      }
      if (dbStat) {
        const ageDays = Math.floor((Date.now() - dbStat.mtimeMs) / 86_400_000);
        record(
          ageDays <= 7 ? 'pass' : 'warn',
          `L1 store last written ${ageDays}d ago (${dbPath})`
        );
      } else {
        record('warn', `L1 store ABSENT — nothing at ${dbPath}; L1 has never written`);
      }
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
  // A green headline must mean the shield is OPERATING, not merely installed.
  // Warnings are L1-inactive signals: not build failures, but never "all passed".
  if (failed > 0) {
    out('\n ISSUES FOUND — run: node bin/install.js');
  } else if (warned > 0) {
    out('\n TOKEN SHIELD: DEGRADED — L2/L3 only, L1 is not operating.');
    out(' Tool output is NOT sandboxed to SQLite; it stays in context.');
    out(' Re-enable L1: set enabledPlugins["' + CONTEXT_MODE_PLUGIN_KEY + '"] = true in settings.json.');
    out(' If L1 was retired deliberately, drop the context-mode entry from .mcp.json so this stops warning.');
  } else {
    out('\n TOKEN SHIELD: ALL CHECKS PASSED');
  }

  return { checks, passed, failed, warned };
}

function main() {
  const { failed } = runValidation();
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { runValidation, main };

if (require.main === module) main();
