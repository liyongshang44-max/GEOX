#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = '7bb23bae7951325257292cd6a494b11931f2168b';
const S2_SUBJECT = '126257e1a08d116089f5f28bd733e6abfd92f290';
const S2_RUN = 31041512709;
const S2_ARTIFACT = 8944755739;
const S2_DIGEST = 'sha256:fd122f4169e72d71211c80d1ced60e32bacbf3a305d46ca419f043a671d7f266';
const REGISTRY_BLOB = 'c9971967ba829d57fd78adc74f63513ded95981f';
const STATUS_BASE_BLOB = '36ed771780e311ab7c6924e72e4e382388461930';

const WORKFLOW = '.github/workflows/mcft-cap-09-s3-persistent-sequential-scheduler.yml';
const MIGRATION = 'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql';
const ADAPTER = 'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json';
const HARD = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-HARD-ACCEPTANCE-EVIDENCE-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-BOUNDARY-V1.json';
const CANDIDATE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-V1.json';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CONFIG-V1.json';
const PREDECESSOR = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.cjs';
const DB_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.ts';
const FILES = [WORKFLOW, MIGRATION, ADAPTER, STATUS, HARD, BOUNDARY, CANDIDATE, CONFIG, PREDECESSOR, VALIDATOR, DB_ACCEPTANCE].sort();
const SEMANTIC_FILES = [MIGRATION, ADAPTER, STATUS, HARD, BOUNDARY, CANDIDATE, CONFIG, PREDECESSOR, VALIDATOR, DB_ACCEPTANCE];
const OUTPUT = 'acceptance-output/MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_RESULT.json';
const FROZEN = [
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts',
  'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts',
];

