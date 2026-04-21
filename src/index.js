/**
 * Public API for programmatic consumers (tests, installers, custom tooling).
 * The CLI entry points are the `*.js` files next to this one.
 */

module.exports = {
  install: require('./install').install,
  runValidation: require('./validate').runValidation,
  runGapAnalysis: require('./gap-analysis').runGapAnalysis,
  lib: {
    paths: require('./lib/paths'),
    fsAtomic: require('./lib/fs-atomic'),
    settingsIo: require('./lib/settings-io'),
    mcpIo: require('./lib/mcp-io'),
    handoffMemory: require('./lib/handoff-memory'),
    logger: require('./lib/logger'),
  },
};
