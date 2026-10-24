const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function runValidateOn(mcpShape) {
  const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-validate-'));
  fs.mkdirSync(path.join(fixtureHome, '.claude', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureHome, '.claude', '.mcp.json'),
    JSON.stringify({ mcpServers: { 'context-mode': mcpShape } })
  );
  const homeMock = test.mock.method(os, 'homedir', () => fixtureHome);
  const modulePaths = ['../src/validate.js', '../src/lib/paths.js'];
  for (const modulePath of modulePaths) delete require.cache[require.resolve(modulePath)];
  try {
    return require('../src/validate.js').runValidation({ silent: true });
  } finally {
    homeMock.mock.restore();
    for (const modulePath of modulePaths) delete require.cache[require.resolve(modulePath)];
    fs.rmSync(fixtureHome, { recursive: true, force: true });
  }
}

function binaryCheck(shape) {
  return runValidateOn(shape).checks.find((check) => check.label.startsWith('Binary exists:'));
}

test('validate accepts cmd wrapper only when its expanded target exists', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-cmd-'));
  const binary = path.join(fixtureDir, 'context-mode.cmd');
  fs.writeFileSync(binary, '@echo fixture');
  try {
    const shape = {
      command: 'cmd',
      args: ['/c', '%TOKEN_SHIELD_TEST_BIN%'],
      env: { TOKEN_SHIELD_TEST_BIN: binary, CONTEXT_MODE_DB: 'test.db' },
    };
    assert.equal(binaryCheck(shape).status, 'pass');
    fs.unlinkSync(binary);
    assert.equal(binaryCheck(shape).status, 'fail');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('validate accepts an existing direct binary and rejects a missing one', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-direct-'));
  const binary = path.join(fixtureDir, 'context-mode.cmd');
  fs.writeFileSync(binary, '@echo fixture');
  try {
    const shape = { command: binary, env: { CONTEXT_MODE_DB: 'test.db' } };
    assert.equal(binaryCheck(shape).status, 'pass');
    fs.unlinkSync(binary);
    assert.equal(binaryCheck(shape).status, 'fail');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('validate rejects a cmd wrapper without a target', () => {
  assert.equal(binaryCheck({ command: 'cmd', args: ['/c'] }).status, 'fail');
});
