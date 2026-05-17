#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const COMMANDS = [
  {
    name: 'full_base_contract',
    command: 'pnpm',
    args: ['run', 'ci:governance:full-base-contract'],
    gate: 'governance',
  },
  {
    name: 'formal_scenario_no_projection_write',
    command: 'pnpm',
    args: ['run', 'ci:governance:formal-scenario-no-projection-write'],
    gate: 'governance',
  },
  {
    name: 'p06_formal_scenario_architecture_closure',
    command: 'pnpm',
    args: ['run', 'ci:governance:p06-formal-scenario-architecture-closure'],
    gate: 'governance',
  },
  {
    name: 'formal_scenario_e2e',
    command: 'pnpm',
    args: ['run', 'ci:scenario:formal-e2e'],
    gate: 'formal_scenario_e2e',
  },
  {
    name: 'server_typecheck',
    command: 'pnpm',
    args: ['--filter', '@geox/server', 'typecheck'],
    gate: 'typecheck',
  },
  {
    name: 'web_typecheck',
    command: 'pnpm',
    args: ['--filter', '@geox/web', 'typecheck'],
    gate: 'typecheck',
  },
];

function runCommand(item) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const child = spawn(item.command, item.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const s = String(chunk);
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', (chunk) => {
      const s = String(chunk);
      stderr += s;
      process.stderr.write(s);
    });
    child.on('close', (code, signal) => {
      resolve({
        name: item.name,
        gate: item.gate,
        command: `${item.command} ${item.args.join(' ')}`,
        ok: code === 0,
        exit_code: code,
        signal,
        duration_ms: Math.round(performance.now() - startedAt),
        stdout_tail: stdout.slice(-4000),
        stderr_tail: stderr.slice(-4000),
      });
    });
    child.on('error', (err) => {
      resolve({
        name: item.name,
        gate: item.gate,
        command: `${item.command} ${item.args.join(' ')}`,
        ok: false,
        exit_code: null,
        signal: null,
        duration_ms: Math.round(performance.now() - startedAt),
        stdout_tail: stdout.slice(-4000),
        stderr_tail: `${stderr}\n${err?.stack ?? err?.message ?? String(err)}`.slice(-4000),
      });
    });
  });
}

(async () => {
  const results = [];
  for (const item of COMMANDS) {
    process.stdout.write(`\n[formal-scenario-release-gate] running ${item.name}: ${item.command} ${item.args.join(' ')}\n`);
    const result = await runCommand(item);
    results.push(result);
    if (!result.ok) break;
  }
  const checks = Object.fromEntries(results.map((r) => [r.name, r.ok]));
  const output = {
    ok: results.length === COMMANDS.length && results.every((r) => r.ok),
    scenario: 'FORMAL_SCENARIO_E2E_RELEASE_GATE',
    gate_order: COMMANDS.map((x) => x.name),
    separation: {
      full_base_contract_is_governance_gate: true,
      formal_scenario_e2e_is_business_scenario_gate: true,
      formal_scenario_e2e_not_embedded_in_full_base_contract: true,
    },
    checks,
    results,
  };
  process.stdout.write(`\n${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
