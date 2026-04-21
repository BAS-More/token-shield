const path = require('node:path');
const os = require('node:os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const MCP_JSON = path.join(CLAUDE_DIR, '.mcp.json');
const SETTINGS_JSON = path.join(CLAUDE_DIR, 'settings.json');
const CONTEXT_MODE_DB = path.join(CLAUDE_DIR, 'context-mode.db');
const HOOK_TARGET = path.join(HOOKS_DIR, 'token-shield-validator.js');

module.exports = {
  HOME,
  CLAUDE_DIR,
  HOOKS_DIR,
  PROJECTS_DIR,
  MCP_JSON,
  SETTINGS_JSON,
  CONTEXT_MODE_DB,
  HOOK_TARGET,
};
