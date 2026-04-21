const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readJson, writeJsonAtomic, backup } = require('../src/lib/fs-atomic');
const { makeTmpDir } = require('./helpers/tmpdir');

test('readJson parses valid JSON', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'a.json');
    fs.writeFileSync(file, '{"x":1}', 'utf8');
    const { data, hadBom } = readJson(file);
    assert.deepEqual(data, { x: 1 });
    assert.equal(hadBom, false);
  } finally {
    cleanup();
  }
});

test('readJson strips UTF-8 BOM', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'bom.json');
    fs.writeFileSync(file, '\uFEFF{"y":2}', 'utf8');
    const { data, hadBom } = readJson(file);
    assert.deepEqual(data, { y: 2 });
    assert.equal(hadBom, true);
  } finally {
    cleanup();
  }
});

test('readJson throws on invalid JSON', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{not json', 'utf8');
    assert.throws(() => readJson(file));
  } finally {
    cleanup();
  }
});

test('writeJsonAtomic creates file with formatted JSON', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'nested', 'out.json');
    writeJsonAtomic(file, { hello: 'world' }, 2);
    assert.ok(fs.existsSync(file));
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /"hello": "world"/);
  } finally {
    cleanup();
  }
});

test('writeJsonAtomic replaces existing file', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'out.json');
    writeJsonAtomic(file, { a: 1 });
    writeJsonAtomic(file, { a: 2 });
    const { data } = readJson(file);
    assert.deepEqual(data, { a: 2 });
  } finally {
    cleanup();
  }
});

test('backup copies file to .bak', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const file = path.join(dir, 'orig.txt');
    fs.writeFileSync(file, 'hello', 'utf8');
    const bak = backup(file);
    assert.equal(bak, `${file}.bak`);
    assert.equal(fs.readFileSync(bak, 'utf8'), 'hello');
  } finally {
    cleanup();
  }
});

test('backup is a no-op when file missing', () => {
  const { dir, cleanup } = makeTmpDir();
  try {
    const bak = backup(path.join(dir, 'missing.txt'));
    assert.equal(bak, null);
  } finally {
    cleanup();
  }
});
