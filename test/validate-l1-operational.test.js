// Tests for the L1 operational checks.
//
// Regression guard for the 2026-08-16 finding: the validator reported
// "10 passed, 0 failed / ALL CHECKS PASSED" for 45+ days while L1 was disabled
// and its SQLite store did not exist. All three original L1 checks test
// PRESENCE (config entry, path string, binary on disk) and stay true when the
// plugin is switched off. These tests pin the OPERATIONAL checks that replaced
// that false green.
//
// Uses runValidation({silent:true}) rather than main() — main() calls
// process.exit(), which kills the test runner mid-file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_KEY = 'context-mode@context-mode';

/**
 * Build a throwaway ~/.claude, point HOME/USERPROFILE at it, and run the validator.
 * @param {{enabled?: boolean, storeAgeDays?: number|null}} opts
 */
function runWith({ enabled, storeAgeDays }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-l1-'));
  const home = path.join(tmpDir, 'home');
  const claude = path.join(home, '.claude');
  const hooks = path.join(claude, 'hooks');
  fs.mkdirSync(hooks, { recursive: true });

  const dbPath = path.join(claude, 'context-mode.db');

  // A binary that genuinely exists, so the presence checks pass and the only
  // variable under test is whether L1 is OPERATING.
  const fakeBin = path.join(tmpDir, 'context-mode.cmd');
  fs.writeFileSync(fakeBin, '@echo stub');

  fs.writeFileSync(
    path.join(claude, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        'context-mode': { command: fakeBin, env: { CONTEXT_MODE_DB: dbPath } },
      },
    })
  );

  // L2/L3 satisfied so they cannot pollute the pass/warn counts.
  const hookTarget = path.join(hooks, 'token-shield-validator.js');
  fs.writeFileSync(hookTarget, 'THRESHOLD_KB handleStop handleSessionStart');
  const hookEntry = { hooks: [{ type: 'command', command: `node "${hookTarget}"` }] };
  fs.writeFileSync(
    path.join(claude, 'settings.json'),
    JSON.stringify({
      enabledPlugins: { [PLUGIN_KEY]: enabled },
      hooks: { Stop: [hookEntry], SessionStart: [hookEntry] },
    })
  );

  if (storeAgeDays !== null && storeAgeDays !== undefined) {
    fs.writeFileSync(dbPath, 'x');
    const when = new Date(Date.now() - storeAgeDays * 86_400_000);
    fs.utimesSync(dbPath, when, when);
  }

  const origUser = process.env.USERPROFILE;
  const origHome = process.env.HOME;
  process.env.USERPROFILE = home;
  process.env.HOME = home;

  try {
    delete require.cache[require.resolve('../src/lib/paths.js')];
    delete require.cache[require.resolve('../src/validate.js')];
    return require('../src/validate.js').runValidation({ silent: true });
  } finally {
    process.env.USERPROFILE = origUser;
    process.env.HOME = origHome;
    delete require.cache[require.resolve('../src/lib/paths.js')];
    delete require.cache[require.resolve('../src/validate.js')];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const labels = (r) => r.checks.map((c) => `${c.status}:${c.label}`).join('\n');

test('L1 disabled + no store => warnings, and NOT a clean pass', () => {
  const r = runWith({ enabled: false, storeAgeDays: null });
  assert.match(labels(r), /warn:L1 plugin DISABLED/);
  assert.match(labels(r), /warn:L1 store ABSENT/);
  assert.equal(r.failed, 0, 'a retired L1 is not a build failure');
  assert.ok(r.warned >= 2, `expected >=2 warnings, got ${r.warned}`);
});

test('the presence checks still pass while L1 is off — this was the false green', () => {
  const r = runWith({ enabled: false, storeAgeDays: null });
  const text = labels(r);
  assert.match(text, /pass:Context Mode in \.mcp\.json/);
  assert.match(text, /pass:DB path configured/);
  assert.match(text, /pass:Binary exists/);
  // ...yet the run as a whole must not be clean.
  assert.ok(r.warned > 0, 'presence-only greens must not produce a clean result');
});

test('L1 enabled with a fresh store => clean, zero warnings', () => {
  const r = runWith({ enabled: true, storeAgeDays: 0 });
  assert.equal(r.failed, 0);
  assert.equal(r.warned, 0, `expected no warnings, got: ${labels(r)}`);
  assert.match(labels(r), /pass:L1 plugin enabled/);
  assert.match(labels(r), /pass:L1 store last written 0d ago/);
});

test('L1 enabled but store stale (>7d) => warns on staleness', () => {
  const r = runWith({ enabled: true, storeAgeDays: 45 });
  assert.match(labels(r), /warn:L1 store last written 45d ago/);
  assert.equal(r.failed, 0);
});

test('enabledPlugins missing entirely is treated as disabled, not as pass', () => {
  const r = runWith({ enabled: undefined, storeAgeDays: 0 });
  assert.match(labels(r), /warn:L1 plugin DISABLED/);
});
