// Tests for validate.js binary check — accept cmd-wrapper portable form.
// Closes false-positive after .mcp.json was rewritten to use:
//   { "command": "cmd", "args": ["/c", "%APPDATA%\\npm\\context-mode.cmd"] }
// Validator was checking fs.existsSync('cmd') → false → spurious FAIL.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Helper: write a temp .mcp.json with the given context-mode shape, run validate against it,
// return captured stdout.
function runValidateOn(mcpShape) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-validate-'));
  const mcpPath = path.join(tmpDir, '.mcp.json');
  fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: { 'context-mode': mcpShape } }));

  // Capture stdout via Node's writable
  const lines = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { lines.push(String(chunk)); return true; };

  // Override env so MCP_JSON points at temp file (validate.js reads from $HOME/.claude/.mcp.json)
  const origHome = process.env.USERPROFILE || process.env.HOME;
  const fakeHome = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(fakeHome, '.claude', 'hooks'), { recursive: true });
  fs.copyFileSync(mcpPath, path.join(fakeHome, '.claude', '.mcp.json'));
  process.env.USERPROFILE = fakeHome;
  process.env.HOME = fakeHome;

  // Re-require validate fresh (cache-bust)
  delete require.cache[require.resolve('../src/validate.js')];
  let result;
  try {
    require('../src/validate.js').main();
  } catch (e) {
    result = { error: e.message };
  } finally {
    process.stdout.write = origWrite;
    process.env.USERPROFILE = origHome;
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  return { output: lines.join(''), result };
}

test('validate accepts cmd-wrapper form (command="cmd", args=["/c", "%APPDATA%\\\\..."]) as PASS', () => {
  const { output } = runValidateOn({
    command: 'cmd',
    args: ['/c', '%APPDATA%\\npm\\context-mode.cmd'],
    env: { CONTEXT_MODE_DB: '%USERPROFILE%\\.claude\\context-mode.db' },
  });
  // Expect PASS line, NOT FAIL, on the binary check
  assert.match(output, /\[PASS\] Binary exists: cmd \/c %APPDATA%/);
  assert.doesNotMatch(output, /\[FAIL\] Binary exists/);
});

test('validate still PASSes legacy direct-binary form when path exists', () => {
  // Create a fake binary file
  const tmpBin = path.join(os.tmpdir(), `fake-cm-${Date.now()}.cmd`);
  fs.writeFileSync(tmpBin, '@echo legacy stub');
  try {
    const { output } = runValidateOn({
      command: tmpBin,
      env: { CONTEXT_MODE_DB: 'C:\\fake\\db' },
    });
    assert.match(output, /\[PASS\] Binary exists/);
  } finally {
    fs.unlinkSync(tmpBin);
  }
});

test('validate FAILs when neither cmd-wrapper inner path nor direct binary exists', () => {
  const { output } = runValidateOn({
    command: '/nonexistent/binary.cmd',
    env: { CONTEXT_MODE_DB: 'x' },
  });
  assert.match(output, /\[FAIL\] Binary exists/);
});
