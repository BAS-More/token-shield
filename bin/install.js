#!/usr/bin/env node

/**
 * Token Shield Installer
 *
 * Cross-platform installer that:
 * 1. Copies token-shield-validator.js to ~/.claude/hooks/
 * 2. Installs context-mode globally if not present
 * 3. Adds context-mode to ~/.claude/.mcp.json (preserving existing entries)
 * 4. Adds SessionStart + Stop hooks to ~/.claude/settings.json (preserving existing)
 * 5. Runs validation to confirm everything works
 *
 * Usage:
 *   node bin/install.js           # Full install
 *   node bin/install.js --dry-run # Show what would be done without changes
 *   node bin/install.js --verify  # Just run validation
 *
 * Zero dependencies. Node.js 16+ only.
 * Note: Uses execSync with hardcoded commands only (no user input) — safe from injection.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const MCP_JSON = path.join(CLAUDE_DIR, '.mcp.json');
const SETTINGS_JSON = path.join(CLAUDE_DIR, 'settings.json');
const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_SRC = path.join(REPO_ROOT, 'hooks', 'token-shield-validator.js');

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  [OK] ${msg}`); }
function skip(msg) { console.log(`  [SKIP] ${msg}`); }
function fail(msg) { console.log(`  [FAIL] ${msg}`); }

// ─── Main ───────────────────────────────────────────────────────

function main() {
  console.log('\n=== Token Shield Installer ===\n');

  if (DRY_RUN) log('DRY RUN — no changes will be made\n');
  if (VERIFY_ONLY) {
    runValidation();
    return;
  }

  ensureDir(CLAUDE_DIR);
  ensureDir(HOOKS_DIR);
  copyHook();
  installContextMode();
  configureMcp();
  configureHooks();

  console.log('\n--- Validation ---');
  runValidation();

  console.log('\n=== Installation complete ===\n');
}

// ─── Step implementations ───────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
    ok(`Created ${dir}`);
  }
}

function copyHook() {
  console.log('--- Step 1: Deploy hook ---');
  const dest = path.join(HOOKS_DIR, 'token-shield-validator.js');

  if (!fs.existsSync(HOOK_SRC)) {
    fail(`Source hook not found: ${HOOK_SRC}`);
    process.exit(1);
  }

  if (!DRY_RUN) {
    fs.copyFileSync(HOOK_SRC, dest);
  }
  ok(`Copied token-shield-validator.js to ${HOOKS_DIR}`);
}

function installContextMode() {
  console.log('\n--- Step 2: Context Mode MCP ---');

  try {
    // Hardcoded command, no user input — safe from injection
    const result = execSync('npm list -g context-mode --depth=0 2>&1', { encoding: 'utf8' });
    if (result.includes('context-mode@')) {
      skip('context-mode already installed globally');
      return;
    }
  } catch (_) {}

  log('Installing context-mode globally...');
  if (!DRY_RUN) {
    try {
      // Hardcoded command, no user input
      execSync('npm install -g context-mode', { stdio: 'inherit', timeout: 120000 });
      ok('context-mode installed');
    } catch (err) {
      fail('npm install failed. Run manually: npm install -g context-mode');
    }
  } else {
    log('Would run: npm install -g context-mode');
  }
}

function configureMcp() {
  console.log('\n--- Step 3: Configure MCP ---');

  let mcp = { mcpServers: {} };
  if (fs.existsSync(MCP_JSON)) {
    try {
      mcp = JSON.parse(fs.readFileSync(MCP_JSON, 'utf8'));
    } catch (_) {
      fail('.mcp.json invalid JSON — backing up and recreating');
      if (!DRY_RUN) fs.copyFileSync(MCP_JSON, MCP_JSON + '.bak');
    }
  }

  if (!mcp.mcpServers) mcp.mcpServers = {};

  if (mcp.mcpServers['context-mode']) {
    skip('context-mode already in .mcp.json');
    return;
  }

  // Find context-mode binary
  let cmBin = '';
  try {
    // Hardcoded commands — safe from injection
    if (process.platform === 'win32') {
      cmBin = execSync('where context-mode.cmd 2>nul', { encoding: 'utf8' }).trim().split('\n')[0];
    } else {
      cmBin = execSync('which context-mode 2>/dev/null', { encoding: 'utf8' }).trim();
    }
  } catch (_) {}

  if (!cmBin) {
    const npmGlobal = path.join(HOME, 'AppData', 'Roaming', 'npm', 'context-mode.cmd');
    const unixGlobal = '/usr/local/bin/context-mode';
    if (fs.existsSync(npmGlobal)) cmBin = npmGlobal;
    else if (fs.existsSync(unixGlobal)) cmBin = unixGlobal;
  }

  if (!cmBin) {
    fail('Cannot find context-mode binary. Install: npm install -g context-mode');
    return;
  }

  mcp.mcpServers['context-mode'] = {
    command: cmBin.replace(/\//g, path.sep),
    args: [],
    env: { CONTEXT_MODE_DB: path.join(CLAUDE_DIR, 'context-mode.db') }
  };

  if (!DRY_RUN) {
    fs.writeFileSync(MCP_JSON, JSON.stringify(mcp, null, 2), 'utf8');
  }
  ok(`Added context-mode to .mcp.json (binary: ${cmBin})`);
}

function configureHooks() {
  console.log('\n--- Step 4: Configure hooks in settings.json ---');

  if (!fs.existsSync(SETTINGS_JSON)) {
    const settings = {
      hooks: {
        SessionStart: [{ matcher: '', hooks: [makeHookEntry()] }],
        Stop: [{ matcher: '', hooks: [makeHookEntry()] }]
      }
    };
    if (!DRY_RUN) {
      fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2), 'utf8');
    }
    ok('Created settings.json with Token Shield hooks');
    return;
  }

  let raw = fs.readFileSync(SETTINGS_JSON, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  let settings;
  try { settings = JSON.parse(raw); } catch (err) {
    fail('settings.json invalid JSON: ' + err.message);
    return;
  }

  if (!settings.hooks) settings.hooks = {};
  const hookCmd = makeHookEntry();

  // SessionStart
  let added = false;
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [{ matcher: '', hooks: [hookCmd] }];
    added = true;
  } else {
    const ssHooks = settings.hooks.SessionStart[0]?.hooks || [];
    if (!ssHooks.some(h => h.command && h.command.includes('token-shield-validator'))) {
      ssHooks.push(hookCmd);
      settings.hooks.SessionStart[0].hooks = ssHooks;
      added = true;
    }
  }
  if (added) ok('Added Token Shield to SessionStart hooks');
  else skip('Token Shield already in SessionStart hooks');

  // Stop
  added = false;
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [{ matcher: '', hooks: [hookCmd] }];
    added = true;
  } else {
    const stopHooks = settings.hooks.Stop[0]?.hooks || [];
    if (!stopHooks.some(h => h.command && h.command.includes('token-shield-validator'))) {
      stopHooks.push(hookCmd);
      settings.hooks.Stop[0].hooks = stopHooks;
      added = true;
    }
  }
  if (added) ok('Added Token Shield to Stop hooks');
  else skip('Token Shield already in Stop hooks');

  if (!DRY_RUN) {
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 4), 'utf8');
  }
}

function makeHookEntry() {
  const hookPath = path.join(HOOKS_DIR, 'token-shield-validator.js');
  const escaped = process.platform === 'win32'
    ? hookPath.replace(/\\/g, '\\\\')
    : hookPath;
  return { type: 'command', command: `node "${escaped}"`, timeout: 5 };
}

function runValidation() {
  const validateScript = path.join(REPO_ROOT, 'scripts', 'validate.js');
  if (fs.existsSync(validateScript)) {
    try {
      // Hardcoded path — safe from injection
      execSync(`node "${validateScript}"`, { stdio: 'inherit' });
    } catch (_) {}
  } else {
    log('Validation script not found at ' + validateScript);
  }
}

main();
