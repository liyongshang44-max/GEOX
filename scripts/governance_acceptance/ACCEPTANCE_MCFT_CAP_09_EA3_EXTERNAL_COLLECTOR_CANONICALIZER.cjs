'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '3d79a4d670418a88398b61a6da8219771d24a89a';
const ACCEPTED_HEAD = '08310e5f50bf5df7580b27fd35285f560320b9df';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  a1: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  pkg: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json',
  source: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json',
  impl: 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts',
  auth: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA3-EXTERNAL-COLLECTOR-CANONICALIZER-CANDIDATE-V1.json',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.ts',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea3-external-collector-canonicalizer.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  a1: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  pkg: 'bca08b92c142be48b0b3ab82aff7d29a844d22c3',
  source: '30b7910a1bd27882b80eb56041924d0f6252ae02',
  impl: '5b4e5133e51dfaf447c2de52caf1a9f50c8254d3',
};
const EXPECT = [F.impl, F.auth, F.acceptance, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea3_external_collector_canonicalizer_governance_result_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  public_provider_live_request_count: 0, database_write_count: 0,
  formal_evidence_write_count: 0, formal_window_started: false,
};

try {
  req(/^[0-9a-f]{40}$/.test(BASE), `EA3_BASE_SHA_INVALID:${BASE}`);
  req(git('merge-base', BASE, 'HEAD') === BASE, `EA3_BASE_NOT_ANCESTOR:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  const historicalCandidate = BASE === EXPECTED_BASE;
  if (historicalCandidate) {
    req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA3_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  } else {
    req(git('merge-base', '--is-ancestor', ACCEPTED_HEAD, 'HEAD') === '', 'EA3_ACCEPTED_HEAD_NOT_ANCESTOR');
    req(blob('HEAD', F.auth) === blob(ACCEPTED_HEAD, F.auth), 'EA3_SUCCESSOR_HISTORICAL_AUTHORITY_MUTATED');
    req(blob('HEAD', F.acceptance) === blob(ACCEPTED_HEAD, F.acceptance), 'EA3_SUCCESSOR_HISTORICAL_ACCEPTANCE_MUTATED');
  }

  const historicalRef = historicalCandidate ? BASE : ACCEPTED_HEAD;
  const actual = { task: blob(historicalRef,F.task), a1: blob(historicalRef,F.a1), pkg: blob(historicalRef,F.pkg), source: blob(historicalRef,F.source) };
  result.predecessor_blobs = actual;
  for (const key of Object.keys(actual)) req(actual[key] === PINS[key], `EA3_PREDECESSOR_BLOB_DRIFT:${key}:actual=${actual[key]}:expected=${PINS[key]}`);
  req(blob(ACCEPTED_HEAD, F.impl) === PINS.impl, `EA3_ACCEPTED_IMPLEMENTATION_BLOB_DRIFT:${blob(ACCEPTED_HEAD,F.impl)}`);
  if (historicalCandidate) req(blob('HEAD', F.impl) === PINS.impl, `EA3_IMPLEMENTATION_BLOB_DRIFT:${blob('HEAD',F.impl)}`);

  const task = read(F.task), a1 = read(F.a1), impl = read(F.impl), acceptance = read(F.acceptance), workflow = read(F.workflow);
  const pkg = json(F.pkg), source = json(F.source), auth = json(F.auth);

  req(task.includes('S6-EA3 collector/canonicalizer qualification'), 'EA3_TASKBOOK_FRONTIER_CONTRACT_MISSING');
  req(task.includes('S6-EA4 live source exact-head proof'), 'EA3_TASKBOOK_SUCCESSOR_CONTRACT_MISSING');
  req(a1.includes('governed collector / canonicalizer'), 'EA3_AMENDMENT_COLLECTOR_BOUNDARY_MISSING');
  req(a1.includes('The Internet collector is never part of the Twin kernel.'), 'EA3_AMENDMENT_COLLECTOR_KERNEL_SEPARATION_MISSING');
  req(a1.includes('Runtime continues to\nconsume governed database Evidence only.') || a1.includes('Runtime continues to consume governed database Evidence only.'), 'EA3_AMENDMENT_RUNTIME_DATABASE_ONLY_BOUNDARY_MISSING');
  req(a1.includes('Fetch-transform-discard of the raw authority is forbidden.'), 'EA3_AMENDMENT_RAW_RETENTION_RULE_MISSING');

  req(pkg.formal_eligibility?.formal_eligible === false, 'EA3_EA2_PACKAGE_FORMAL_ELIGIBLE_MUST_BE_FALSE');
  req(pkg.required_evidence_families?.future_weather?.ea1n_full_72h_value_pipeline_qualified === false, 'EA3_EA2_GFS_FULL_VALUE_FALSE_REQUIRED');
  req(pkg.required_evidence_families?.future_et0?.future_et0_executed === false, 'EA3_EA2_FUTURE_ET0_NOT_EXECUTED_REQUIRED');
  req(pkg.successor_authority?.first_legal_successor_after_effective_ea2_merge === 'S6-EA3_EXTERNAL_COLLECTOR_AND_CANONICALIZER_CANDIDATE', 'EA3_EA2_SUCCESSOR_AUTHORITY_DRIFT');
  req(source.authority_effect?.formal_external_evidence_ingress_eligible === false, 'EA3_EA2_SOURCE_FORMAL_INGRESS_FALSE_REQUIRED');
  req(source.authority_effect?.live_72h_full_value_pipeline_qualified === false, 'EA3_EA2_SOURCE_FULL_VALUE_FALSE_REQUIRED');
  req(source.binding_policy?.runtime_fetches_public_providers === false, 'EA3_EA2_RUNTIME_FETCH_FALSE_REQUIRED');

  req(auth.record_status === 'EA3_EXTERNAL_COLLECTOR_CANONICALIZER_CANDIDATE_NOT_EFFECTIVE', 'EA3_AUTHORITY_STATUS_DRIFT');
  req(auth.base_main_sha === EXPECTED_BASE, 'EA3_AUTHORITY_BASE_DRIFT');
  req(auth.taskbook_blob_sha === PINS.task && auth.amendment_01_blob_sha === PINS.a1, 'EA3_AUTHORITY_FOUNDATION_PIN_DRIFT');
  req(auth.ea2_package_blob_sha === PINS.pkg && auth.ea2_source_matrix_blob_sha === PINS.source, 'EA3_AUTHORITY_EA2_PIN_DRIFT');
  req(auth.implementation_blob_sha === PINS.impl, 'EA3_AUTHORITY_IMPLEMENTATION_PIN_DRIFT');

  const b = auth.architecture_boundary;
  req(b.position === 'BEFORE_FORMAL_EVIDENCE_WRITER_AND_BEFORE_PUBLIC_FACTS_AND_BEFORE_DATABASE_EVIDENCE_ADAPTER', 'EA3_ARCHITECTURE_POSITION_DRIFT');
  req(b.concrete_public_fetch_implementation_present === false && b.runtime_public_provider_fetch_authorized === false, 'EA3_PUBLIC_FETCH_BOUNDARY_WEAKENED');
  req(b.database_writer_present === false && b.formal_evidence_writer_present === false && b.scheduler_present === false, 'EA3_WRITER_OR_SCHEDULER_PRESENT');
  req(b.wall_clock_read_inside_pipeline === false && b.environment_lookup_inside_pipeline === false, 'EA3_HIDDEN_RUNTIME_DEPENDENCY_PRESENT');
  for (const token of ['PRIVATE_RESTRICTED_RAW_RETENTION_RECEIPT_BARRIER','EXISTING_CANONICAL_REPLAY_EVIDENCE_RECORD_V1_ENVELOPE','EA5_RESTRICTED_FORMAL_EVIDENCE_WRITER_NOT_IMPLEMENTED_HERE','TWIN_RUNTIME_NOT_CALLED_HERE']) req(b.flow.includes(token), `EA3_ARCHITECTURE_FLOW_TOKEN_MISSING:${token}`);

  const r = auth.raw_retention_barrier;
  req(r.raw_sha256_must_be_computed_before_decoder && r.retention_receipt_required_before_decoder, 'EA3_RETENTION_PREDECODE_BARRIER_WEAKENED');
  req(r.receipt_digest_must_equal_raw_digest && r.receipt_byte_count_must_equal_raw_byte_count, 'EA3_RETENTION_RECEIPT_VERIFICATION_WEAKENED');
  req(r.receipt_must_mark_externally_publishable_false && r.fetch_transform_discard_authorized === false && r.decoder_may_run_when_retention_validation_fails === false, 'EA3_RETENTION_DISCARD_OR_PUBLICATION_WEAKENED');

  const c = auth.canonical_output_contract;
  req(c.new_canonical_object_family_created === false && c.six_key_scope_required && c.field_c8_demo_forbidden, 'EA3_CANONICAL_SCOPE_CONTRACT_DRIFT');
  for (const key of ['source_record_id_required','source_record_hash_semantic_binding_required','binding_id_required','provider_or_model_identity_required','epistemic_class_required','available_to_runtime_at_required','event_or_issue_time_required','ingested_at_required','source_and_canonical_units_required','conversion_rule_id_version_authority_required','source_binding_version_required','limitations_required','canonical_payload_sha256_required','raw_digest_and_private_retention_ref_metadata_required','raw_payload_bytes_in_canonical_record_forbidden']) req(c[key] === true, `EA3_CANONICAL_CONTRACT_WEAKENED:${key}`);
  req(JSON.stringify(c.quality_status_allowed) === JSON.stringify(['PASS','LIMITED']), 'EA3_QUALITY_STATUS_SET_DRIFT');

  const expectedRoles = {
    SOIL_MOISTURE_OBSERVATION:['soil_moisture_observation_v1','OBSERVED','observed_at'],
    RAINFALL_OBSERVATION:['observed_rainfall_v1','OBSERVED','interval_end'],
    HISTORICAL_ET0_INPUT:['historical_et0_estimate_v1','ESTIMATED','interval_end'],
    FUTURE_WEATHER_ASSUMPTION:['future_weather_assumption_v1','ASSUMED','issued_at'],
    FUTURE_ET0_ASSUMPTION:['future_et0_assumption_v1','ASSUMED','issued_at'],
  };
  for (const [role,[recordType,epistemic,eventField]] of Object.entries(expectedRoles)) {
    const p = auth.role_policy?.[role];
    req(p?.record_type === recordType && p?.epistemic_class === epistemic && p?.event_time_field === eventField, `EA3_ROLE_POLICY_DRIFT:${role}`);
  }

  for (const key of ['five_role_contract_coverage','same_input_same_semantic_hash','retention_precedes_decoder','retention_digest_mismatch_fails_before_decoder','future_or_event_time_after_runtime_availability_fails','epistemic_role_mismatch_fails','raw_binary_leak_fails','unsafe_debug_or_simulated_trust_surface_fails']) req(auth.qualification_required?.[key] === true, `EA3_QUALIFICATION_REQUIREMENT_WEAKENED:${key}`);
  req(auth.qualification_required.database_write_count === 0 && auth.qualification_required.formal_evidence_write_count === 0 && auth.qualification_required.public_provider_live_request_count === 0, 'EA3_QUALIFICATION_IO_COUNT_DRIFT');

  const preserved = auth.ea2_nonqualifications_preserved;
  req(preserved.external_evidence_package_formal_eligible === false && preserved.gfs_72h_full_value_pipeline_qualified === false && preserved.future_et0_72h_value_execution_qualified === false, 'EA3_EA2_FALSE_FACT_REWRITTEN');
  req(preserved.ea3_may_rewrite_ea1n_false_to_true === false && preserved.ea3_may_mark_package_formal_eligible === false, 'EA3_AUTHORITY_LAUNDERING_ENABLED');
  const effect = auth.authority_effect;
  req(effect.collector_canonicalizer_candidate_defined === true && effect.collector_runtime_activated === false && effect.live_source_qualified === false, 'EA3_EFFECT_ACTIVATION_DRIFT');
  req(effect.formal_ingress_eligible === false && effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA3_PREMATURE_FORMAL_OR_COMPLETION_EFFECT');

  for (const token of ['export interface ExternalEvidenceTransportPortV1','export interface RawEvidenceRetentionPortV1','export interface ExternalEvidenceDecoderPortV1','const receipt = await ports.retention.retainRawEvidence(retentionInput);','const decoded = await ports.decoder.decodeRetainedEvidence','EA3_RETENTION_DIGEST_MISMATCH','EA3_RETENTION_BYTE_COUNT_MISMATCH','EA3_RAW_RETENTION_PUBLICATION_FORBIDDEN','EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY','EA3_EPISTEMIC_CLASS_MISMATCH','EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN','EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN','semanticHashV1','canonical_payload_sha256','raw_retention_ref']) req(impl.includes(token), `EA3_IMPLEMENTATION_TOKEN_MISSING:${token}`);
  req(impl.indexOf('const receipt = await ports.retention.retainRawEvidence(retentionInput);') < impl.indexOf('const decoded = await ports.decoder.decodeRetainedEvidence'), 'EA3_DECODER_BEFORE_RETENTION_FORBIDDEN');
  req(!/\bfetch\s*\(/.test(impl), 'EA3_CONCRETE_FETCH_CALL_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bpg\b|psql\b|INSERT\s+INTO|public\.facts/i.test(impl), 'EA3_DATABASE_OR_PUBLIC_FACTS_WRITER_SURFACE_FORBIDDEN');
  req(!/process\.env|Date\.now\s*\(/.test(impl), 'EA3_ENV_OR_WALL_CLOCK_DEPENDENCY_FORBIDDEN');
  if (historicalCandidate) {
    req(!/new Date\s*\(\s*\)/.test(impl), 'EA3_HISTORICAL_WALL_CLOCK_DEPENDENCY_FORBIDDEN');
  } else {
    req((impl.match(/new Date\s*\(\s*\)/g) || []).length === 1, 'EA3_SUCCESSOR_EXACT_ONE_DEFAULT_COMPLETION_CLOCK_REQUIRED');
    req(impl.includes('completionClock: ExternalEvidenceCompletionClockV1 = () => new Date().toISOString()'), 'EA3_SUCCESSOR_INJECTABLE_COMPLETION_CLOCK_REQUIRED');
    req(impl.includes('canonicalIso(completionClock(), "EA3_COMPLETION_CLOCK_INVALID")'), 'EA3_SUCCESSOR_COMPLETION_CLOCK_VALIDATION_REQUIRED');
  }
  req(!/from\s+["'](?:node:)?(?:http|https|undici|pg)["']|require\(["'](?:node:)?(?:http|https|undici|pg)["']\)/.test(impl), 'EA3_NETWORK_OR_DATABASE_CLIENT_IMPORT_FORBIDDEN');

  for (const token of ['decoder_calls_after_retention_failure','EA3_DECODER_CALLED_AFTER_RETENTION_FAILURE','EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY','EA3_EPISTEMIC_CLASS_MISMATCH','EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN','EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN','public_provider_live_request_count: 0','database_write_count: 0','formal_evidence_write_count: 0']) req(acceptance.includes(token), `EA3_ACCEPTANCE_TOKEN_MISSING:${token}`);
  req(workflow.includes('persist-credentials: false') && workflow.includes('MCFT_BASE_SHA') && workflow.includes('MCFT_SUBJECT_SHA'), 'EA3_WORKFLOW_EXACT_SHA_OR_CREDENTIAL_BOUNDARY_DRIFT');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.cjs') && workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.ts'), 'EA3_WORKFLOW_GATE_OR_ACCEPTANCE_MISSING');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|GEOX_MCFT_CAP09_S6_DATABASE_URL/.test(workflow), 'EA3_WORKFLOW_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS', authority_blob: blob('HEAD',F.auth), implementation_blob: blob('HEAD',F.impl), runtime_acceptance_blob: blob('HEAD',F.acceptance),
    validation_mode: historicalCandidate ? 'EXACT_HISTORICAL_CANDIDATE' : 'SUCCESSOR_COLLECTOR_MAINTENANCE_REVALIDATION',
    historical_accepted_head_sha: ACCEPTED_HEAD,
    historical_authority_immutable: blob('HEAD', F.auth) === blob(ACCEPTED_HEAD, F.auth),
    historical_acceptance_immutable: blob('HEAD', F.acceptance) === blob(ACCEPTED_HEAD, F.acceptance),
    collector_canonicalizer_candidate_defined: true, live_source_qualified: false,
    gfs_72h_full_value_pipeline_qualified: false, future_et0_72h_value_execution_qualified: false,
    formal_ingress_eligible: false, ea4_candidate_development_authorized_after_effective_merge: true,
    public_provider_live_request_count: 0, database_write_count: 0, formal_evidence_write_count: 0,
    formal_window_started: false, mcft_cap09_completed: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
