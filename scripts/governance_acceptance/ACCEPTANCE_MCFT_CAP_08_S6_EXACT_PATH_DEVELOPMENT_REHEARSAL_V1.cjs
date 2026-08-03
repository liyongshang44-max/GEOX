#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '2e6c670be5a6c1176da3968410d566a061e0c1e5';
const EXPECTED_OBJECT_COUNT = 56;
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_EXACT_PATH_DEVELOPMENT_REHEARSAL_STATIC_RESULT.json');
const MANIFEST = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-EXACT-PATH-DEVELOPMENT-REHEARSAL-OBJECT-SET-V1.json';
const RUN_CONTRACT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-exact-path-development-rehearsal.yml';
const STATIC = '.github/workflows/mcft-cap-08-s6-exact-path-development-rehearsal-static.yml';
const FORMAL = '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_EXACT_PATH_DEVELOPMENT_REHEARSAL_V1.cjs';
const DIR = 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow';
const PORT = 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports';
const DB = 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db';
const CAP07_READER = `${PORT}/cap07_reader_v1.cjs`;
const CAP07_ADAPTER = `${DB}/cap07_readback_execution_adapter_v1.cjs`;
const SELECTOR_SNAPSHOT = `${PORT}/selector_snapshot_v1.cjs`;
const DATABASE_SOURCE_ADAPTER = `${DB}/database_source_adapter_v1.cjs`;
const STATE_PROJECTION_BUILDER = 'apps/server/src/projections/twin_runtime/projection_rebuilder_v1.ts';
const STATE_PROJECTION_MIGRATION = 'apps/server/db/migrations/2026_08_03_mcft_cap08_s6_state_projection_payload_reconciliation.sql';

