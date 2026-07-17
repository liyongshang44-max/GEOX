// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_ENTRY_PREFLIGHT.cjs
// Purpose: run the complete S5 entry preflight on one clean head and emit structured machine-readable evidence.
// Boundary: disposable/local validation only; no production database, no S5 Candidate append, no Evaluation append, no Model Activation, no active-config switch, no State/checkpoint mutation.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_ENTRY_PREFLIGHT_INPUT.json');
const GOVERNANCE_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_ENTRY_GOVERNANCE_RESULT.json');
const S4_GOVERNANCE_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S4_GOVERNANCE_RESULT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_ENTRY_PREFLIGHT_RESULT.json');
const S2_RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');

function executable(name) {
  return process.platform === 'win32' && name === 'pnpm' ? 'pnpm.cmd' : name;
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runCommand(stageId, command, args, logName) {
  const startedAt = new Date().toISOString();
  const result = cp.spawnSync(executable(command), args, {
    cwd: ROOT,
    env: { ...process.env },
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.error) throw result.error;
  const output = `${String(result.stdout || '')}${String(result.stderr || '')}`;
  const logPath = path.join(OUTPUT_DIR, logName);
  fs.writeFileSync(logPath, output, 'utf8');
  return {
    stage_id: stageId,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status === null ? 1 : result.status,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    command: [command, ...args],
    log_ref: `acceptance-output/${logName}`,
    log_sha256: crypto.createHash('sha256').update(output).digest('hex')
  };
}

function requirePass(stage) {
  if (stage.status !== 'PASS' || stage.exit_code !== 0) {
    throw new Error(`S5_ENTRY_PREFLIGHT_STAGE_FAILED:${stage.stage_id}:${stage.exit_code}`);
  }
}

function requireStructured(file, schema) {
  if (!fs.existsSync(file)) throw new Error(`S5_ENTRY_STRUCTURED_RESULT_REQUIRED:${path.basename(file)}`);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (result.schema_version !== schema || result.status !== 'PASS' || result.canonical_write_count !== 0) {
    throw new Error(`S5_ENTRY_STRUCTURED_RESULT_INVALID:${path.basename(file)}`);
  }
  return result;
}

function finalResult(status, stages, error) {
  return {
    schema_version: 'geox_mcft_cap_06_s5_entry_preflight_result_v1',
    status,
    exact_head: git(['rev-parse', 'HEAD']),
    stages,
    canonical_write_count: 0,
    production_candidate_append_count: 0,
    production_evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    production_database_used: false,
    s5_authorized: false,
    ...(error ? { error } : {})
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const file of [INPUT_PATH, GOVERNANCE_PATH, S4_GOVERNANCE_PATH, RESULT_PATH, S2_RESULT_PATH]) {
    fs.rmSync(file, { force: true });
  }

  const dirtyBefore = git(['status', '--porcelain']);
  if (dirtyBefore) throw new Error('S5_ENTRY_PREFLIGHT_CLEAN_HEAD_REQUIRED');

  const stages = [];
  try {
    const typecheck = runCommand('TYPECHECK', 'pnpm', ['-r', 'typecheck'], 'MCFT_CAP_06_S5_ENTRY_TYPECHECK.log');
    stages.push(typecheck);
    requirePass(typecheck);

    const build = runCommand('BUILD', 'pnpm', ['-r', 'build'], 'MCFT_CAP_06_S5_ENTRY_BUILD.log');
    stages.push(build);
    requirePass(build);

    const domain = runCommand(
      'DOMAIN_ACCEPTANCE',
      'pnpm',
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts'],
      'MCFT_CAP_06_S5_ENTRY_DOMAIN.log'
    );
    stages.push(domain);
    requirePass(domain);

    const s4 = runCommand(
      'S4_SHARED_POSTGRESQL_AND_FORMAL_COMPOSITION',
      'node',
      ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs'],
      'MCFT_CAP_06_S5_ENTRY_S4_STABILIZATION.log'
    );
    requirePass(s4);
    stages.push({ ...s4, stage_id: 'POSTGRESQL_EXACT_REF_ACCEPTANCE', shared_execution_stage_id: 'S4_SHARED_POSTGRESQL_AND_FORMAL_COMPOSITION' });
    stages.push({ ...s4, stage_id: 'FORMAL_COMPOSITION', shared_execution_stage_id: 'S4_SHARED_POSTGRESQL_AND_FORMAL_COMPOSITION' });

    const s2 = requireStructured(S2_RESULT_PATH, 'geox_mcft_cap_06_s2_acceptance_result_v1');
    stages.push({
      stage_id: 'S2_COMPATIBILITY',
      status: 'PASS',
      exit_code: 0,
      structured_evidence_ref: 'acceptance-output/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json',
      canonical_write_count: s2.canonical_write_count
    });

    const s3 = runCommand(
      'S3_REGRESSION',
      'node',
      ['scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs'],
      'MCFT_CAP_06_S5_ENTRY_S3_REGRESSION.log'
    );
    stages.push(s3);
    requirePass(s3);

    const s4Governance = runCommand(
      'S4_STRUCTURED_GOVERNANCE_REGRESSION',
      'node',
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs'],
      'MCFT_CAP_06_S5_ENTRY_S4_GOVERNANCE.log'
    );
    stages.push(s4Governance);
    requirePass(s4Governance);
    requireStructured(S4_GOVERNANCE_PATH, 'geox_mcft_cap_06_s4_governance_result_v1');

    writeJson(INPUT_PATH, {
      schema_version: 'geox_mcft_cap_06_s5_entry_preflight_input_v1',
      status: 'READY_FOR_GOVERNANCE',
      exact_head: git(['rev-parse', 'HEAD']),
      stages,
      canonical_write_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
      production_database_used: false,
      s5_authorized: false
    });

    const governance = runCommand(
      'STRUCTURED_GOVERNANCE_GATE',
      'node',
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY.cjs'],
      'MCFT_CAP_06_S5_ENTRY_GOVERNANCE.log'
    );
    requirePass(governance);
    requireStructured(GOVERNANCE_PATH, 'geox_mcft_cap_06_s5_entry_governance_result_v1');
    stages.push({ ...governance, structured_evidence_ref: 'acceptance-output/MCFT_CAP_06_S5_ENTRY_GOVERNANCE_RESULT.json' });

    const result = finalResult('PASS', stages);
    writeJson(RESULT_PATH, result);
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = finalResult('FAIL', stages, message);
    writeJson(RESULT_PATH, result);
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
}

main();
