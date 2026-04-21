/**
 * Token Shield installer — deploys hook, configures Context Mode MCP, wires
 * SessionStart and Stop hooks, and runs validation. Safe to re-run.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { CLAUDE_DIR, HOOKS_DIR, MCP_JSON, SETTINGS_JSON, HOOK_TARGET } = require('./lib/paths');
const { loadMcp, ensureContextModeServer, findContextModeBin, saveMcp } = require('./lib/mcp-io');
const { loadSettings, ensureHookWired, makeHookEntry, saveSettings } = require('./lib/settings-io');
const { runValidation } = require('./validate');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_SRC = path.join(REPO_ROOT, 'hooks', 'token-shield-validator.js');

const colors = {
  /** @param {string} msg */ log: (msg) => console.log(`  ${msg}`),
  /** @param {string} msg */ ok: (msg) => console.log(`  [OK] ${msg}`),
  /** @param {string} msg */ skip: (msg) => console.log(`  [SKIP] ${msg}`),
  /** @param {string} msg */ fail: (msg) => console.log(`  [FAIL] ${msg}`),
};

/**
 * @typedef {object} InstallOptions
 * @property {boolean} [dryRun]
 * @property {boolean} [verifyOnly]
 * @property {boolean} [skipNpm]
 */

/**
 * Run the installer end-to-end.
 * @param {InstallOptions} [options]
 * @returns {{ ok: boolean }}
 */
function install(options = {}) {
  const { dryRun = false, verifyOnly = false, skipNpm = false } = options;

  console.log('\n=== Token Shield Installer ===\n');

  if (dryRun) colors.log('DRY RUN — no changes will be made\n');
  if (verifyOnly) {
    return { ok: runValidation().failed === 0 };
  }

  ensureDir(CLAUDE_DIR, dryRun);
  ensureDir(HOOKS_DIR, dryRun);
  deployHook(dryRun);
  installContextMode(dryRun, skipNpm);
  configureMcp(dryRun);
  configureHooks(dryRun);

  console.log('\n--- Validation ---');
  const { failed } = runValidation();

  console.log('\n=== Installation complete ===\n');
  return { ok: failed === 0 };
}

/** @param {string} dir @param {boolean} dryRun */
function ensureDir(dir, dryRun) {
  if (fs.existsSync(dir)) return;
  if (!dryRun) fs.mkdirSync(dir, { recursive: true });
  colors.ok(`Created ${dir}`);
}

/** @param {boolean} dryRun */
function deployHook(dryRun) {
  console.log('--- Step 1: Deploy hook ---');
  if (!fs.existsSync(HOOK_SRC)) {
    colors.fail(`Source hook not found: ${HOOK_SRC}`);
    throw new Error(`missing hook source at ${HOOK_SRC}`);
  }
  if (!dryRun) fs.copyFileSync(HOOK_SRC, HOOK_TARGET);
  colors.ok(`Copied token-shield-validator.js to ${HOOKS_DIR}`);
}

/** @param {boolean} dryRun @param {boolean} skipNpm */
function installContextMode(dryRun, skipNpm) {
  console.log('\n--- Step 2: Context Mode MCP ---');

  if (skipNpm) {
    colors.skip('npm install skipped (--skip-npm)');
    return;
  }

  try {
    const out = execFileSync('npm', ['list', '-g', 'context-mode', '--depth=0'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (out.includes('context-mode@')) {
      colors.skip('context-mode already installed globally');
      return;
    }
  } catch {
    // not installed — fall through
  }

  colors.log('Installing context-mode globally...');
  if (dryRun) {
    colors.log('Would run: npm install -g context-mode');
    return;
  }
  try {
    execFileSync('npm', ['install', '-g', 'context-mode'], {
      stdio: 'inherit',
      timeout: 120_000,
    });
    colors.ok('context-mode installed');
  } catch {
    colors.fail('npm install failed. Run manually: npm install -g context-mode');
  }
}

/** @param {boolean} dryRun */
function configureMcp(dryRun) {
  console.log('\n--- Step 3: Configure MCP ---');

  const { mcp, invalid } = loadMcp(MCP_JSON);
  if (invalid) colors.fail('.mcp.json invalid JSON — backing up and recreating');

  if (mcp.mcpServers['context-mode']) {
    colors.skip('context-mode already in .mcp.json');
    return;
  }

  const binary = findContextModeBin();
  if (!binary) {
    colors.fail('Cannot find context-mode binary. Install: npm install -g context-mode');
    return;
  }

  const { mcp: next } = ensureContextModeServer(mcp, binary);
  if (!dryRun) saveMcp(MCP_JSON, next);
  colors.ok(`Added context-mode to .mcp.json (binary: ${binary})`);
}

/** @param {boolean} dryRun */
function configureHooks(dryRun) {
  console.log('\n--- Step 4: Configure hooks in settings.json ---');

  const { settings, existed, invalid } = loadSettings(SETTINGS_JSON);
  if (invalid) {
    colors.fail('settings.json invalid JSON — aborting to avoid data loss');
    return;
  }

  const entry = makeHookEntry();
  const { settings: next, sessionStartAdded, stopAdded } = ensureHookWired(settings, entry);

  if (!existed) {
    colors.ok('Will create settings.json with Token Shield hooks');
  } else {
    if (sessionStartAdded) colors.ok('Added Token Shield to SessionStart hooks');
    else colors.skip('Token Shield already in SessionStart hooks');
    if (stopAdded) colors.ok('Added Token Shield to Stop hooks');
    else colors.skip('Token Shield already in Stop hooks');
  }

  if (!dryRun) saveSettings(SETTINGS_JSON, next);
}

/** @param {readonly string[]} argv */
function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    verifyOnly: argv.includes('--verify'),
    skipNpm: argv.includes('--skip-npm'),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const { ok } = install(options);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\n[ERROR] Installer failed:', message);
    process.exit(1);
  }
}

module.exports = { install, parseArgs, main };

if (require.main === module) main();
