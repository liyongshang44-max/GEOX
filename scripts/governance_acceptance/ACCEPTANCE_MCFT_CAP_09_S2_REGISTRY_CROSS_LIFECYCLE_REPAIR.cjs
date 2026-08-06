#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TARGET = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs';
const S4_SUBJECT = '6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f';
const FROZEN_BLOB = '7b8c9d2917ed5cc384f5738f6c34d322bc18c9f2';
const ROUTING_REPAIR_FILES = [
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs',
];
const EXACT_SHA_CONTROL_FILES = [
  '.github/workflows/mcft-cap-09-s4-exact-sha-attestation.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_EXACT_SHA_ATTESTATION_V1.cjs',
];
const FROZEN_S4_FILES = [
  '.github/workflows/mcft-cap-09-s4-restart-backfill-stale-detection.yml',
  'apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts',
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-HARD-ACCEPTANCE-EVIDENCE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CONFIG-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts',
];
const AUTHORITY_FALSE_FIELDS = [
  'implementation_authorized',
  'runtime_source_authorized',
  'live_ingestion_authorized',
  'background_scheduler_authorized',
  'canonical_write_authorized',
  'public_http_writer_authorized',
  'model_activation_authorized',
  'controlled_action_authorized',
];

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function blobSha(value) {
  const bytes = Buffer.from(value, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest('hex');
}
function must(value, code) {
  if (!value) throw new Error(code);
}
function sameFiles(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function changedFiles(base) {
  return git('diff', '--name-only', `${base}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
}
function write(name, value) {
  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'acceptance-output', name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
function assertOneCommit(base) {
  must(git('rev-list', '--count', `${base}..HEAD`) === '1', 'ONE_COMMIT_REQUIRED');
}
function assertSubjectAncestor(ref) {
  const result = cp.spawnSync('git', ['merge-base', '--is-ancestor', S4_SUBJECT, ref], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  must(result.status === 0, `S4_SUBJECT_NOT_ANCESTOR_OF:${ref}`);
}
function assertFrozenS4() {
  for (const file of FROZEN_S4_FILES) {
    const subjectBlob = git('rev-parse', `${S4_SUBJECT}:${file}`);
    const headBlob = git('rev-parse', `HEAD:${file}`);
    must(subjectBlob === headBlob, `FROZEN_S4_BLOB_DRIFT:${file}`);
  }
}
function assertNoCandidateDeclaration(files) {
  const marker = ['<!--', 'MCFT_CANDIDATE_DECLARATION_V2'].join(' ');
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    must(!source.includes(marker), `CANDIDATE_DECLARATION_FORBIDDEN:${file}`);
  }
}
function assertS4Status() {
  const status = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json'),
    'utf8',
  ));
  must(status.status === 'S4_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE', 'S4_STATUS_ENUM_REQUIRED');
  must(status.s4_candidate_implemented === true, 'S4_CANDIDATE_FLAG_REQUIRED');
  must(status.externally_effective === false, 'S4_MUST_REMAIN_NOT_EFFECTIVE');
  must(status.authorized_s4_scope === 'RESTART_BACKFILL_STALE_DETECTION_ONLY', 'S4_SCOPE_REQUIRED');
  for (const field of AUTHORITY_FALSE_FIELDS) {
    must(status[field] === false, `S4_AUTHORITY_MUST_REMAIN_FALSE:${field}`);
  }
}
function delegate() {
  const frozen = cp.execFileSync('git', ['show', `${S4_SUBJECT}:${TARGET}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  must(blobSha(frozen) === FROZEN_BLOB, 'FROZEN_S4_CROSS_VALIDATOR_BLOB_MISMATCH');
  const temp = path.join(__dirname, `.mcft-cap09-s4-exact-cross-${process.pid}.cjs`);
  try {
    fs.writeFileSync(temp, frozen);
    const result = cp.spawnSync(process.execPath, [temp, ...process.argv.slice(2)], {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    try { fs.unlinkSync(temp); } catch {}
  }
}

const base = process.env.MCFT_BASE_SHA;
if (!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const files = changedFiles(base);

try {
  if (process.argv.includes('--s4-exact-sha-lifecycle-repair')) {
    must(base === S4_SUBJECT, 'EXACT_S4_EXACT_SHA_ROUTING_BASE_REQUIRED');
    assertOneCommit(base);
    must(sameFiles(files, ROUTING_REPAIR_FILES), 'EXACT_S4_EXACT_SHA_ROUTING_BOUNDARY_REQUIRED');
    assertFrozenS4();
    assertNoCandidateDeclaration(files);
    assertS4Status();

    const classifier = fs.readFileSync(path.join(ROOT, 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'), 'utf8');
    const router = fs.readFileSync(path.join(ROOT, 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'), 'utf8');
    const s2Workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/mcft-cap-09-s2-registry-registration.yml'), 'utf8');
    for (const token of ['s4-exact-sha-lifecycle-repair', 's4-exact-sha-attestation', 'EXACT_SHA_CONTROL_FILES']) {
      must(classifier.includes(token), `CLASSIFIER_TOKEN_REQUIRED:${token}`);
    }
    for (const token of ['s4-exact-sha-lifecycle-repair', 's4-exact-sha-attestation', '--s4-exact-sha-route-only']) {
      must(router.includes(token), `ROUTER_TOKEN_REQUIRED:${token}`);
      must(s2Workflow.includes(token), `S2_WORKFLOW_TOKEN_REQUIRED:${token}`);
    }

    const result = {
      status: 'PASS',
      lifecycle: 'S4_EXACT_SHA_LIFECYCLE_ROUTING_REPAIR',
      base_sha: base,
      head_sha: git('rev-parse', 'HEAD'),
      changed_files: files,
      s4_subject_sha: S4_SUBJECT,
      candidate_transition: false,
      registry_transition: false,
      status_object_delta: 0,
      runtime_source_delta: 0,
      migration_delta: 0,
      canonical_write_authorized: false,
      background_scheduler_authorized: false,
      external_effectiveness: false,
      next_legal_action: 'MCFT_CAP_09_S4_EXACT_SHA_R2_CONTROL_PLANE',
    };
    write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json', result);
    write('MCFT_CAP_09_S4_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json', result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (process.argv.includes('--s4-exact-sha-route-only')) {
    assertSubjectAncestor(base);
    assertOneCommit(base);
    must(sameFiles(files, EXACT_SHA_CONTROL_FILES), 'EXACT_S4_EXACT_SHA_CONTROL_BOUNDARY_REQUIRED');
    assertFrozenS4();
    assertNoCandidateDeclaration(files);
    assertS4Status();

    const classifier = fs.readFileSync(path.join(ROOT, 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'), 'utf8');
    const router = fs.readFileSync(path.join(ROOT, 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'), 'utf8');
    must(classifier.includes('s4-exact-sha-attestation'), 'S4_EXACT_SHA_CLASSIFIER_ROUTE_REQUIRED');
    must(router.includes('--s4-exact-sha-route-only'), 'S4_EXACT_SHA_ROUTER_ROUTE_REQUIRED');

    const result = {
      status: 'PASS',
      lifecycle: 'S4_EXACT_SHA_CONTROL_PLANE_ROUTED',
      base_sha: base,
      head_sha: git('rev-parse', 'HEAD'),
      changed_files: files,
      s4_subject_sha: S4_SUBJECT,
      candidate_transition: false,
      registry_transition: false,
      status_object_delta: 0,
      runtime_source_delta: 0,
      migration_delta: 0,
      exact_sha_attestation_executed_at_pr: false,
      canonical_write_authorized: false,
      background_scheduler_authorized: false,
      external_effectiveness: false,
      first_legal_next_action: 'PROTECTED_MERGE_THEN_MAIN_PUSH_EXACT_SHA_R2_ATTESTATION',
    };
    write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json', result);
    write('MCFT_CAP_09_S4_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json', result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  delegate();
} catch (error) {
  const failure = { status: 'FAIL', error: String(error?.message ?? error) };
  write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json', failure);
  if (process.argv.some((value) => value.startsWith('--s4-exact-sha-'))) {
    write('MCFT_CAP_09_S4_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json', failure);
  }
  console.error(error);
  process.exitCode = 1;
}
