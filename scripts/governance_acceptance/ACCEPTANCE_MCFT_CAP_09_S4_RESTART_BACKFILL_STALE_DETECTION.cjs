#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);

const BASE = '48b9a1f86e0351cbaadf941956158095e512a3da';
const S3_SUBJECT = '15cdb24667d43cf7c21294d22b68160c6668cf73';
const S3_RUN = 31080310315;
const S3_ARTIFACT = 8959189326;
const FILES = [
  '.github/workflows/mcft-cap-09-s4-restart-backfill-stale-detection.yml',
  'apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-HARD-ACCEPTANCE-EVIDENCE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CONFIG-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts',
].sort();

const run = (args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const must = (value, code) => { if (!value) throw new Error(code); };
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const changed = (base, head) => run(['diff', '--name-only', `${base}...${head}`]).split(/\r?\n/).filter(Boolean).sort();
const blob = (sha, file) => run(['rev-parse', `${sha}:${file}`]);

function authorityFalse(value, prefix) {
  for (const key of [
    'implementation_authorized',
    'runtime_source_authorized',
    'live_ingestion_authorized',
    'background_scheduler_authorized',
    'canonical_write_authorized',
    'public_http_writer_authorized',
    'model_activation_authorized',
    'controlled_action_authorized',
  ]) must(value[key] === false, `${prefix}:${key}`);
}

function jsonFiles(root) {
  const result = [];
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...jsonFiles(file));
    else if (entry.name.endsWith('.json')) result.push(file);
  }
  return result;
}

function findJson(root, predicate, code) {
  for (const file of jsonFiles(root)) {
    try {
      const value = load(file);
      if (predicate(value)) return value;
    } catch {}
  }
  throw new Error(code);
}

function forbiddenRuntime(text) {
  for (const token of [
    'setInterval(',
    'setTimeout(',
    'node-cron',
    'cron.schedule',
    'fastify',
    'INSERT INTO facts',
    'UPDATE facts',
    'DELETE FROM facts',
    'controlled_action',
    'model_activation',
  ]) must(!text.includes(token), `FORBIDDEN_RUNTIME_TOKEN:${token}`);
}