const CHANGED = [
  WORKFLOW,
  STATIC,
  MANIFEST,
  STATE_PROJECTION_BUILDER,
  STATE_PROJECTION_MIGRATION,
  `${DIR}/database_identity_v1.cjs`,
  `${DIR}/development_rehearsal_authority_builder_v1.cjs`,
  `${DIR}/development_rehearsal_authority_gate_v1.cjs`,
  `${DIR}/execution_authority_gate_v1.cjs`,
  `${DIR}/integration_qualification_v1.cjs`,
  `${DIR}/restart_readback_v1.cjs`,
  `${DIR}/run_qualification_v1.cjs`,
  `${DIR}/semantic_comparator_v1.cjs`,
  `${DIR}/workflow_entrypoint_v1.ts`,
  `${PORT}/artifact_writer_v1.cjs`,
  CAP07_READER,
  `${PORT}/direct_materializer_v1.cjs`,
  `${PORT}/index_v1.cjs`,
  SELECTOR_SNAPSHOT,
  `${PORT}/shared_v1.cjs`,
  CAP07_ADAPTER,
  DATABASE_SOURCE_ADAPTER,
  `${DB}/harness_v1.cjs`,
  `${DB}/materializer_adapter_v1.cjs`,
  `${DB}/recovery_execution_adapter_v1.cjs`,
  VALIDATOR,
].sort();

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function text(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function json(file) {
  return JSON.parse(text(file));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semantic(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}

function count(source, regex) {
  return [...source.matchAll(regex)].length;
}

function save(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE);
  assert.equal(git('merge-base', base, 'HEAD'), base);
  assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '');
  assert.deepEqual(
    git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
  );

  const manifest = json(MANIFEST);
  assert.equal(manifest.semantic_digest, semantic(manifest));
  assert.equal(manifest.object_count, EXPECTED_OBJECT_COUNT);
  assert.equal(manifest.authority_class, 'DEVELOPMENT_REHEARSAL');
  assert.equal(manifest.evidence_class, 'NON_FORMAL');
  assert.equal(manifest.workflow_path, FORMAL);
  assert.equal(git('rev-parse', `HEAD:${FORMAL}`), manifest.workflow_blob_sha);

  const objectSets = [
    manifest.exact_control_plane_object_set,
    manifest.exact_database_bootstrap_object_set,
    manifest.exact_product_object_set,
    manifest.exact_port_bundle_object_set,
    manifest.exact_harness_object_set,
    manifest.protected_invariant_object_set,
  ];
  assert.equal(
    objectSets.reduce((total, set) => total + Object.keys(set).length, 0),
    EXPECTED_OBJECT_COUNT,
  );
  for (const set of objectSets) {
    for (const [file, sha] of Object.entries(set)) {
      assert.equal(git('rev-parse', `HEAD:${file}`), sha, `OBJECT:${file}`);
    }
  }

  const sharedSource = text(`${PORT}/shared_v1.cjs`);
  assert.match(sharedSource, /require\('tsx\/esm\/api'\)/);
  assert.match(sharedSource, /tsImport\(path\.join\(root, relative\), __filename\)/);
  assert.doesNotMatch(sharedSource, /import\(pathToFileURL/);
  assert.match(sharedSource, /CAP07_REQUEST_SCOPE_REQUIRED/);
  assert.match(sharedSource, /CAP07_REQUEST_ENVELOPE_KEYS/);

  const readerSource = text(CAP07_READER);
  const adapterSource = text(CAP07_ADAPTER);
  assert.match(readerSource, /validateCap07RequestEnvelopeV1/);
  assert.match(readerSource, /collection_kind = request\.collection_kind/);
  assert.doesNotMatch(readerSource, /spec\.scope/);
  assert.match(adapterSource, /buildCap07RequestEnvelopeV1/);
  assert.match(adapterSource, /private, no-store/);

  const selectorSource = text(SELECTOR_SNAPSHOT);
  assert.match(selectorSource, /assimilation\.payload\.status==='APPLIED'/);
  assert.match(selectorSource, /kind:o\.option_id/);
  assert.match(selectorSource, /residual_refs:\['R-01','R-16'\]/);
  const databaseSourceAdapter = text(DATABASE_SOURCE_ADAPTER);
  assert.match(databaseSourceAdapter, /PER_RUN_TRANSACTION_PHASES_V1 = Object\.freeze\(\['E', 'H', 'A', 'B'\]\)/);
  assert.match(databaseSourceAdapter, /PER_RUN_TRANSACTION_PHASE_PROJECTION/);

  const projectionSource = text(STATE_PROJECTION_BUILDER);
  assert.match(projectionSource, /canonical_payload: structuredClone\(state\.object\.payload\)/);
  assert.doesNotMatch(projectionSource, /canonical_payload: state\.object[,\n]/);
  const migrationSource = text(STATE_PROJECTION_MIGRATION);
  assert.match(migrationSource, /SET canonical_payload = canonical_payload -> 'payload'/);
  assert.match(migrationSource, /canonical_payload ->> 'object_id' = state_object_id/);
  assert.match(migrationSource, /canonical_payload ->> 'determinism_hash' = determinism_hash/);

  const workflowSource = text(WORKFLOW);
  assert.equal(count(workflowSource, /image: postgres:16/g), 2);
  assert.equal(count(workflowSource, /workflow_entrypoint_v1\.ts/g), 2);
  assert.equal(count(workflowSource, /restart_readback_v1\.cjs/g), 2);
  assert.equal(count(workflowSource, /run_qualification_v1\.cjs/g), 2);
  assert.equal(count(workflowSource, /semantic_comparator_v1\.cjs/g), 1);
  assert.equal(count(workflowSource, /integration_qualification_v1\.cjs/g), 1);
  assert.doesNotMatch(workflowSource, /gh\s+workflow\s+run|createWorkflowDispatch|MCFT_CAP08_EXECUTION_AUTHORITY_PATH/i);

  const authorityBuilderSource = text(`${DIR}/development_rehearsal_authority_builder_v1.cjs`);
  assert.match(authorityBuilderSource, /EXPECTED_OBJECT_COUNT = 56/);
  assert.match(authorityBuilderSource, /object_count: manifest\.object_count/);

  const { buildAuthorityV1 } = require(path.join(ROOT, DIR, 'development_rehearsal_authority_builder_v1.cjs'));
  const {
    validateExecutionAuthorityV1,
    validateDevelopmentRehearsalAuthorityV1,
  } = require(path.join(ROOT, DIR, 'execution_authority_gate_v1.cjs'));
  const { materializePhysicalDatabaseNameV1 } = require(path.join(ROOT, DIR, 'database_identity_v1.cjs'));
  const {
    CAP07_SCOPE_KEYS_V1,
    buildCap07RequestEnvelopeV1,
    canonical: canonicalRequest,
  } = require(path.join(ROOT, PORT, 'shared_v1.cjs'));
  const { executeCompleteCap07ReadbackV1 } = require(path.join(ROOT, DB, 'cap07_readback_execution_adapter_v1.cjs'));

  const head = git('rev-parse', 'HEAD');
  const authorities = {};
  for (const slot of ['A', 'B']) {
    const authority = buildAuthorityV1({
      manifest,
      exactSubjectSha: head,
      githubRunId: '30799000001',
      slot,
    });
    authorities[slot] = authority;
    validateDevelopmentRehearsalAuthorityV1(authority, {
      exactSubjectSha: head,
      runLabel: authority.authorized_run_label,
      operationalRunInstanceId: authority.operational_run_instance_id,
    });
    assert.throws(
      () => validateExecutionAuthorityV1(authority, {
        exactSubjectSha: head,
        runLabel: authority.authorized_run_label,
        operationalRunInstanceId: authority.operational_run_instance_id,
      }),
      /EXECUTION_AUTHORITY_MODE/,
    );
    assert.equal(authority.evidence_class, 'NON_FORMAL');
    assert.equal(authority.workflow_dispatch_execution_authorized, false);
    assert.equal(authority.object_set_manifest_ref.object_count, EXPECTED_OBJECT_COUNT);
    assert.equal(
      materializePhysicalDatabaseNameV1(authority, '30799000001'),
      `geox_mcft_cap08_s6_rehearsal_${slot.toLowerCase()}_30799000001`,
    );
  }

  const exactScope = json(RUN_CONTRACT).scope;
  assert.deepEqual(Object.keys(exactScope).sort(), [...CAP07_SCOPE_KEYS_V1].sort());
  assert.throws(
    () => buildCap07RequestEnvelopeV1({ scope: null, surface: 'runtime' }),
    /CAP07_REQUEST_SCOPE_REQUIRED/,
  );
  const deterministicA = buildCap07RequestEnvelopeV1({ scope: exactScope, surface: 'runtime' });
  const deterministicB = buildCap07RequestEnvelopeV1({ scope: { ...exactScope }, surface: 'runtime' });
  assert.equal(canonicalRequest(deterministicA), canonicalRequest(deterministicB));

  const observedRequests = [];
  const mockCap07Port = {
    async request(request) {
      observedRequests.push(request);
      return {
        status: 200,
        cache_control: 'private, no-store',
        content_hash: `sha256:${'1'.repeat(64)}`,
        response_hash: `sha256:${'2'.repeat(64)}`,
        next_cursor: null,
        body: {},
      };
    },
  };
  const authorityA = authorities.A;
  const focusedReadback = await executeCompleteCap07ReadbackV1(mockCap07Port, {
    exact_subject_sha: head,
    run_label: authorityA.authorized_run_label,
    operational_run_instance_id: authorityA.operational_run_instance_id,
    scope: exactScope,
  }, authorityA);
  assert.equal(focusedReadback.surface_definition_count, 10);
  assert.equal(focusedReadback.request_variant_count, 11);
  assert.equal(focusedReadback.surfaces.length, 11);
  assert.equal(observedRequests.length, 11);
  assert.ok(observedRequests.every(request => canonicalRequest(request.scope) === canonicalRequest(exactScope)));
  assert.deepEqual(
    observedRequests.filter(request => request.surface === 'model-governance').map(request => request.collection_kind),
    ['CALIBRATION_CANDIDATE', 'SHADOW_EVALUATION'],
  );
  assert.ok(observedRequests.filter(request => request.surface !== 'model-governance').every(request => request.collection_kind === null));

  assert.match(text(`${DB}/harness_v1.cjs`), /witness_count, 22/);
  assert.match(text(`${DB}/harness_v1.cjs`), /synthetic:\s*false/);
  assert.match(text(`${DIR}/restart_readback_v1.cjs`), /fresh_process_module_reload: true/);
  assert.match(text(`${DIR}/run_qualification_v1.cjs`), /FVO17_R17_FORECAST_BINDING/);
  assert.match(text(`${DIR}/run_qualification_v1.cjs`), /STATE_PROJECTION_CANONICAL_PAYLOAD_DIVERGENCE/);
  assert.match(text(`${DIR}/semantic_comparator_v1.cjs`), /DEVELOPMENT_REHEARSAL_SEMANTIC_DRIFT/);
  assert.match(text(`${DIR}/integration_qualification_v1.cjs`), /governance_authority_agent/);

  for (const file of CHANGED.filter(file => file.endsWith('.cjs'))) {
    execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { cwd: ROOT, encoding: 'utf8' });
  }

  const result = {
    schema_version: 'geox_mcft_cap08_s6_exact_path_development_rehearsal_static_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: head,
    changed_file_count: CHANGED.length,
    commit_count: 1,
    frozen_object_count: EXPECTED_OBJECT_COUNT,
    independent_postgres_job_count: 2,
    exact_witness_producer_path_required: 22,
    cap07_request_contract_focused_acceptance: true,
    cap07_exact_scope_key_count: CAP07_SCOPE_KEYS_V1.length,
    cap07_request_variant_count: observedRequests.length,
    state_projection_payload_contract_frozen: true,
    witness_selector_contract_frozen: true,
    synthetic_execution_path_used: false,
    formal_authority_created: false,
    formal_workflow_dispatched: false,
    replacement_010_consumed: false,
    run_b_formal_authorized: false,
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  save({
    schema_version: 'geox_mcft_cap08_s6_exact_path_development_rehearsal_static_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
});