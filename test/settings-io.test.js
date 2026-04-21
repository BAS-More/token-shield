const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  HOOK_MARKER,
  makeHookEntry,
  loadSettings,
  ensureHookWired,
  saveSettings,
} = require('../src/lib/settings-io');
const { makeTmpDir } = require('./helpers/tmpdir');

test('makeHookEntry builds a command entry with default target', () => {
  const entry = makeHookEntry('/fake/token-shield-validator.js');
  assert.equal(entry.type, 'command');
  assert.equal(entry.timeout, 5);
  assert.match(entry.command, /node "/);
  assert.match(entry.command, /token-shield-validator/);
});

test('loadSettings returns defaults when file missing', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'missing.json');
    const { settings, existed, invalid } = loadSettings(file);
    assert.equal(existed, false);
    assert.equal(invalid, false);
    assert.deepEqual(settings, { hooks: {} });
  } finally {
    cleanup();
  }
});

test('loadSettings flags invalid JSON without throwing', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{invalid', 'utf8');
    const { settings, existed, invalid } = loadSettings(file);
    assert.equal(existed, true);
    assert.equal(invalid, true);
    assert.deepEqual(settings, { hooks: {} });
  } finally {
    cleanup();
  }
});

test('ensureHookWired creates missing stages', () => {
  const settings = {};
  const entry = makeHookEntry('/fake/token-shield-validator.js');
  const result = ensureHookWired(settings, entry);
  assert.equal(result.sessionStartAdded, true);
  assert.equal(result.stopAdded, true);
  assert.ok(Array.isArray(result.settings.hooks.SessionStart));
  assert.ok(Array.isArray(result.settings.hooks.Stop));
});

test('ensureHookWired is idempotent', () => {
  const entry = makeHookEntry('/fake/token-shield-validator.js');
  const first = ensureHookWired({}, entry).settings;
  const second = ensureHookWired(first, entry);
  assert.equal(second.sessionStartAdded, false);
  assert.equal(second.stopAdded, false);
});

test('ensureHookWired preserves existing unrelated hooks', () => {
  const existing = {
    hooks: {
      SessionStart: [
        { matcher: '', hooks: [{ type: 'command', command: 'node /other.js', timeout: 5 }] },
      ],
    },
  };
  const result = ensureHookWired(existing, makeHookEntry('/fake/token-shield-validator.js'));
  assert.equal(result.sessionStartAdded, true);
  const hooks = result.settings.hooks.SessionStart[0].hooks;
  assert.equal(hooks.length, 2);
  assert.match(hooks[0].command, /other\.js/);
  assert.match(hooks[1].command, new RegExp(HOOK_MARKER));
});

test('saveSettings writes file and creates backup if previous existed', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, '{"hooks":{}}', 'utf8');
    saveSettings(file, { hooks: { SessionStart: [] } });
    assert.ok(fs.existsSync(file));
    assert.ok(fs.existsSync(`${file}.bak`));
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(content, { hooks: { SessionStart: [] } });
  } finally {
    cleanup();
  }
});
