const fs = require('node:fs');
const path = require('node:path');

/**
 * Read a JSON file. Strips UTF-8 BOM if present.
 * @param {string} filePath
 * @returns {{ data: unknown, hadBom: boolean }}
 */
function readJson(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  const hadBom = raw.charCodeAt(0) === 0xfeff;
  if (hadBom) raw = raw.slice(1);
  return { data: JSON.parse(raw), hadBom };
}

/**
 * Write JSON atomically via temp file + rename.
 * @param {string} filePath
 * @param {unknown} data
 * @param {number} indent
 */
function writeJsonAtomic(filePath, data, indent = 2) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, indent), 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Back up a file to `<file>.bak`, overwriting any previous backup.
 * No-op if source does not exist.
 * @param {string} filePath
 * @returns {string | null} backup path or null
 */
function backup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const bak = `${filePath}.bak`;
  fs.copyFileSync(filePath, bak);
  return bak;
}

module.exports = { readJson, writeJsonAtomic, backup };
