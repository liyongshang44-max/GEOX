const { spawnSync } = require('node:child_process');
const path = require('node:path');

function ensureTsxRuntime() {
  if (process.env.GEOX_ACCEPTANCE_TSX_RUNTIME === '1') return;

  const script = process.argv[1];
  const args = process.argv.slice(2);

  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', script, ...args],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        GEOX_ACCEPTANCE_TSX_RUNTIME: '1',
      },
      cwd: process.cwd(),
    },
  );

  process.exit(result.status ?? 1);
}

module.exports = { ensureTsxRuntime };
