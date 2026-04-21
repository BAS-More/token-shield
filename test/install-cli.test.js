const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../src/install');

test('parseArgs detects --dry-run', () => {
  const opts = parseArgs(['--dry-run']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.verifyOnly, false);
});

test('parseArgs detects --verify', () => {
  const opts = parseArgs(['--verify']);
  assert.equal(opts.verifyOnly, true);
});

test('parseArgs detects --skip-npm', () => {
  const opts = parseArgs(['--skip-npm']);
  assert.equal(opts.skipNpm, true);
});

test('parseArgs returns false flags by default', () => {
  const opts = parseArgs([]);
  assert.deepEqual(opts, { dryRun: false, verifyOnly: false, skipNpm: false });
});
