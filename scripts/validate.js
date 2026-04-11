#!/usr/bin/env node

/**
 * Token Shield — Validation Script
 * Verifies all 3 layers are installed and configured correctly.
 * Run: node scripts/validate.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const home = require('os').homedir();

let pass = 0, fail = 0, warn = 0;

function check(ok, label) {
  if (ok) { pass++; console.log('  [PASS] ' + label); }
  else { fail++; console.log('  [FAIL] ' + label); }
}
function warning(label) { warn++; console.log('  [WARN] ' + label); }

console.log('============================================');
console.log(' TOKEN SHIELD — VALIDATION');
console.log(' ' + new Date().toISOString());
console.log('============================================\n');

// Layer 1: Context Mode MCP
console.log('--- Layer 1: Context Mode MCP ---');
const mcpPath = path.join(home, '.claude', '.mcp.json');
if (fs.existsSync(mcpPath)) {
  try {
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    check(mcp.mcpServers && mcp.mcpServers['context-mode'], 'Context Mode in .mcp.json');
    if (mcp.mcpServers?.['context-mode']) {
      check(mcp.mcpServers['context-mode'].env?.CONTEXT_MODE_DB, 'DB path configured');
      const cmd = mcp.mcpServers['context-mode'].command || '';
      check(fs.existsSync(cmd), 'Binary exists: ' + cmd);
    }
  } catch (e) {
    check(false, '.mcp.json valid JSON');
  }
} else {
  check(false, '.mcp.json exists');
}
console.log('');

// Layer 2: Hook deployment
console.log('--- Layer 2: Hook Deployment ---');
const hookPath = path.join(home, '.claude', 'hooks', 'token-shield-validator.js');
check(fs.existsSync(hookPath), 'Hook deployed to ~/.claude/hooks/');
if (fs.existsSync(hookPath)) {
  const content = fs.readFileSync(hookPath, 'utf8');
  check(content.includes('THRESHOLD_KB'), 'Has threshold parameter');
  check(content.includes('handleStop'), 'Has Stop handler');
  check(content.includes('handleSessionStart'), 'Has SessionStart handler');
  check(content.includes('bestScore'), 'Uses best-score slug matching');
}
console.log('');

// Layer 3: Hook wiring
console.log('--- Layer 3: Hook Wiring ---');
const settingsPath = path.join(home, '.claude', 'settings.json');
if (fs.existsSync(settingsPath)) {
  try {
    let raw = fs.readFileSync(settingsPath, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      warning('settings.json has BOM — should be removed');
      raw = raw.slice(1);
    } else {
      check(true, 'settings.json no BOM');
    }
    const settings = JSON.parse(raw);
    check(true, 'settings.json valid JSON');

    const stopHooks = settings.hooks?.Stop?.[0]?.hooks || [];
    check(stopHooks.some(h => h.command?.includes('token-shield-validator')), 'Wired in Stop hooks');

    const ssHooks = settings.hooks?.SessionStart?.[0]?.hooks || [];
    check(ssHooks.some(h => h.command?.includes('token-shield-validator')), 'Wired in SessionStart hooks');
  } catch (e) {
    check(false, 'settings.json valid: ' + e.message);
  }
} else {
  check(false, 'settings.json exists');
}
console.log('');

// Summary
console.log('============================================');
console.log(' RESULTS: ' + pass + ' passed, ' + fail + ' failed, ' + warn + ' warnings');
console.log('============================================');
if (fail === 0) {
  console.log('\n TOKEN SHIELD: ALL CHECKS PASSED');
} else {
  console.log('\n ISSUES FOUND — run: node bin/install.js');
}

process.exit(fail > 0 ? 1 : 0);
