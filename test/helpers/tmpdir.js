const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Create a fresh tmp directory for a test. Caller must call the returned
 * cleanup function (usually in an `after` hook).
 * @param {string} prefix
 * @returns {{ dir: string, cleanup: () => void }}
 */
function makeTmpDir(prefix = 'token-shield-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

module.exports = { makeTmpDir };