const git = (...args) => cp.execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const must = (value, code) => { if (!value) throw new Error(code); };
const same = (left, right, code) => {
  try { assert.deepEqual(left, right); } catch { throw new Error(code); }
};
const write = (value) => {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + '\n');
};
function falseAuthorities(value, prefix) {
  for (const key of [
    'implementation_authorized', 'runtime_source_authorized', 'live_ingestion_authorized',
    'background_scheduler_authorized', 'canonical_write_authorized', 'public_http_writer_authorized',
    'model_activation_authorized', 'controlled_action_authorized',
  ]) must(value[key] === false, `${prefix}:${key}`);
}
function artifact(name) {
  const root = path.resolve(process.env.MCFT_CAP09_S2_EFFECTIVE_ARTIFACT_DIR || 'acceptance-input/cap09-s2-effective');
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    if (!directory || !fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === name) return full;
    }
  }
  throw new Error(`ARTIFACT_MISSING:${name}`);
}
async function pullRequest(number) {
  must(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls/${number}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'geox-cap09-s3-persistent-sequential-scheduler',
    },
  });
  const body = await response.text();
  must(response.ok, `GITHUB_API_${response.status}:${body.slice(0, 300)}`);
  return JSON.parse(body);
}
function parseDeclaration(body) {
  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  const match = String(body || '').match(new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g'));
  must(match && match.length === 1, 'EXACT_ONE_PR_CANDIDATE_DECLARATION_REQUIRED');
  const inner = match[0].replace(`<!-- ${marker}\n`, '').replace(/\n-->$/, '');
  const result = {};
  for (const line of inner.split(/\r?\n/)) {
    const index = line.indexOf('=');
    must(index > 0, `INVALID_DECLARATION_LINE:${line}`);
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    must(!(key in result), `DUPLICATE_DECLARATION_KEY:${key}`);
    result[key] = value;
  }
  return result;
}

(async () => {
  try {
    const base = process.env.MCFT_BASE_SHA;
    const head = git('rev-parse', 'HEAD');
    must(base === BASE, 'EXACT_S3_CANDIDATE_BASE_REQUIRED');
    must(git('rev-list', '--count', `${base}..HEAD`) === '1', 'ONE_COMMIT_REQUIRED');
    const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
    same(changed, FILES, 'EXACT_ELEVEN_FILE_S3_CANDIDATE_BOUNDARY_REQUIRED');
    const repositoryDiff = git('diff', '--unified=0', `${base}...HEAD`);
    const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
    must(!repositoryDiff.includes(`<!-- ${marker}`), 'CANDIDATE_DECLARATION_MUST_REMAIN_PR_BODY_ONLY');
    for (const file of FROZEN) must(git('diff', '--quiet', `${base}...HEAD`, '--', file) === '', `FROZEN_FILE_DRIFT:${file}`);
    must(git('rev-parse', `${base}:docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json`) === REGISTRY_BLOB, 'TRUSTED_REGISTRY_BLOB_REQUIRED');
    must(git('rev-parse', `HEAD:docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json`) === REGISTRY_BLOB, 'REGISTRY_DRIFT_FORBIDDEN');
    must(git('rev-parse', `${base}:${STATUS}`) === STATUS_BASE_BLOB, 'S3_BASE_STATUS_BLOB_REQUIRED');

    const attestation = JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json'), 'utf8'));
    const locator = JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S2_ATTESTATION_RETENTION_LOCATOR.json'), 'utf8'));
    must(attestation.status === 'PASS' && attestation.subject_sha === S2_SUBJECT, 'S2_ATTESTATION_IDENTITY');
    must(attestation.semantic_artifact_digest === S2_DIGEST, 'S2_SEMANTIC_DIGEST');
    must(attestation.effective_authority?.s2_database_evidence_ingress_effective === true, 'S2_NOT_EFFECTIVE');
    must(attestation.effective_authority?.effective_next_slice === 'S3', 'S2_NEXT_SLICE');
    must(attestation.effective_authority?.s3_registry_registration_authorized === true, 'S3_REGISTRATION_NOT_AUTHORIZED');
    must(attestation.effective_authority?.s3_authorized_scope === 'PERSISTENT_SEQUENTIAL_SCHEDULER_ONLY', 'S3_SCOPE');
    falseAuthorities(attestation.effective_authority, 'S2_EFFECTIVE_AUTHORITY');
    must(locator.retention_level === 'R2' && locator.readback_verified === true && locator.locked_version_delete_denied === true, 'S2_R2_LOCATOR');

    const baseStatus = JSON.parse(git('show', `${base}:${STATUS}`));
    const status = readJson(STATUS);
    must(baseStatus.s3_candidate_implemented === false && baseStatus.candidate_declaration_present === false, 'BASE_S3_NON_CANDIDATE_REQUIRED');
    must(status.record_status === 'S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE', 'S3_STATUS_RECORD_STATE');
    must(status.s3_candidate_implemented === true && status.candidate_declaration_present === true, 'S3_STATUS_CANDIDATE_SIGNAL_REQUIRED');
    must(status.persistent_sequential_scheduler_implemented === true && status.scheduler_clock_implemented === true, 'S3_STATUS_IMPLEMENTATION_REQUIRED');
    must(status.production_wiring_present === false && status.externally_effective === false, 'S3_STATUS_NON_EFFECTIVE');
    must(status.s2_effective_subject_sha === S2_SUBJECT && status.s2_exact_sha_r2_run_id === S2_RUN && status.s2_exact_sha_artifact_id === S2_ARTIFACT, 'S3_STATUS_PREDECESSOR_BINDING');
    falseAuthorities(status, 'S3_STATUS_AUTHORITY');

    const boundary = readJson(BOUNDARY);
    must(boundary.exact_base_main_sha === BASE && boundary.changed_file_count === 11, 'S3_BOUNDARY_BASE_COUNT');
    same(boundary.changed_files.sort(), FILES, 'S3_BOUNDARY_FILES');
    must(boundary.candidate_transition === true && boundary.candidate_declaration === true, 'S3_BOUNDARY_CANDIDATE_TRANSITION');
    must(boundary.migration_delta === 1 && boundary.operational_table_delta === 2 && boundary.runtime_source_delta === 1, 'S3_BOUNDARY_IMPLEMENTATION_DELTAS');
    must(boundary.registry_delta === 0 && boundary.taskbook_delta === 0 && boundary.scope_contract_delta === 0, 'S3_BOUNDARY_GOVERNANCE_DRIFT');
    must(boundary.server_startup_wiring_delta === 0 && boundary.background_daemon_delta === 0 && boundary.cron_delta === 0, 'S3_BOUNDARY_PRODUCTION_WIRING');

    const candidate = readJson(CANDIDATE);
    must(candidate.record_status === 'S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE', 'S3_CANDIDATE_RECORD_STATUS');
    must(candidate.base_main_sha === BASE && candidate.scheduler_contract === 'SCHEDULER_PORT_V1' && candidate.clock_contract === 'CLOCK_PORT_V1', 'S3_CANDIDATE_CONTRACT_BINDING');
    must(candidate.persistent_sequential_scheduler_implemented === true && candidate.durable_cursor_implemented === true, 'S3_CANDIDATE_IMPLEMENTATION');
    must(candidate.at_most_one_active_slot_per_scope === true && candidate.at_most_one_running_slot_per_scope === true, 'S3_CANDIDATE_SINGLE_WRITER');
    must(candidate.oldest_due_slot_first === true && candidate.idempotent_active_claim === true, 'S3_CANDIDATE_ORDER_IDEMPOTENCY');
    must(candidate.terminal_success_implicit_retry_allowed === false && candidate.future_boundary_claim_allowed === false, 'S3_CANDIDATE_FAIL_CLOSED');
    must(candidate.production_wiring_present === false && candidate.external_effectiveness === false, 'S3_CANDIDATE_NON_EFFECTIVE');
    must(candidate.trusted_registry_blob_sha === REGISTRY_BLOB, 'S3_CANDIDATE_REGISTRY_BINDING');
    falseAuthorities(candidate, 'S3_CANDIDATE_AUTHORITY');

    const config = readJson(CONFIG);
    must(config.scheduler_contract === 'SCHEDULER_PORT_V1' && config.clock_contract === 'CLOCK_PORT_V1', 'S3_CONFIG_CONTRACT');
    must(config.slot_count === 24 && config.slot_interval_seconds === 3600 && config.slot_ids[0] === 'O00' && config.slot_ids[23] === 'O23', 'S3_CONFIG_SLOT_RANGE');
    must(config.maximum_active_slots_per_scope === 1 && config.maximum_running_slots_per_scope === 1, 'S3_CONFIG_SINGLE_SCOPE_SERIALIZATION');
    must(config.missed_slot_order === 'OLDEST_ELIGIBLE_FIRST' && config.terminal_success_implicit_retry_allowed === false, 'S3_CONFIG_ORDER_RETRY');
    must(config.canonical_fact_write_allowed === false && config.background_daemon_allowed === false && config.server_startup_wiring_allowed === false, 'S3_CONFIG_NONCLAIMS');

    const predecessor = readJson(PREDECESSOR);
    must(predecessor.s2_effective_subject_sha === S2_SUBJECT && predecessor.s2_exact_sha_r2_run_id === S2_RUN && predecessor.s2_exact_sha_artifact_id === S2_ARTIFACT, 'S3_PREDECESSOR_IDENTITY');
    must(predecessor.s3_registry_registration_merge_sha === 'a50bb3f0035ccf2c60415f4f5345b9ced03f3110' && predecessor.s3_candidate_routing_merge_sha === BASE, 'S3_PREDECESSOR_ROUTING');
    must(predecessor.authorized_scope === 'PERSISTENT_SEQUENTIAL_SCHEDULER_ONLY', 'S3_PREDECESSOR_SCOPE');

    const hard = readJson(HARD);
    must(hard.required_check_count === 20 && hard.checks.length === 20 && hard.checks.every((item) => item.required === true), 'S3_HARD_ACCEPTANCE_COUNT');
    must(hard.expected_postgresql_result.operational_table_count === 2 && hard.expected_postgresql_result.canonical_fact_delta === 0, 'S3_HARD_ACCEPTANCE_DATABASE_BOUNDARY');

    const migration = fs.readFileSync(MIGRATION, 'utf8');
    for (const token of [
      'twin_shadow_online_scheduler_cursor_v1', 'twin_shadow_online_scheduler_slot_v1',
      "WHERE state = 'RUNNING'", "WHERE state IN ('CLAIMED','RUNNING')", 'UNIQUE',
    ]) must(migration.includes(token), `S3_MIGRATION_TOKEN_REQUIRED:${token}`);
    must(!/INSERT\s+INTO\s+(public\.)?facts/i.test(migration), 'S3_MIGRATION_CANONICAL_FACT_INSERT_FORBIDDEN');

    const adapter = fs.readFileSync(ADAPTER, 'utf8');
    for (const token of [
      'implements ClockPortV1', 'implements SchedulerPortV1', 'listMissedSlots', 'claimDueSlot', 'recordTerminalResult',
      'OLDER_MISSED_SLOT_REQUIRED', 'TERMINAL_SLOT_ALREADY_RECORDED', 'STALE_FENCING_TOKEN',
      'FOR UPDATE', 'twin_runtime_lease_v1', 'twin_shadow_online_scheduler_cursor_v1',
    ]) must(adapter.includes(token), `S3_ADAPTER_TOKEN_REQUIRED:${token}`);
    for (const forbidden of ['setInterval(', 'setTimeout(', 'Fastify', 'INSERT INTO facts', 'ao_act', 'dispatch']) {
      must(!adapter.includes(forbidden), `S3_ADAPTER_FORBIDDEN_TOKEN:${forbidden}`);
    }

    const workflow = fs.readFileSync(WORKFLOW, 'utf8');
    for (const token of [
      'mcft-cap-09-s3-persistent-sequential-scheduler', 'postgres:16',
      'MCFT_CAP_09_S3_DESTRUCTIVE_ACCEPTANCE', 'MCFT_CAP_09_S3_POSTGRESQL_ACCEPTANCE_RESULT.json',
      '31041512709', '8944755739',
    ]) must(workflow.includes(token), `S3_WORKFLOW_TOKEN_REQUIRED:${token}`);

    let declarationVerified = false;
    if (process.env.MCFT_EVENT_NAME === 'pull_request') {
      const pr = await pullRequest(Number(process.env.MCFT_PR_NUMBER));
      must(pr.head.sha === head && pr.base.sha === base, 'PR_EXACT_SHA_BINDING');
      const declaration = parseDeclaration(pr.body);
      must(declaration.capability_line === 'MCFT-CAP-09' && declaration.slice_id === 'MCFT-CAP-09.S3', 'DECLARATION_CAPABILITY_SLICE');
      must(declaration.status_file === STATUS && declaration.candidate_field === 's3_candidate_implemented' && declaration.candidate_value === 'true', 'DECLARATION_STATUS_SIGNAL');
      must(declaration.focused_workflow === 'mcft-cap-09-s3-persistent-sequential-scheduler' && declaration.standard_workflow === 'ci', 'DECLARATION_WORKFLOWS');
      must(declaration.candidate_head === head && declaration.base_head === base, 'DECLARATION_SHA_BINDING');
      same(declaration.semantic_snapshot_files.split(','), SEMANTIC_FILES, 'DECLARATION_SEMANTIC_FILES');
      same(declaration.semantic_snapshot_blobs.split(','), SEMANTIC_FILES.map((file) => git('rev-parse', `HEAD:${file}`)), 'DECLARATION_SEMANTIC_BLOBS');
      declarationVerified = true;
    } else {
      must(process.env.MCFT_EVENT_NAME === 'merge_group', 'SUPPORTED_EVENT_REQUIRED');
    }

    const result = {
      schema_version: 'geox_mcft_cap09_s3_persistent_sequential_scheduler_result_v1',
      status: 'PASS',
      base_sha: base,
      head_sha: head,
      changed_files: FILES,
      exact_new_candidate_signal_count: 1,
      candidate_declaration_present: true,
      candidate_declaration_verified: declarationVerified,
      s2_effective_subject_sha: S2_SUBJECT,
      s2_exact_sha_r2_run_id: S2_RUN,
      s2_exact_sha_artifact_id: S2_ARTIFACT,
      persistent_sequential_scheduler_implemented: true,
      scheduler_clock_implemented: true,
      durable_cursor_implemented: true,
      lease_fencing_implemented: true,
      oldest_due_slot_first: true,
      terminal_success_implicit_retry_allowed: false,
      real_postgresql_acceptance_required: true,
      operational_table_delta: 2,
      migration_delta: 1,
      runtime_source_delta: 1,
      canonical_write_performed: false,
      background_scheduler_started: false,
      production_wiring_present: false,
      externally_effective: false,
      first_legal_next_action: 'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION_OF_S3_SUBJECT',
    };
    write(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = { status: 'FAIL', error: String(error instanceof Error ? error.message : error) };
    write(failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
