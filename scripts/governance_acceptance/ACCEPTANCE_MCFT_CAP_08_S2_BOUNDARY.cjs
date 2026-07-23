#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S2_BOUNDARY_RESULT.json');
const FORMAL_BASE = 'e68e7d1f12025726aad2c1d9edccf82a82058ee9';
const FAILED_EXACT_MERGE = '15d26d86ff955bab982871adf6e1bd8c75b07972';
const PREP = 'da8d5456748ea817fae662937404766473af6459';
const G3 = '65b0d8fc3f73c0b343146e5b616cb439ad972149';
const S1 = 'f39b7df37571156f23cfb9153bad024fdb723261';

const MANIFEST = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-CHANGED-FILE-BOUNDARY-V1.json';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const IMPLEMENTATION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-IMPLEMENTATION-V1.json';
const WORKFLOW_DECLARATION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-WORKFLOW-DECLARATION-V1.json';
const PREDECESSOR = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-PREDECESSOR-CONSUMPTION-V1.json';
const OWNER_WAIVER = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-OWNER-REVIEW-WAIVER-V1.json';
const ENTRY_GATES = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-PRE-CANDIDATE-ENTRY-GATES-V1.json';
const EXACT_SCRIPT = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_EXACT_SHA_ATTESTATION.cjs';
const BOUNDARY_SCRIPT = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_BOUNDARY.cjs';

const PROVIDER = [
  'apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s2_formal_provider_qualification_service_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_formal_provider_fixture_v1.ts',
];
const G3_CORE = [
  'apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_negative_cases_v1.ts',
];
const REMEDIATION_FILES = [BOUNDARY_SCRIPT, EXACT_SCRIPT].sort();
const FORMAL_FILES_FROZEN_ON_REMEDIATION = [
  '.github/workflows/mcft-cap-08-s2-exact-sha-attestation.yml',
  '.github/workflows/mcft-cap-08-s2-forcing-state-forecast.yml',
  MANIFEST,
  STATUS,
  IMPLEMENTATION,
  PREDECESSOR,
  WORKFLOW_DECLARATION,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_PRE_CANDIDATE_FOUNDATION.cjs',
  'scripts/governance_acceptance/mcft_cap08_s2_artifact_finalize.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_FORCING_STATE_FORECAST_DB.ts',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function changedFiles(base, head = 'HEAD') {
  const raw = git(['diff', '--name-only', `${base}...${head}`]);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function freezeAgainst(subject, files) {
  const mismatches = [];
  for (const file of files) {
    const historicalBlob = git(['rev-parse', `${subject}:${file}`]);
    const currentBlob = git(['rev-parse', `HEAD:${file}`]);
    if (historicalBlob !== currentBlob) mismatches.push({ file, historical_blob: historicalBlob, current_blob: currentBlob });
  }
  assert.deepEqual(mismatches, [], 'FROZEN_FORMAL_CANDIDATE_DRIFT');
  return { subject, file_count: files.length, mismatches };
}
function validateState() {
  const status = readJson(STATUS);
  const implementation = readJson(IMPLEMENTATION);
  const declaration = readJson(WORKFLOW_DECLARATION);
  const predecessor = readJson(PREDECESSOR);
  const waiver = readJson(OWNER_WAIVER);
  const gates = readJson(ENTRY_GATES);

  assert.equal(status.s2_candidate_implemented, true);
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.focused_workflow, 'mcft-cap-08-s2-forcing-state-forecast');
  assert.equal(status.standard_workflow, 'ci');
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.s2_effective, false);
  assert.equal(status.s3_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);

  assert.equal(waiver.independent_review_satisfied, false);
  assert.equal(waiver.independent_review_performed, false);
  assert.equal(waiver.independent_review_waived, true);
  assert.equal(waiver.waiver_effect.technical_gate_relaxation, false);
  assert.equal(gates.production_runtime_source_authorized, false);
  assert.equal(gates.mcft_cap_09_authorized, false);

  assert.equal(implementation.formal_provider_contract_digest, 'sha256:4ac1b1f9175e54a7560e5d7c907d8b31f2a39179e6f140a25ebcc17eb99dc8d1');
  assert.equal(implementation.formal_provider_preparation_merge, PREP);
  assert.equal(implementation.completion_authority_merge, G3);
  assert.equal(implementation.formal_run.successful_tick_count, 24);
  assert.equal(implementation.formal_run.forecast_point_count, 1728);
  assert.deepEqual(implementation.selected_state_observations_by_tick, {
    T02: 'FVO-02', T03: 'FVO-03', T04: 'FVO-04', T10: 'FVO-10', T22: 'FVO-22',
  });
  assert.equal(implementation.quarantine.residual_only_count, 17);
  assert.equal(implementation.quarantine.late_state_correction_count, 1);

  for (const file of PROVIDER) {
    assert.equal(git(['rev-parse', `HEAD:${file}`]), git(['rev-parse', `${PREP}:${file}`]), `PROVIDER_SOURCE_DRIFT:${file}`);
  }
  for (const file of G3_CORE) {
    assert.equal(git(['rev-parse', `HEAD:${file}`]), git(['rev-parse', `${G3}:${file}`]), `G3_CORE_DRIFT:${file}`);
  }

  assert.equal(predecessor.predecessor_merge_subject, S1);
  assert.equal(predecessor.predecessor_exact_sha_workflow_run, 29980589779);
  assert.equal(predecessor.predecessor_exact_sha_artifact_id, 8553043184);
  assert.equal(predecessor.predecessor_semantic_artifact_digest, 'sha256:7f8e6d61f038ddfd6a6b86430c230fc7e36509011d4131bae1670034ff2b74bc');
  assert.equal(predecessor.predecessor_effective_status, 'S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S2');
  assert.equal(predecessor.readback_verified, true);

  assert.equal(declaration.candidate_workflow.runs_provider_positive_and_source_negatives, true);
  assert.equal(declaration.candidate_workflow.runs_completion_authority_n1_n14, true);
  assert.equal(declaration.exact_sha_workflow.replays_boundary_on_detached_candidate_sha, true);
  assert.equal(declaration.exact_sha_workflow.upload_readback_required, true);
  return { status };
}

