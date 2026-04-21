const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseArgs, findClaudeMd } = require('../src/gap-analysis');
const { makeTmpDir } = require('./helpers/tmpdir');

test('parseArgs supports --key value form', () => {
  const opts = parseArgs(['--cwd', '/a/b', '--claude-md', '/a/CLAUDE.md']);
  assert.equal(opts.cwd, '/a/b');
  assert.equal(opts.claudeMd, '/a/CLAUDE.md');
});

test('parseArgs supports --key=value form', () => {
  const opts = parseArgs(['--cwd=/c/d', '--claude-md=/c/CLAUDE.md']);
  assert.equal(opts.cwd, '/c/d');
  assert.equal(opts.claudeMd, '/c/CLAUDE.md');
});

test('parseArgs returns empty object without flags', () => {
  assert.deepEqual(parseArgs([]), {});
});

test('findClaudeMd walks up to 2 parent directories', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const deep = path.join(dir, 'a', 'b');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a', 'CLAUDE.md'), '# claude', 'utf8');
    const found = findClaudeMd(deep);
    assert.ok(found);
    assert.equal(path.basename(found), 'CLAUDE.md');
  } finally {
    cleanup();
  }
});

test('findClaudeMd returns null when not present', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    assert.equal(findClaudeMd(dir), null);
  } finally {
    cleanup();
  }
});
