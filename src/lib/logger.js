/**
 * Optional fail-open logger that defers to `ezra-hook-logger` if present in the
 * installed hooks directory. Never throws; returns a no-op when unavailable.
 * @returns {(source: string, event: string, data?: unknown) => void}
 */
function resolveLogger() {
  try {
    // @ts-ignore — optional sibling in the deployed hooks dir, never present at build time
    const mod = require('./ezra-hook-logger');
    if (mod && typeof mod.logHookEvent === 'function') return mod.logHookEvent;
  } catch {
    // fall through — logger is optional
  }
  return () => {};
}

module.exports = { resolveLogger };
