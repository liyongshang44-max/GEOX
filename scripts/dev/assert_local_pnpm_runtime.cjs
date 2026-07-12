#!/usr/bin/env node
'use strict';

// Operational-only CI artifact generator.
// This branch and PR are never merged. The script materializes the already-frozen
// MCFT-CAP-03 S8 Finalization candidate into acceptance-output for retrieval.

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '68f0bc2198c0fd09bb4dcedf5b13d8507fb35902';
const TARGET_BRANCH = 'mcft-cap-03-s8-finalization-v1';
const MATERIALIZER_BRANCH = 'mcft-cap-03-s8-finalization-materializer-v1';
const MATERIALIZER_PATH = '.github/workflows/mcft-cap-03-s8-finalization-materializer-v1.yml';
const OUTPUT_ROOT = path.join(ROOT, 'acceptance-output', 'mcft-cap-03-s8-finalization');
const MAIN_WORKTREE = path.join(os.tmpdir(), 'geox-s8-finalization-main');
const TARGET_WORKTREE = path.join(os.tmpdir(), 'geox-s8-finalization-target');
const EXACT_FILES = [
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION.md',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION.cjs',
];

function run(command, args, cwd = ROOT, options = {}) {
  const result = cp.spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: 'true', ...options.env },
    encoding: 'utf8',
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${command} ${args.join(' ')}:${result.status}`);
  }
  return String(result.stdout || '');
}

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o755 });
}

function extractRunBlocks(source) {
  const names = new Map([
    ['Prove S8 activation on synchronized main', 'prove.sh'],
    ['Generate exact Finalization candidate', 'generate.sh'],
    ['Create Finalization Gate', 'create-gate.sh'],
    ['Run Finalization Draft and Final Gates and record evidence', 'run-gates.sh'],
  ]);
  const lines = source.split(/\r?\n/);
  const output = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*- name: (.+)$/.exec(lines[index]);
    if (!match || !names.has(match[1])) continue;
    let runIndex = index + 1;
    while (runIndex < lines.length && !/^\s*run:\s*\|\s*$/.test(lines[runIndex])) runIndex += 1;
    if (runIndex >= lines.length) throw new Error(`RUN_BLOCK_MISSING:${match[1]}`);
    const indent = lines[runIndex].length - lines[runIndex].trimStart().length;
    const block = [];
    let cursor = runIndex + 1;
    while (cursor < lines.length) {
      const line = lines[cursor];
      const currentIndent = line.trim() ? line.length - line.trimStart().length : indent + 2;
      if (line.trim() && currentIndent <= indent) break;
      block.push(line.slice(Math.min(indent + 2, line.length)));
      cursor += 1;
    }
    output.set(names.get(match[1]), `${block.join('\n').replace(/\s+$/, '')}\n`);
  }
  for (const fileName of names.values()) {
    if (!output.has(fileName)) throw new Error(`RUN_BLOCK_NOT_EXTRACTED:${fileName}`);
  }
  return output;
}

function removeWorktree(worktree) {
  try { run('git', ['worktree', 'remove', '--force', worktree]); } catch {}
  fs.rmSync(worktree, { recursive: true, force: true });
}

function materialize() {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  removeWorktree(MAIN_WORKTREE);
  removeWorktree(TARGET_WORKTREE);
  run('git', [
    'fetch',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    `+refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}`,
    `+refs/heads/${MATERIALIZER_BRANCH}:refs/remotes/origin/${MATERIALIZER_BRANCH}`,
  ]);
  const source = run('git', ['show', `origin/${MATERIALIZER_BRANCH}:${MATERIALIZER_PATH}`]);
  const blocks = extractRunBlocks(source);
  const scriptRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-s8-finalization-scripts-'));
  for (const [name, content] of blocks) writeExecutable(path.join(scriptRoot, name), content);

  try { run('git', ['branch', '-D', 'main']); } catch {}
  try { run('git', ['branch', '-D', TARGET_BRANCH]); } catch {}
  run('git', ['worktree', 'add', '-B', 'main', MAIN_WORKTREE, 'origin/main']);
  if (run('git', ['rev-parse', 'HEAD'], MAIN_WORKTREE).trim() !== BASELINE) {
    throw new Error('S8_FINALIZATION_MAIN_BASELINE_MISMATCH');
  }
  run('bash', [path.join(scriptRoot, 'prove.sh')], MAIN_WORKTREE);

  run('git', ['worktree', 'add', '-B', TARGET_BRANCH, TARGET_WORKTREE, `origin/${TARGET_BRANCH}`]);
  if (run('git', ['rev-parse', 'HEAD'], TARGET_WORKTREE).trim() !== BASELINE) {
    throw new Error('S8_FINALIZATION_TARGET_BASELINE_MISMATCH');
  }
  run('bash', [path.join(scriptRoot, 'generate.sh')], TARGET_WORKTREE);
  run('bash', [path.join(scriptRoot, 'create-gate.sh')], TARGET_WORKTREE);
  run('git', ['add', '-N', '--',
    'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION.cjs',
  ], TARGET_WORKTREE);
  run('bash', [path.join(scriptRoot, 'run-gates.sh')], TARGET_WORKTREE);
  run('git', ['diff', '--check'], TARGET_WORKTREE);

  const changed = run('git', ['status', '--short'], TARGET_WORKTREE)
    .split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).sort();
  const expected = [...EXACT_FILES].sort();
  if (JSON.stringify(changed) !== JSON.stringify(expected)) {
    throw new Error(`S8_FINALIZATION_ARTIFACT_BOUNDARY_MISMATCH:${JSON.stringify(changed)}`);
  }

  for (const relativePath of EXACT_FILES) {
    const sourcePath = path.join(TARGET_WORKTREE, relativePath);
    const destinationPath = path.join(OUTPUT_ROOT, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify({
    ok: true,
    baseline: BASELINE,
    target_branch: TARGET_BRANCH,
    exact_files: EXACT_FILES,
    generated_at: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
}

if (process.env.GITHUB_ACTIONS === 'true') materialize();

console.log(JSON.stringify({
  ok: true,
  message: 'LOCAL_PNPM_RUNTIME_OK',
  process_platform: process.platform,
  process_exec_path: process.execPath,
  pnpm_version: process.env.npm_config_user_agent || 'ci',
}, null, 2));
