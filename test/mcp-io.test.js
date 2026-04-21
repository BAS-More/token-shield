const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadMcp, ensureContextModeServer, saveMcp } = require('../src/lib/mcp-io');
const { makeTmpDir } = require('./helpers/tmpdir');

test('loadMcp returns empty scaffold when file missing', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'missing.json');
    const { mcp, existed, invalid } = loadMcp(file);
    assert.equal(existed, false);
    assert.equal(invalid, false);
    assert.deepEqual(mcp, { mcpServers: {} });
  } finally {
    cleanup();
  }
});

test('loadMcp tolerates invalid JSON and flags it', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{', 'utf8');
    const { mcp, existed, invalid } = loadMcp(file);
    assert.equal(existed, true);
    assert.equal(invalid, true);
    assert.deepEqual(mcp, { mcpServers: {} });
    assert.ok(fs.existsSync(`${file}.bak`));
  } finally {
    cleanup();
  }
});

test('ensureContextModeServer adds entry with expected shape', () => {
  const { mcp, added } = ensureContextModeServer({ mcpServers: {} }, '/usr/bin/context-mode');
  assert.equal(added, true);
  assert.equal(mcp.mcpServers['context-mode'].command, '/usr/bin/context-mode');
  assert.ok(mcp.mcpServers['context-mode'].env.CONTEXT_MODE_DB);
  assert.deepEqual(mcp.mcpServers['context-mode'].args, []);
});

test('ensureContextModeServer is idempotent', () => {
  const initial = ensureContextModeServer({ mcpServers: {} }, '/usr/bin/context-mode').mcp;
  const again = ensureContextModeServer(initial, '/usr/bin/context-mode');
  assert.equal(again.added, false);
});

test('saveMcp persists atomically', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'mcp.json');
    saveMcp(file, { mcpServers: { foo: { command: '/x' } } });
    const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(loaded, { mcpServers: { foo: { command: '/x' } } });
  } finally {
    cleanup();
  }
});
