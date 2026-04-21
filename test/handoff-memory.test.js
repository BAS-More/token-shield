const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  findProjectMemory,
  createProjectMemory,
  findRecentHandoff,
  buildHandoffContent,
} = require('../src/lib/handoff-memory');
const { makeTmpDir } = require('./helpers/tmpdir');

test('findProjectMemory returns null when projectsDir missing', () => {
  const result = findProjectMemory(
    'C:/Dev/foo',
    path.join(require('node:os').tmpdir(), 'does-not-exist-x9')
  );
  assert.equal(result, null);
});

test('findProjectMemory picks the highest-scoring slug', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const projects = path.join(dir, 'projects');
    fs.mkdirSync(path.join(projects, 'C--Dev-token-shield', 'memory'), { recursive: true });
    fs.mkdirSync(path.join(projects, 'C--Dev-other-project', 'memory'), { recursive: true });
    const result = findProjectMemory('C:\\Dev\\token-shield', projects);
    assert.ok(result?.endsWith(path.join('C--Dev-token-shield', 'memory')));
  } finally {
    cleanup();
  }
});

test('createProjectMemory creates directory from cwd slug', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const projects = path.join(dir, 'projects');
    const memDir = createProjectMemory('C:\\Dev\\Foo Bar', projects);
    assert.ok(fs.existsSync(memDir));
    assert.match(memDir, /C-{1,2}Dev-Foo Bar/);
  } finally {
    cleanup();
  }
});

test('findRecentHandoff returns newest within window', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const older = path.join(dir, 'session_handoff_old.md');
    const newer = path.join(dir, 'session_handoff_auto.md');
    fs.writeFileSync(older, 'a');
    fs.writeFileSync(newer, 'b');
    const past = Date.now() - 3600_000;
    fs.utimesSync(older, past / 1000, past / 1000);
    const result = findRecentHandoff(dir);
    assert.ok(result);
    assert.equal(path.basename(result.path), 'session_handoff_auto.md');
  } finally {
    cleanup();
  }
});

test('findRecentHandoff filters out stale files', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const stale = path.join(dir, 'session_handoff_stale.md');
    fs.writeFileSync(stale, 'x');
    const tooOld = Date.now() - 48 * 3600_000;
    fs.utimesSync(stale, tooOld / 1000, tooOld / 1000);
    const result = findRecentHandoff(dir);
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('buildHandoffContent renders all required fields', () => {
  const content = buildHandoffContent({
    sessionId: 'abc-123',
    cwd: 'C:\\Dev\\token-shield',
    memDir: 'C:\\Users\\x\\.claude\\projects\\ts\\memory',
    sizeKB: 2400,
  });
  assert.match(content, /session_id: abc-123/);
  assert.match(content, /transcript_size_kb: 2400/);
  assert.match(content, /Session Handoff \(Auto-Generated\)/);
});
