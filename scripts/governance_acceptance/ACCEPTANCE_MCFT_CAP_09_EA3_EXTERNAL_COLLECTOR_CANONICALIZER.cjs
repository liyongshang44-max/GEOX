'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '3d79a4d670418a88398b61a6da8219771d24a89a';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const EA2_PACKAGE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json';
const EA2_SOURCE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json';
const IMPL = 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts';
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA3-EXTERNAL-COLLECTOR-CANONICALIZER-CANDIDATE-V1.json';
const RUNTIME_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.ts';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.cjs';
const WF = '.github/workflows/mcft-cap-09-ea3-external-collector-canonicalizer.yml';
const EXPECT = [IMPL, AUTH, RUNTIME_ACCEPTANCE, GATE, WF].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER_GOVERNANCE_RESULT.json');

const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment01: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  ea2Package: 'bca08b92c142be48b0b3ab82aff7d29a844d22c3',
  ea2Source: '30b7910a1bd27882b80eb56041924d0f6252ae02',
  implementation: '5b4e5133e51dfaf447c2de52caf1a9f50c8254d3',
};

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (value, code) => { if (!value) throw new Error(code); };

const result = {
  schema_version: 'geox_mcft_cap09_ea3_external_collector_canonicalizer_governance_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  public_provider_live_request_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  formal_window_started: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA3_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA3_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  const actualPins = {
    task: blob(BASE, TASK),
    amendment01: blob(BASE, A1),
    ea2Package: blob(BASE, EA2_PACKAGE),
    ea2Source: blob(BASE, EA2_SOURCE),
  };
  result.predecessor_blobs = actualPins;
  for (const key of Object.keys(actualPins)) req(actualPins[key] === PINS[key], `EA3_PREDECESSOR_BLOB_DRIFT:${key}:actual=${actualPins[key]}:expected=${PINS[key]}`);
  req(blob('HEAD', IMPL) === PINS.implementation, `EA3_IMPLEMENTATION_BLOB_DRIFT:${blob('HEAD', IMPL)}`);

  const task = read(TASK);
  const amendment = read(A1);
  const ea2Package = json(EA2_PACKAGE);
  const ea2Source = json(EA2_SOURCE);
  const authority = json(AUTH);
  const implementation = read(IMPL);
  const runtimeAcceptance = read(RUNTIME_ACCEPTANCE);
  const workflow = read(WF);

  req(task.includes('S6-EA3 collector/canonicalizer qualification'), 'EA3_TASKBOOK_FRONTIER_CONTRACT_MISSING');
  req(task.includes('S6-EA4 live source exact-head proof'), 'EA3_TASKBOOK_SUCCESSOR_CONTRACT_MISSING');
  req(amendment.includes('Collectors/canonicalizers may retrieve public external data'), 'EA3_AMENDMENT_COLLECTOR_BOUNDARY_MISSING');
  req(amendment.includes('Runtime must never fetch public providers directly'), 'EA3_AMENDMENT_RUNTIME_PUBLIC_FETCH_PROHIBITION_MISSING');
  req(amendment.includes('Fetch-transform-discard is not allowed.'), 'EA3_AMENDMENT_RAW_RETENTION_RULE_MISSING');

  req(ea2Package.formal_eligibility?.formal_eligible === false, 'EA3_EA2_PACKAGE_FORMAL_ELIGIBLE_MUST_BE_FALSE');
  req(ea2Package.required_evidence_families?.future_weather?.ea1n_full_72h_value_pipeline_qualified === false, 'EA3_EA2_GFS_FULL_VALUE_FALSE_REQUIRED');
  req(ea2Package.required_evidence_families?.future_et0?.future_et0_executed === false, 'EA3_EA2_FUTURE_ET0_NOT_EXECUTED_REQUIRED');
  req(ea2Package.successor_authority?.first_legal_successor_after_effective_ea2_merge === 'S6-EA3_EXTERNAL_COLLECTOR_AND_CANONICALIZER_CANDIDATE', 'EA3_EA2_SUCCESSOR_AUTHORITY_DRIFT');
  req(ea2Source.authority_effect?.formal_external_evidence_ingress_eligible === false, 'EA3_EA2_SOURCE_FORMAL_INGRESS_FALSE_REQUIRED');
  req(ea2Source.authority_effect?.live_72h_full_value_pipeline_qualified === false, 'EA3_EA2_SOURCE_FULL_VALUE_FALSE_REQUIRED');
  req(ea2Source.binding_policy?.runtime_fetches_public_providers === false, 'EA3_EA2_RUNTIME_FETCH_FALSE_REQUIRED');

  req(authority.record_status === 'EA3_EXTERNAL_COLLECTOR_CANONICALIZER_CANDIDATE_NOT_EFFECTIVE', 'EA3_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA3_AUTHORITY_BASE_DRIFT');
  req(authority.taskbook_blob_sha === PINS.task && authority.amendment_01_blob_sha === PINS.amendment01, 'EA3_AUTHORITY_TASKBOOK_OR_AMENDMENT_PIN_DRIFT');
  req(authority.ea2_package_blob_sha === PINS.ea2Package && authority.ea2_source_matrix_blob_sha === PINS.ea2Source, 'EA3_AUTHORITY_EA2_PIN_DRIFT');
  req(authority.implementation_blob_sha === PINS.implementation, 'EA3_AUTHORITY_IMPLEMENTATION_PIN_DRIFT');

  const boundary = authority.architecture_boundary;
  req(boundary.concrete_public_fetch_implementation_present === false, 'EA3_CONCRETE_PUBLIC_FETCH_FORBIDDEN');
  req(boundary.runtime_public_provider_fetch_authorized === false, 'EA3_RUNTIME_PUBLIC_FETCH_FORBIDDEN');
  req(boundary.database_writer_present === false && boundary.formal_evidence_writer_present === false, 'EA3_WRITER_PRESENT');
  req(boundary.scheduler_present === false && boundary.wall_clock_read_inside_pipeline === false && boundary.environment_lookup_inside_pipeline === false, 'EA3_HIDDEN_RUNTIME_DEPENDENCY_PRESENT');
  for (const token of ['PRIVATE_RESTRICTED_RAW_RETENTION_RECEIPT_BARRIER','EXISTING_CANONICAL_REPLAY_EVIDENCE_RECORD_V1_ENVELOPE','EA5_RESTRICTED_FORMAL_EVIDENCE_WRITER_NOT_IMPLEMENTED_HERE','TWIN_RUNTIME_NOT_CALLED_HERE']) req(boundary.flow.includes(token), `EA3_ARCHITECTURE_FLOW_TOKEN_MISSING:${token}`);

  const retention = authority.raw_retention_barrier;
  req(retention.raw_sha256_must_be_computed_before_decoder === true && retention.retention_receipt_required_before_decoder === true, 'EA3_RETENTION_PREDECODE_BARRIER_WEAKENED');
  req(retention.receipt_digest_must_equal_raw_digest === true && retention.receipt_byte_count_must_equal_raw_byte_count === true, 'EA3_RETENTION_RECEIPT_VERIFICATION_WEAKENED');
  req(retention.receipt_must_mark_externally_publishable_false === true && retention.fetch_transform_discard_authorized === false && retention.decoder_may_run_when_retention_validation_fails === false, 'EA3_RETENTION_PUBLICATION_OR_DISCARD_WEAKENED');

  const output = authority.canonical_output_contract;
  req(output.new_canonical_object_family_created === false && output.six_key_scope_required === true && output.field_c8_demo_forbidden === true, 'EA3_CANONICAL_SCOPE_CONTRACT_DRIFT');
  req(output.source_record_id_required === true && output.source_record_hash_semantic_binding_required === true && output.binding_id_required === true, 'EA3_CANONICAL_IDENTITY_CONTRACT_DRIFT');
  req(output.provider_or_model_identity_required === true && output.epistemic_class_required === true && output.available_to_runtime_at_required === true, 'EA3_CANONICAL_PROVENANCE_CONTRACT_DRIFT');
  req(output.event_or_issue_time_required === true && output.ingested_at_required === true && output.limitations_required === true, 'EA3_CANONICAL_TIME_OR_LIMITATION_CONTRACT_DRIFT');
  req(output.raw_digest_and_private_retention_ref_metadata_required === true && output.raw_payload_bytes_in_canonical_record_forbidden === true, 'EA3_CANONICAL_RAW_BOUNDARY_DRIFT');
  req(JSON.stringify(output.quality_status_allowed) === JSON.stringify(['PASS','LIMITED']), 'EA3_QUALITY_STATUS_SET_DRIFT');

  const roles = authority.role_policy;
  const expectedRoles = {
    SOIL_MOISTURE_OBSERVATION: ['soil_moisture_observation_v1','OBSERVED','observed_at'],
    RAINFALL_OBSERVATION: ['observed_rainfall_v1','OBSERVED','interval_end'],
    HISTORICAL_ET0_INPUT: ['historical_et0_estimate_v1','ESTIMATED','interval_end'],
    FUTURE_WEATHER_ASSUMPTION: ['future_weather_assumption_v1','ASSUMED','issued_at'],
    FUTURE_ET0_ASSUMPTION: ['future_et0_assumption_v1','ASSUMED','issued_at'],
  };
  for (const [role,[recordType,epistemic,eventField]] of Object.entries(expectedRoles)) {
    req(roles[role]?.record_type === recordType && roles[role]?.epistemic_class === epistemic && roles[role]?.event_time_field === eventField, `EA3_ROLE_POLICY_DRIFT:${role}`);
  }

  const qualification = authority.qualification_required;
  for (const key of ['five_role_contract_coverage','same_input_same_semantic_hash','retention_precedes_decoder','retention_digest_mismatch_fails_before_decoder','future_or_event_time_after_runtime_availability_fails','epistemic_role_mismatch_fails','raw_binary_leak_fails','unsafe_debug_or_simulated_trust_surface_fails']) req(qualification[key] === true, `EA3_QUALIFICATION_REQUIREMENT_WEAKENED:${key}`);
  req(qualification.database_write_count === 0 && qualification.formal_evidence_write_count === 0 && qualification.public_provider_live_request_count === 0, 'EA3_QUALIFICATION_IO_COUNT_DRIFT');

  const preserved = authority.ea2_nonqualifications_preserved;
  req(preserved.external_evidence_package_formal_eligible === false && preserved.gfs_72h_full_value_pipeline_qualified === false && preserved.future_et0_72h_value_execution_qualified === false, 'EA3_EA2_FALSE_FACT_REWRITTEN');
  req(preserved.ea3_may_rewrite_ea1n_false_to_true === false && preserved.ea3_may_mark_package_formal_eligible === false, 'EA3_AUTHORITY_LAUNDERING_ENABLED');

  const effect = authority.authority_effect;
  req(effect.collector_canonicalizer_candidate_defined === true && effect.collector_runtime_activated === false && effect.live_source_qualified === false, 'EA3_EFFECT_ACTIVATION_DRIFT');
  req(effect.formal_ingress_eligible === false && effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA3_PREMATURE_FORMAL_OR_COMPLETION_EFFECT');

  req(implementation.includes('export interface ExternalEvidenceTransportPortV1') && implementation.includes('export interface RawEvidenceRetentionPortV1') && implementation.includes('export interface ExternalEvidenceDecoderPortV1'), 'EA3_INJECTED_PORTS_MISSING');
  req(implementation.includes('const receipt = await ports.retention.retainRawEvidence(retentionInput);'), 'EA3_RETENTION_CALL_MISSING');
  req(implementation.includes('const decoded = await ports.decoder.decodeRetainedEvidence'), 'EA3_DECODER_CALL_MISSING');
  req(implementation.indexOf('const receipt = await ports.retention.retainRawEvidence(retentionInput);') < implementation.indexOf('const decoded = await ports.decoder.decodeRetainedEvidence'), 'EA3_DECODER_BEFORE_RETENTION_FORBIDDEN');
  req(implementation.includes('EA3_RETENTION_DIGEST_MISMATCH') && implementation.includes('EA3_RETENTION_BYTE_COUNT_MISMATCH') && implementation.includes('EA3_RAW_RETENTION_PUBLICATION_FORBIDDEN'), 'EA3_RETENTION_RECEIPT_FAIL_CLOSED_CHECKS_MISSING');
  req(implementation.includes('EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY') && implementation.includes('EA3_EPISTEMIC_CLASS_MISMATCH') && implementation.includes('EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN') && implementation.includes('EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN'), 'EA3_CANONICAL_FAIL_CLOSED_CHECKS_MISSING');
  req(implementation.includes('semanticHashV1') && implementation.includes('canonical_payload_sha256') && implementation.includes('raw_retention_ref'), 'EA3_CANONICAL_HASH_OR_RAW_PROVENANCE_METADATA_MISSING');

  req(!/\bfetch\s*\(/.test(implementation), 'EA3_CONCRETE_FETCH_CALL_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bpg\b|psql\b|INSERT\s+INTO|public\.facts|formal_evidence/i.test(implementation), 'EA3_DATABASE_OR_FORMAL_WRITER_SURFACE_FORBIDDEN');
  req(!/process\.env|Date\.now\s*\(|new Date\s*\(\s*\)/.test(implementation), 'EA3_ENV_OR_WALL_CLOCK_DEPENDENCY_FORBIDDEN');
  req(!/from\s+["'](?:node:)?(?:http|https|undici|pg)["']|require\(["'](?:node:)?(?:http|https|undici|pg)["']\)/.test(implementation), 'EA3_NETWORK_OR_DATABASE_CLIENT_IMPORT_FORBIDDEN');

  req(runtimeAcceptance.includes('decoder_calls_after_retention_failure') && runtimeAcceptance.includes('EA3_DECODER_CALLED_AFTER_RETENTION_FAILURE'), 'EA3_ACCEPTANCE_RETENTION_BARRIER_NEGATIVE_CASE_MISSING');
  req(runtimeAcceptance.includes('EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY') && runtimeAcceptance.includes('EA3_EPISTEMIC_CLASS_MISMATCH') && runtimeAcceptance.includes('EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN') && runtimeAcceptance.includes('EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN'), 'EA3_ACCEPTANCE_NEGATIVE_CASE_SET_MISSING');
  req(runtimeAcceptance.includes('public_provider_live_request_count: 0') && runtimeAcceptance.includes('database_write_count: 0') && runtimeAcceptance.includes('formal_evidence_write_count: 0'), 'EA3_ACCEPTANCE_ZERO_IO_ATTESTATION_MISSING');

  req(workflow.includes('persist-credentials: false'), 'EA3_WORKFLOW_PERSIST_CREDENTIALS_FORBIDDEN');
  req(workflow.includes('MCFT_BASE_SHA') && workflow.includes('MCFT_SUBJECT_SHA'), 'EA3_WORKFLOW_EXACT_SHA_ENV_MISSING');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.cjs') && workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.ts'), 'EA3_WORKFLOW_GATE_OR_RUNTIME_ACCEPTANCE_MISSING');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|GEOX_MCFT_CAP09_S6_DATABASE_URL/.test(workflow), 'EA3_WORKFLOW_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', AUTH),
    implementation_blob: blob('HEAD', IMPL),
    runtime_acceptance_blob: blob('HEAD', RUNTIME_ACCEPTANCE),
    collector_canonicalizer_candidate_defined: true,
    live_source_qualified: false,
    gfs_72h_full_value_pipeline_qualified: false,
    future_et0_72h_value_execution_qualified: false,
    formal_ingress_eligible: false,
    ea4_candidate_development_authorized_after_effective_merge: true,
    public_provider_live_request_count: 0,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
    mcft_cap09_completed: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result));
else console.error(result.error);
