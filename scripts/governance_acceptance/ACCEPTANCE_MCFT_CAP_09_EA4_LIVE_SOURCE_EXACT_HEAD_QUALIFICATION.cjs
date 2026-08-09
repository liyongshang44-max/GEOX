'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '08310e5f50bf5df7580b27fd35285f560320b9df';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  a1: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  ea1h: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1H-KBS-RAW-HOURLY-LIVE-PROBE-V1.json',
  ea1i: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json',
  ea1k: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json',
  ea1m: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json',
  ea1n: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json',
  ea1od: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-D-INSTANTANEOUS-SOLAR-LIVE-QUALIFICATION-V1.json',
  ea2a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json',
  source: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json',
  pkg: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json',
  ea3: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA3-EXTERNAL-COLLECTOR-CANONICALIZER-CANDIDATE-V1.json',
  auth: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json',
  probe: 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea4-live-source-exact-head-qualification.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  a1: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  ea1h: 'ea17427e2ac870664a2a9166761b907dfe807daa',
  ea1i: '47d41c48027e84285e934e7cda8af52fae6aa47d',
  ea1k: 'f36955b2847d1a2b58052f0dec2fea465e7eaec2',
  ea1m: 'bb487c0c6a91dd37b0409b5d446aec4707f7b0a4',
  ea1n: '607af693cd2f7d8d80e18d5308c16e128d397e44',
  ea1od: 'b5cf28809af89315966d1e02322a34fab14810cd',
  ea2a: '6c6e623ff96917d5ca6410d5fd5acc0f3372689c',
  source: '30b7910a1bd27882b80eb56041924d0f6252ae02',
  pkg: 'bca08b92c142be48b0b3ab82aff7d29a844d22c3',
  ea3: '0be64a250b75527d37d9cbb84fb2aa38a97b5208',
  auth: 'ec3ea3fb4218b854ec25adae7687884e5de92310',
  probe: 'cd32d74d54b543d42ae297d688764ddd129dd420',
};
const EXPECT = [F.auth, F.probe, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea4_live_source_exact_head_governance_result_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  public_raw_value_emission_count: 0, database_write_count: 0,
  formal_evidence_write_count: 0, formal_window_started: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA4_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA4_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  const predecessorKeys = ['task','a1','ea1h','ea1i','ea1k','ea1m','ea1n','ea1od','ea2a','source','pkg','ea3'];
  result.predecessor_blobs = {};
  for (const key of predecessorKeys) {
    const actual = blob(BASE, F[key]);
    result.predecessor_blobs[key] = actual;
    req(actual === PINS[key], `EA4_PREDECESSOR_BLOB_DRIFT:${key}:actual=${actual}:expected=${PINS[key]}`);
  }
  req(blob('HEAD',F.auth) === PINS.auth, `EA4_AUTHORITY_BLOB_DRIFT:${blob('HEAD',F.auth)}`);
  req(blob('HEAD',F.probe) === PINS.probe, `EA4_PROBE_BLOB_DRIFT:${blob('HEAD',F.probe)}`);

  const task = read(F.task), a1 = read(F.a1), auth = json(F.auth), source = json(F.source), pkg = json(F.pkg), ea3 = json(F.ea3), probe = read(F.probe), workflow = read(F.workflow);
  req(task.includes('S6-EA4 live source exact-head proof'), 'EA4_TASKBOOK_FRONTIER_CONTRACT_MISSING');
  req(task.includes('S6-EA5 fresh-scope Formal bootstrap and preflight'), 'EA4_TASKBOOK_SUCCESSOR_CONTRACT_MISSING');
  req(a1.includes('Runtime continues to\nconsume governed database Evidence only.') || a1.includes('Runtime continues to consume governed database Evidence only.'), 'EA4_RUNTIME_DATABASE_ONLY_BOUNDARY_MISSING');
  req(a1.includes('Fetch-transform-discard of the raw authority is forbidden.'), 'EA4_RAW_RETENTION_RULE_MISSING');

  req(pkg.formal_eligibility?.formal_eligible === false, 'EA4_EA2_PACKAGE_MUST_BEGIN_NOT_FORMAL_ELIGIBLE');
  req(pkg.required_evidence_families?.future_weather?.ea1n_full_72h_value_pipeline_qualified === false, 'EA4_EA1N_FALSE_PREDECESSOR_REQUIRED');
  req(pkg.required_evidence_families?.future_et0?.future_et0_executed === false, 'EA4_FUTURE_ET0_NOT_EXECUTED_PREDECESSOR_REQUIRED');
  req(source.authority_effect?.live_72h_full_value_pipeline_qualified === false && source.authority_effect?.formal_external_evidence_ingress_eligible === false, 'EA4_SOURCE_MATRIX_PREDECESSOR_FALSE_REQUIRED');
  req(ea3.authority_effect?.collector_canonicalizer_candidate_defined === true && ea3.authority_effect?.collector_runtime_activated === false, 'EA4_EA3_CANDIDATE_EFFECT_DRIFT');
  req(ea3.successor_boundary?.first_legal_successor_after_effective_ea3_merge === 'S6-EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION', 'EA4_EA3_SUCCESSOR_DRIFT');
  req(ea3.successor_boundary?.ea4_must_not_bypass_raw_retention_barrier === true, 'EA4_EA3_RETENTION_BARRIER_MISSING');

  req(auth.record_status === 'EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE', 'EA4_AUTHORITY_STATUS_DRIFT');
  req(auth.base_main_sha === BASE, 'EA4_AUTHORITY_BASE_DRIFT');
  for (const [key,entry] of Object.entries(auth.predecessor_authorities || {})) {
    const mapped = ({ amendment_01:'a1', ea2_source_matrix:'source', ea2_package:'pkg' })[key] || key;
    req(PINS[mapped] && entry.blob_sha === PINS[mapped], `EA4_AUTHORITY_PREDECESSOR_PIN_DRIFT:${key}`);
  }
  req(auth.decoder_environment.python === '3.12' && auth.decoder_environment.eccodes === '2.47.0' && auth.decoder_environment.eccodeslib === '2.47.3.23' && auth.decoder_environment.numpy === '1.26.4' && auth.decoder_environment.refet === '0.4.2', 'EA4_DECODER_STACK_AUTHORITY_DRIFT');
  req(auth.decoder_environment.refet_role === 'INDEPENDENT_ASCE_EWRI_2005_HOURLY_SHORT_REFERENCE_ET_QUALIFICATION_ORACLE_ONLY' && auth.decoder_environment.refet_runtime_dependency_authorized === false, 'EA4_REFET_ROLE_OVERCLAIM');

  req(auth.formal_scope.field_id === 'field_kbs_mcse_t1r1' && auth.formal_scope.zone_id === 'zone_kbs_mcse_t1r1_formal_v1', 'EA4_FORMAL_SCOPE_DRIFT');
  req(auth.kbs.soil_latest_max_age_minutes === 30 && auth.kbs.raw_hourly_latest_max_age_hours === 6, 'EA4_KBS_FRESHNESS_LIMIT_DRIFT');
  req(auth.kbs.minimum_recent_complete_hourly_et0_intervals === 24 && auth.kbs.minimum_recent_numeric_rain_hours === 24 && auth.kbs.raw_values_may_be_emitted === false, 'EA4_KBS_QUALIFICATION_LIMIT_DRIFT');
  req(auth.gfs.point_count === 72 && auth.gfs.solar_required_endpoint_count === 73 && auth.gfs.same_exact_cycle_required === true, 'EA4_GFS_POINT_OR_CYCLE_RULE_DRIFT');
  req(auth.gfs.apcp_method === 'APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE_WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE', 'EA4_APCP_METHOD_DRIFT');
  req(auth.gfs.solar_transformation === 'PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1' && auth.gfs.solar_quality === 'LIMITED', 'EA4_SOLAR_TRANSFORMATION_DRIFT');
  req(auth.gfs.future_file_waiting_forbidden === true && auth.gfs.cross_cycle_substitution_authorized === false && auth.gfs.negative_clipping_authorized === false && auth.gfs.zero_thresholding_authorized === false && auth.gfs.silent_imputation_authorized === false, 'EA4_GFS_FAIL_CLOSED_RULE_WEAKENED');

  const retention = auth.raw_retention_qualification;
  req(retention.class === 'RUNNER_PRIVATE_TRANSIENT_RETENTION_QUALIFICATION_ONLY_NOT_FORMAL_DURABLE_RETENTION', 'EA4_RETENTION_CLASS_DRIFT');
  req(retention.raw_bytes_must_be_written_before_decode === true && retention.per_object_sha256_receipt_required === true, 'EA4_RETENTION_PREDECODE_BARRIER_WEAKENED');
  req(retention.public_artifact_may_include_raw_bytes === false && retention.ea5_durable_private_retention_still_required === true, 'EA4_RETENTION_PUBLICATION_OR_EA5_BOUNDARY_WEAKENED');

  const qr = auth.qualification_requirements;
  for (const key of ['soil_live_and_continuous','rain_live_and_numeric','future_weather_exact_72_points','future_weather_temperature_rh_wind_precipitation_finite','future_weather_precipitation_nonnegative','future_solar_exact_73_endpoints','future_solar_72_derived_intervals','future_et0_exact_72_points','future_et0_all_finite','future_et0_negative_values_may_be_retained_as_asce_model_output','same_gfs_cycle_future_weather_and_future_et0','no_future_evidence_leakage']) req(qr[key] === true, `EA4_QUALIFICATION_REQUIREMENT_WEAKENED:${key}`);
  req(qr.historical_et0_complete_intervals_minimum === 24 && qr.public_raw_value_emission_count === 0 && qr.database_write_count === 0 && qr.formal_evidence_write_count === 0, 'EA4_QUALIFICATION_COUNT_DRIFT');

  req(auth.live_qualification.current_result === 'UNEXECUTED' && auth.live_qualification.final_head_must_reprove_frozen_pass === false, 'EA4_DISCOVERY_LIFECYCLE_DRIFT');
  const effect = auth.authority_effect;
  req(effect.live_source_qualified === false && effect.gfs_72h_full_value_pipeline_qualified === false && effect.future_et0_72h_value_execution_qualified === false, 'EA4_PREMATURE_PASS_EFFECT');
  req(effect.ea2_package_formal_eligible === false && effect.ea5_candidate_development_authorized === false, 'EA4_PREMATURE_SUCCESSOR_EFFECT');
  req(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA4_PREMATURE_FORMAL_EFFECT');

  for (const token of [
    'PRIVATE_ROOT = Path(tempfile.mkdtemp',
    'path.write_bytes(body)',
    'reread = path.read_bytes()',
    'EA4_RETENTION_DIGEST_MISMATCH',
    'retain_raw("KBS_SOIL_ENDPOINT25"',
    'retain_raw("KBS_RAW_HOURLY_13"',
    'retain_raw("GFS_PGRB2_FILTER_RESPONSE"',
    'retain_raw("GFS_SFLUX_IDX"',
    'retain_raw("GFS_SFLUX_EXACT_GRIB_MESSAGE"',
    'APCP_SECTION4_AMBIGUITY',
    'future_et0.append',
    'negative_clipping_performed":False',
    'ea2_package_formal_eligible":False',
    'ea5_candidate_development_authorized":True'
  ]) req(probe.includes(token), `EA4_PROBE_REQUIRED_TOKEN_MISSING:${token}`);
  req(probe.indexOf('retain_raw("KBS_SOIL_ENDPOINT25"') < probe.indexOf('payload=json.loads(soil_body.decode'), 'EA4_KBS_SOIL_DECODE_BEFORE_RETENTION');
  req(probe.indexOf('retain_raw("KBS_RAW_HOURLY_13"') < probe.indexOf('rows=parse_kbs_csv(csv_body)'), 'EA4_KBS_HOURLY_DECODE_BEFORE_RETENTION');
  req(probe.indexOf('receipt=retain_raw("GFS_PGRB2_FILTER_RESPONSE"') < probe.indexOf('return lead, decode_pgrb2(body, cycle, lead), receipt'), 'EA4_PGRB2_DECODE_BEFORE_RETENTION');
  req(probe.indexOf('receipt=retain_raw("GFS_SFLUX_EXACT_GRIB_MESSAGE"') < probe.indexOf('return lead, decode_sflux(message,cycle,lead), receipt'), 'EA4_SFLUX_DECODE_BEFORE_RETENTION');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|psql\b|INSERT\s+INTO|public\.facts/.test(probe), 'EA4_DATABASE_OR_PUBLIC_FACTS_WRITER_SURFACE_FORBIDDEN');
  req(!/raw_values_may_be_emitted\s*[:=]\s*(?:True|true)/.test(probe), 'EA4_RAW_VALUE_PUBLICATION_ENABLED');

  req(workflow.includes('persist-credentials: false'), 'EA4_WORKFLOW_PERSIST_CREDENTIALS_FORBIDDEN');
  for (const pin of ["eccodes==2.47.0","eccodeslib==2.47.3.23","numpy==1.26.4","refet==0.4.2"]) req(workflow.includes(pin), `EA4_WORKFLOW_DEPENDENCY_PIN_MISSING:${pin}`);
  req(workflow.includes('python -m eccodes selfcheck') && workflow.includes('python -m py_compile'), 'EA4_WORKFLOW_DECODER_OR_SYNTAX_SELFCHECK_MISSING');
  req(workflow.includes('MCFT_BASE_SHA') && workflow.includes('MCFT_SUBJECT_SHA'), 'EA4_WORKFLOW_EXACT_SHA_ENV_MISSING');
  req(workflow.includes('if: always()') && !workflow.includes('mcft-cap09-ea4-private-raw-'), 'EA4_WORKFLOW_RAW_SPOOL_UPLOAD_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|GEOX_MCFT_CAP09_S6_DATABASE_URL/.test(workflow), 'EA4_WORKFLOW_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS', authority_blob: blob('HEAD',F.auth), probe_blob: blob('HEAD',F.probe),
    live_qualification_required: true, discovery_unexecuted: true,
    ea2_package_formal_eligible: false, ea5_candidate_development_authorized: false,
    public_raw_value_emission_count: 0, database_write_count: 0,
    formal_evidence_write_count: 0, formal_window_started: false, mcft_cap09_completed: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
