const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function snapshot(dir) {
  return fs
    .readdirSync(dir)
    .sort()
    .map((name) => {
      const entry = path.join(dir, name);
      try {
        return [name, fs.readFileSync(entry, 'utf8')];
      } catch (error) {
        if (error.code !== 'EISDIR') throw error;
        return [name, snapshot(entry)];
      }
    });
}

function runInstaller(home, args) {
  const fixture = path.join(__dirname, 'helpers', 'install-fixture.js');
  return spawnSync(process.execPath, [fixture, home, ...args], { encoding: 'utf8', cwd: home });
}

for (const existingConfig of [false, true]) {
  test(`dry-run leaves ${existingConfig ? 'invalid existing configuration' : 'a fresh home'} unchanged`, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'token-shield-dry-'));
    try {
      if (existingConfig) {
        const config = path.join(home, '.claude');
        fs.mkdirSync(config);
        fs.writeFileSync(path.join(config, '.mcp.json'), '{invalid MCP JSON');
        fs.writeFileSync(path.join(config, 'settings.json'), '{invalid settings JSON');
      }
      const before = snapshot(home);
      for (const args of [['--dry-run'], ['--dry-run', '--skip-npm']]) {
        const result = runInstaller(home, args);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /DRY RUN/);
        assert.match(result.stdout, /validation is deferred/);
        assert.doesNotMatch(result.stdout, /ALL CHECKS PASSED|Installation complete/);
        assert.deepEqual(snapshot(home), before);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
}

test('verify still fails for a missing installation, even when dry-run is also supplied', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'token-shield-verify-'));
  try {
    for (const args of [['--verify'], ['--verify', '--dry-run']]) {
      const result = runInstaller(home, args);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /ISSUES FOUND/);
      assert.deepEqual(snapshot(home), []);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