try {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.equal(git(['merge-base', base, 'HEAD']), base);
  assert.equal(git(['diff', '--check', `${base}...HEAD`]), '');
  const actual = changedFiles(base);
  const commitCount = Number(git(['rev-list', '--count', `${base}..HEAD`]));
  assert.equal(commitCount, 1, 'S2_BOUNDARY_ONE_COMMIT_REQUIRED');

  const { status } = validateState();
  let classification;
  let frozenCandidate = null;

  if (base === FORMAL_BASE) {
    const manifest = readJson(MANIFEST);
    assert.equal(manifest.base_sha, FORMAL_BASE);
    assert.equal(manifest.changed_file_count, 12);
    assert.deepEqual(actual, [...manifest.changed_files].sort());
    classification = 'FORMAL_S2_CANDIDATE_MODE';
  } else if (base === FAILED_EXACT_MERGE) {
    assert.deepEqual(actual, REMEDIATION_FILES, 'EXACT_SHA_REMEDIATION_EXACT_FILES');
    frozenCandidate = freezeAgainst(FAILED_EXACT_MERGE, FORMAL_FILES_FROZEN_ON_REMEDIATION);
    const verifier = read(EXACT_SCRIPT);
    assert.match(verifier, /MCFT_CAP08_S2_EXACT_SHA_REMEDIATION_V1/);
    assert.match(verifier, /MCFT_CANDIDATE_DECLARATION_V2/);
    assert.match(verifier, /ORIGINAL_CANDIDATE_PR = 2637/);
    assert.match(verifier, /\/commits\/\$\{subject\}\/pulls/);
    assert.match(verifier, /pull\.merge_commit_sha === subject/);
    assert.match(verifier, /\/pulls\/\$\{ORIGINAL_CANDIDATE_PR\}/);
    assert.doesNotMatch(verifier, /\/puls/);
    assert.doesNotMatch(verifier, /imerge_commit_sha/);
    assert.match(verifier, /MERGED_PULLS_API_PATH_INVALID/);
    classification = 'EXACT_SHA_VERIFIER_REMEDIATION_MODE';
  } else {
    throw new Error(`S2_BOUNDARY_BASE_UNAUTHORIZED:${base}`);
  }

  const focused = read('.github/workflows/mcft-cap-08-s2-forcing-state-forecast.yml');
  const exact = read('.github/workflows/mcft-cap-08-s2-exact-sha-attestation.yml');
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S2_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S2_FORCING_STATE_FORECAST_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts',
    'mcft_cap08_s2_artifact_finalize.cjs',
  ]) assert.ok(focused.includes(token), `FOCUSED_WORKFLOW_MISSING:${token}`);
  for (const token of [
    'ACCEPTANCE_MCFT_CAP_08_S2_EXACT_SHA_ATTESTATION.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S2_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S2_FORCING_STATE_FORECAST_DB.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts',
    'mcft_cap08_s2_artifact_finalize.cjs',
    'mcft_attestation_retention_store_v1.cjs',
  ]) assert.ok(exact.includes(token), `EXACT_WORKFLOW_MISSING:${token}`);
  assert.doesNotMatch(focused, /workflow_dispatch/);
  assert.match(exact, /workflow_dispatch/);

  const forbidden = actual.filter((file) =>
    file.startsWith('apps/web/') ||
    file.startsWith('apps/server/src/routes/') ||
    file.startsWith('apps/server/db/migrations/') ||
    file.startsWith('docker/postgres/init/') ||
    file.includes('scheduler') ||
    file.includes('model_activation'));
  assert.deepEqual(forbidden, []);

  const result = {
    schema_version: 'geox_mcft_cap08_s2_boundary_result_v4',
    status: 'PASS',
    classification,
    base_sha: base,
    candidate_sha: git(['rev-parse', 'HEAD']),
    commit_count: commitCount,
    changed_file_count: actual.length,
    changed_files: actual,
    frozen_formal_candidate: frozenCandidate,
    provider_source_merge: PREP,
    completion_authority_merge: G3,
    owner_review_waived: true,
    independent_review_satisfied: false,
    s2_candidate_implemented: status.s2_candidate_implemented,
    s2_effective: false,
    s3_authorized: false,
    production_runtime_source_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s2_boundary_result_v4',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