try {
  const base = process.env.MCFT_BASE_SHA;
  must(base === BASE, 'EXACT_S4_CANDIDATE_BASE_REQUIRED');
  const head = run(['rev-parse', 'HEAD']);
  must(run(['rev-list', '--count', `${base}..${head}`]) === '1', 'ONE_COMMIT_REQUIRED');
  must(same(changed(base, head), FILES), 'EXACT_ELEVEN_FILE_S4_CANDIDATE_BOUNDARY_REQUIRED');

  for (const file of [
    'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
    'apps/server/src/runtime/twin_runtime/ports.ts',
    'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
    'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql',
  ]) must(blob(base, file) === blob(head, file), `FROZEN_PREDECESSOR_BLOB_DRIFT:${file}`);

  const status = load('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json');
  must(
    status.status === 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE'
      && status.s4_candidate_implemented === true
      && status.externally_effective === false,
    'S4_CANDIDATE_STATUS_REQUIRED',
  );
  must(status.authorized_s4_scope === 'RESTART_BACKFILL_STALE_DETECTION_ONLY', 'S4_SCOPE_REQUIRED');
  authorityFalse(status, 'S4_STATUS_AUTHORITY');

  const boundary = load('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json');
  must(same(boundary.files, FILES) && boundary.file_count === 11, 'S4_BOUNDARY_DOCUMENT_MISMATCH');
  must(boundary.base_main_sha === BASE, 'S4_BOUNDARY_BASE_MISMATCH');

  const candidate = load('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json');
  must(candidate.base_main_sha === BASE && candidate.candidate_boundary_file_count === 11, 'S4_CANDIDATE_AUTHORITY_BASE_OR_BOUNDARY');
  must(
    candidate.runtime_source_delta === 2
      && candidate.migration_delta === 0
      && candidate.external_effectiveness === false,
    'S4_CANDIDATE_DELTA_OR_EFFECTIVENESS',
  );
  must(candidate.persisted_checkpoint_read_proof === 'REAL_POSTGRESQL_CANONICAL_GRAPH_READBACK', 'S4_REAL_CHECKPOINT_PROOF_DECLARATION_REQUIRED');
  authorityFalse(candidate, 'S4_CANDIDATE_AUTHORITY');

  const expected = {
    focused_workflow_blob_sha: FILES[0],
    recovery_adapter_blob_sha: FILES[1],
    service_blob_sha: FILES[2],
    governance_acceptance_blob_sha: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs',
    runtime_acceptance_blob_sha: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts',
  };
  for (const [key, file] of Object.entries(expected)) {
    must(candidate[key] === blob(head, file), `CANDIDATE_BLOB_BINDING:${key}`);
  }

  const recovery = fs.readFileSync(FILES[1], 'utf8');
  const service = fs.readFileSync(FILES[2], 'utf8');
  const workflow = fs.readFileSync(FILES[0], 'utf8');
  const runtimeAcceptance = fs.readFileSync(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts',
    'utf8',
  );
  forbiddenRuntime(recovery);
  forbiddenRuntime(service);

  for (const token of [
    'twin_shadow_online_scheduler_cursor_v1',
    'twin_shadow_online_scheduler_slot_v1',
    'twin_runtime_lease_v1',
    'fencing_token+1',
    'RECOVERY_SLOT_COMPARE_AND_SET_FAILED',
  ]) must(recovery.includes(token), `RECOVERY_TOKEN:${token}`);

  for (const token of [
    'readPersistedNextTickSnapshot',
    'recoverExpiredActiveSlot',
    'listMissedSlots',
    'freezeEligibleEvidence',
    'RUNTIME_HEALTH_ONLY_NOT_CROP_HEALTH',
  ]) must(service.includes(token), `SERVICE_TOKEN:${token}`);

  for (const token of [
    'PostgresNextTickRepositoryV1',
    'readPersistedNextTickSnapshot',
    'REAL_POSTGRESQL_PERSISTED_NEXT_TICK_SNAPSHOT_REQUIRED',
    'persisted_checkpoint_read_verified',
    'persisted_checkpoint_ref',
  ]) must(runtimeAcceptance.includes(token), `REAL_CHECKPOINT_ACCEPTANCE_TOKEN:${token}`);
  must(workflow.includes("'persisted_checkpoint_read_verified'"), 'WORKFLOW_MUST_REQUIRE_PERSISTED_CHECKPOINT_PROOF');
  must(workflow.includes("runtime.persisted_checkpoint_repository!=='PostgresNextTickRepositoryV1'"), 'WORKFLOW_MUST_BIND_REAL_CHECKPOINT_REPOSITORY');

  const artifactRoot = process.env.MCFT_CAP09_S3_EFFECTIVE_ARTIFACT_DIR;
  must(artifactRoot && fs.existsSync(artifactRoot), 'S3_EFFECTIVE_ARTIFACT_DIR_REQUIRED');
  const attestation = findJson(
    artifactRoot,
    (value) => value?.status === 'PASS'
      && value?.subject_sha === S3_SUBJECT
      && value?.effective_authority?.s3_persistent_sequential_scheduler_effective === true,
    'S3_EFFECTIVE_ATTESTATION_REQUIRED',
  );
  const locator = findJson(
    artifactRoot,
    (value) => value?.retention_level === 'R2'
      && value?.readback_verified === true
      && value?.locked_version_delete_denied === true,
    'S3_R2_LOCATOR_REQUIRED',
  );
  must(attestation.effective_authority.s4_registry_registration_authorized === true, 'S3_S4_REGISTRATION_AUTHORITY_REQUIRED');
  must(Date.parse(locator.retain_until) > Date.now() + 700 * 86400000, 'S3_R2_RETENTION_REQUIRED');

  const result = {
    status: 'PASS',
    change_class: 'MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION_CANDIDATE',
    base_sha: base,
    head_sha: head,
    changed_files: FILES,
    s3_effective_subject_sha: S3_SUBJECT,
    s3_exact_sha_r2_run_id: S3_RUN,
    s3_exact_sha_artifact_id: S3_ARTIFACT,
    persisted_checkpoint_required: true,
    real_postgresql_persisted_checkpoint_read_required: true,
    expired_slot_recovery_new_fence: true,
    oldest_missed_slot_first: true,
    stale_evidence_runtime_health_only: true,
    runtime_source_delta: 2,
    migration_delta: 0,
    registry_delta: 0,
    canonical_write_authorized: false,
    background_scheduler_authorized: false,
    external_effectiveness: false,
    first_legal_next_action: 'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION_OF_S4_SUBJECT',
  };
  fs.mkdirSync('acceptance-output', { recursive: true });
  fs.writeFileSync(
    'acceptance-output/MCFT_CAP_09_S4_GOVERNANCE_ACCEPTANCE_RESULT.json',
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  fs.mkdirSync('acceptance-output', { recursive: true });
  const failure = { status: 'FAIL', error: String(error?.message ?? error) };
  fs.writeFileSync(
    'acceptance-output/MCFT_CAP_09_S4_GOVERNANCE_ACCEPTANCE_RESULT.json',
    `${JSON.stringify(failure, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
}
