#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

function run(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    shell: false,
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    error: result.error ? String(result.error.message || result.error) : '',
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function pathEntries() {
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .map((x) => x.trim())
    .filter(Boolean);
}

function main() {
  const commands = [];
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  commands.push(run(pnpmCmd, ['--version']));
  if (process.platform === 'win32') {
    commands.push(run('where.exe', ['pnpm']));
    commands.push(run('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-Command pnpm -All | Format-List Source,Version,CommandType | Out-String'
    ]));
  } else {
    commands.push(run('which', ['pnpm']));
  }

  const report = {
    process_platform: process.platform,
    process_exec_path: process.execPath,
    node_version: process.version,
    cwd: process.cwd(),
    shell: process.env.ComSpec || process.env.SHELL || '',
    npm_execpath: process.env.npm_execpath || '',
    npm_config_user_agent: process.env.npm_config_user_agent || '',
    COREPACK_ROOT: process.env.COREPACK_ROOT || '',
    PNPM_HOME: process.env.PNPM_HOME || '',
    WSL_DISTRO_NAME: process.env.WSL_DISTRO_NAME || '',
    WSL_INTEROP: process.env.WSL_INTEROP || '',
    path_entries_matching_wsl_or_corepack: pathEntries().filter((entry) => {
      const s = entry.replace(/\\/g, '/').toLowerCase();
      return s.includes('/home/') || s.includes('corepack') || s.includes('wsl');
    }),
    commands,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
