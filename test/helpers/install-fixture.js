const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

// A separate process isolates the home-directory override from concurrent tests.
// With no fixture arguments this helper is inert during node --test discovery.
if (require.main === module && process.argv[2]) {
  const home = process.argv[2];
  os.homedir = () => home;
  childProcess.execFileSync = () => {
    throw new Error('dry-run must not launch subprocesses');
  };
  process.argv = [
    process.execPath,
    path.resolve(__dirname, '../../bin/install.js'),
    ...process.argv.slice(3),
  ];
  require('../../bin/install.js');
}
