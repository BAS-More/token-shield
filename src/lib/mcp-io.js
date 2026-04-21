const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readJson, writeJsonAtomic, backup } = require('./fs-atomic');
const { HOME, CONTEXT_MODE_DB } = require('./paths');

/**
 * Locate the globally installed context-mode binary.
 * @returns {string | null}
 */
function findContextModeBin() {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const arg = process.platform === 'win32' ? 'context-mode.cmd' : 'context-mode';
    const out = execFileSync(cmd, [arg], { encoding: 'utf8' }).trim();
    const first = out.split(/\r?\n/)[0];
    if (first) return first;
  } catch {
    // fall through
  }

  const candidates = [
    path.join(HOME, 'AppData', 'Roaming', 'npm', 'context-mode.cmd'),
    '/usr/local/bin/context-mode',
    '/opt/homebrew/bin/context-mode',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @typedef {{ command: string, args?: string[], env?: Record<string, string> }} McpServer
 * @typedef {{ mcpServers: Record<string, McpServer> }} McpConfig
 */

/**
 * Load .mcp.json, tolerating missing file and invalid JSON.
 * @param {string} filePath
 * @returns {{ mcp: McpConfig, existed: boolean, invalid: boolean }}
 */
function loadMcp(filePath) {
  if (!fs.existsSync(filePath)) {
    return { mcp: { mcpServers: {} }, existed: false, invalid: false };
  }
  try {
    const { data } = readJson(filePath);
    const mcp = /** @type {McpConfig} */ (data && typeof data === 'object' ? data : {});
    if (!mcp.mcpServers || typeof mcp.mcpServers !== 'object') mcp.mcpServers = {};
    return { mcp, existed: true, invalid: false };
  } catch {
    backup(filePath);
    return { mcp: { mcpServers: {} }, existed: true, invalid: true };
  }
}

/**
 * Idempotently add the context-mode server entry.
 * @param {McpConfig} mcp
 * @param {string} binary
 * @returns {{ mcp: McpConfig, added: boolean }}
 */
function ensureContextModeServer(mcp, binary) {
  if (mcp.mcpServers['context-mode']) return { mcp, added: false };
  mcp.mcpServers['context-mode'] = {
    command: binary,
    args: [],
    env: { CONTEXT_MODE_DB },
  };
  return { mcp, added: true };
}

/**
 * Persist .mcp.json to disk.
 * @param {string} filePath
 * @param {unknown} mcp
 */
function saveMcp(filePath, mcp) {
  backup(filePath);
  writeJsonAtomic(filePath, mcp, 2);
}

module.exports = { findContextModeBin, loadMcp, ensureContextModeServer, saveMcp };
