const fs = require('node:fs');
const { readJson, writeJsonAtomic, backup } = require('./fs-atomic');
const { HOOK_TARGET } = require('./paths');

const HOOK_MARKER = 'token-shield-validator';

/**
 * Build a Claude Code hook entry pointing at the deployed validator.
 * @param {string} [target]
 * @returns {{ type: 'command', command: string, timeout: number }}
 */
function makeHookEntry(target = HOOK_TARGET) {
  const escaped = process.platform === 'win32' ? target.replace(/\\/g, '\\\\') : target;
  return { type: 'command', command: `node "${escaped}"`, timeout: 5 };
}

/**
 * @typedef {{ type: 'command', command: string, timeout: number }} HookEntry
 * @typedef {{ matcher?: string, hooks: HookEntry[] }} HookStage
 * @typedef {Record<string, HookStage[]>} HookMap
 * @typedef {{ hooks?: HookMap } & Record<string, unknown>} Settings
 */

/**
 * Load settings.json, tolerating missing file, BOM, and invalid JSON.
 * @param {string} filePath
 * @returns {{ settings: Settings, hadBom: boolean, existed: boolean, invalid: boolean }}
 */
function loadSettings(filePath) {
  if (!fs.existsSync(filePath)) {
    return { settings: { hooks: {} }, hadBom: false, existed: false, invalid: false };
  }
  try {
    const { data, hadBom } = readJson(filePath);
    const settings = data && typeof data === 'object' ? /** @type {Settings} */ (data) : {};
    return { settings, hadBom, existed: true, invalid: false };
  } catch {
    return { settings: { hooks: {} }, hadBom: false, existed: true, invalid: true };
  }
}

/**
 * Idempotently add the hook entry to SessionStart and Stop hook stages.
 * @param {Settings} settings
 * @param {HookEntry} entry
 * @returns {{ settings: Settings, sessionStartAdded: boolean, stopAdded: boolean }}
 */
function ensureHookWired(settings, entry) {
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  const hooks = /** @type {HookMap} */ (settings.hooks);

  /** @param {string} stage */
  const ensureStage = (stage) => {
    const current = hooks[stage];
    if (!Array.isArray(current) || current.length === 0) {
      hooks[stage] = [{ matcher: '', hooks: [entry] }];
      return true;
    }
    const bucket = current[0];
    if (!bucket || !Array.isArray(bucket.hooks)) {
      current[0] = { matcher: '', hooks: [entry] };
      return true;
    }
    const already = bucket.hooks.some(
      /** @param {HookEntry} h */
      (h) => h && typeof h.command === 'string' && h.command.includes(HOOK_MARKER)
    );
    if (already) return false;
    bucket.hooks.push(entry);
    return true;
  };

  return {
    settings,
    sessionStartAdded: ensureStage('SessionStart'),
    stopAdded: ensureStage('Stop'),
  };
}

/**
 * Persist settings to disk, stripping any BOM.
 * @param {string} filePath
 * @param {unknown} settings
 */
function saveSettings(filePath, settings) {
  backup(filePath);
  writeJsonAtomic(filePath, settings, 4);
}

module.exports = { HOOK_MARKER, makeHookEntry, loadSettings, ensureHookWired, saveSettings };
