'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const TASKBOOK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const AMENDMENT01 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const EA1N = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json';
const AMENDMENT02 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY.md';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-SOLAR-RADIATION-AMENDMENT-STATUS-V1.json';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_SOLAR_RADIATION_AMENDMENT.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-ea1o-solar-radiation-amendment.yml';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_SOLAR_RADIATION_AMENDMENT_RESULT.json');
const EXPECTED = [TASKBOOK, AMENDMENT02, STATUS, GATE, WORKFLOW].sort();

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function requireTrue(value, code) { if (!value) throw new Error(code); }
function blobAt(ref, file) { return git(['rev-parse', `${ref}:${file}`]); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_solar_radiation_amendment_gate_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  runtime_contract_delta_count: 0,
  canonical_contract_delta_count: 0,
  migration_delta_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  future_et0_execution_count: 0,
  formal_window_started: false,
};

try {
  requireTrue(BASE, 'MCFT_BASE_SHA_REQUIRED');
  requireTrue(BASE === '2c47df7d08d507b0f31f084cb047d2bd69210f73', `BASE_MAIN_DRIFT:${BASE}`);

  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  requireTrue(JSON.stringify(changed) === JSON.stringify(EXPECTED), `EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  requireTrue(blobAt(BASE, TASKBOOK) === 'e427f64eaac3401130518defc046377088d00053', 'TASKBOOK_V02_BASE_BLOB_DRIFT');
  requireTrue(blobAt(BASE, AMENDMENT01) === '41270b888e15e4d9a6c9a34e1fa3f70e957a275e', 'AMENDMENT01_BASE_BLOB_DRIFT');
  requireTrue(blobAt(BASE, EA1N) === '607af693cd2f7d8d80e18d5308c16e128d397e44', 'EA1N_BASE_BLOB_DRIFT');

  const taskbook = read(TASKBOOK);
  const amendment = read(AMENDMENT02);
  const status = JSON.parse(read(STATUS));
  const workflow = read(WORKFLOW);

  requireTrue(taskbook.includes('Complete Taskbook v0.3 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 Bound'), 'TASKBOOK_V03_TITLE_MISSING');
  requireTrue(taskbook.includes('STAGE_1B_DESIGN_FROZEN_WITH_S6_AMENDMENT_01_AND_02'), 'TASKBOOK_V03_STATUS_MISSING');
  requireTrue(taskbook.includes('S6-EA1O  Solar-radiation source architecture amendment + source/spatial re-freeze'), 'TASKBOOK_EA1O_SEQUENCE_MISSING');
  requireTrue(taskbook.includes('pgrb2.0p25 remains the primary future-weather product family'), 'TASKBOOK_PGRB2_PRESERVATION_MISSING');
  requireTrue(taskbook.includes('only the future-ET0 solar-radiation input role may use the sflux exception'), 'TASKBOOK_EXCEPTION_SCOPE_MISSING');
  requireTrue(taskbook.includes('surface DSWRF "1 hour fcst" is not interchangeable with the one-hour average'), 'TASKBOOK_WRONG_RECORD_REJECTION_MISSING');
  requireTrue(taskbook.includes('future weather and future ET0 must still share the same exact GFS cycle'), 'TASKBOOK_SAME_CYCLE_INVARIANT_MISSING');
  requireTrue(taskbook.includes('Runtime remains forbidden from fetching public providers'), 'TASKBOOK_RUNTIME_FETCH_PROHIBITION_MISSING');

  requireTrue(amendment.includes('SOLAR_RADIATION_INPUT_ROLE_SOURCE_EXCEPTION_ONLY'), 'AMENDMENT_SCOPE_MARKER_MISSING');
  requireTrue(amendment.includes('ea1n_fail_close_blob:\n607af693cd2f7d8d80e18d5308c16e128d397e44'), 'AMENDMENT_EA1N_BINDING_MISSING');
  requireTrue(amendment.includes('candidate_product: gfs.tCCz.sfluxgrbfFFF.grib2'), 'AMENDMENT_SFLUX_CANDIDATE_MISSING');
  requireTrue(amendment.includes('required_statistical_semantics: DIRECT_PRECEDING_ONE_HOUR_AVERAGE'), 'AMENDMENT_HOURLY_AVERAGE_SEMANTICS_MISSING');
  requireTrue(amendment.includes('The separate `1 hour fcst` DSWRF record\nis not interchangeable'), 'AMENDMENT_WRONG_RECORD_EXCLUSION_MISSING');
  requireTrue(amendment.includes('same exact GFS\ncycle selected for the corresponding `future_weather_assumption_v1`'), 'AMENDMENT_SAME_CYCLE_RULE_MISSING');
  requireTrue(amendment.includes('sflux_spatial_authority: NOT_QUALIFIED'), 'AMENDMENT_SFLUX_SPATIAL_NOT_QUALIFIED_MISSING');
  requireTrue(amendment.includes('sflux_source_authority: NOT_QUALIFIED'), 'AMENDMENT_SFLUX_SOURCE_NOT_QUALIFIED_MISSING');
  requireTrue(amendment.includes('NO_SILENT_AMENDMENT_01_OVERRIDE'), 'AMENDMENT_HIERARCHY_GUARD_MISSING');
  requireTrue(amendment.includes('NO_RUNTIME_PROVIDER_FETCH'), 'AMENDMENT_RUNTIME_FETCH_GUARD_MISSING');
  requireTrue(amendment.includes('EA1O-B LIVE SFLUX SOURCE + SPATIAL QUALIFICATION'), 'AMENDMENT_NEXT_ACTION_MISSING');

  requireTrue(status.schema_version === 'geox_mcft_cap09_ea1o_solar_radiation_amendment_status_v1', 'STATUS_SCHEMA_DRIFT');
  requireTrue(status.record_status === 'ARCHITECTURE_AMENDMENT_CANDIDATE_NOT_EFFECTIVE', 'STATUS_EFFECTIVENESS_DRIFT');
  requireTrue(status.base_main_sha === BASE, 'STATUS_BASE_SHA_DRIFT');
  requireTrue(status.predecessor_authority.amendment_01_blob === '41270b888e15e4d9a6c9a34e1fa3f70e957a275e', 'STATUS_AMENDMENT01_BLOB_DRIFT');
  requireTrue(status.predecessor_authority.taskbook_v02_blob === 'e427f64eaac3401130518defc046377088d00053', 'STATUS_TASKBOOK_V02_BLOB_DRIFT');
  requireTrue(status.predecessor_authority.ea1n_blob === '607af693cd2f7d8d80e18d5308c16e128d397e44', 'STATUS_EA1N_BLOB_DRIFT');
  requireTrue(status.predecessor_authority.ea1n_merge_sha === BASE, 'STATUS_EA1N_MERGE_SHA_DRIFT');
  requireTrue(status.candidate_amendment.blob === blobAt('HEAD', AMENDMENT02), 'STATUS_AMENDMENT02_BLOB_DRIFT');
  requireTrue(status.candidate_amendment.taskbook_candidate_blob === blobAt('HEAD', TASKBOOK), 'STATUS_TASKBOOK_CANDIDATE_BLOB_DRIFT');

  const source = status.source_exception;
  requireTrue(source.scope === 'FUTURE_ET0_SOLAR_RADIATION_INPUT_ONLY', 'STATUS_SOURCE_EXCEPTION_SCOPE_DRIFT');
  requireTrue(source.provider === 'NOAA_NCEP' && source.model === 'GFS', 'STATUS_PROVIDER_MODEL_DRIFT');
  requireTrue(source.candidate_product === 'gfs.tCCz.sfluxgrbfFFF.grib2', 'STATUS_SFLUX_PRODUCT_DRIFT');
  requireTrue(source.candidate_parameter === 'DSWRF_SURFACE', 'STATUS_PARAMETER_DRIFT');
  requireTrue(source.required_statistical_semantics === 'DIRECT_PRECEDING_ONE_HOUR_AVERAGE', 'STATUS_STATISTICAL_SEMANTICS_DRIFT');
  requireTrue(source.static_inventory_record_fh001 === 87, 'STATUS_ELIGIBLE_INVENTORY_RECORD_DRIFT');
  requireTrue(source.forbidden_interchange_record_fh001 === 95, 'STATUS_FORBIDDEN_INVENTORY_RECORD_DRIFT');
  requireTrue(source.same_exact_gfs_cycle_required === true, 'STATUS_SAME_CYCLE_GUARD_DISABLED');
  requireTrue(source.pgrb2_primary_future_weather_preserved === true, 'STATUS_PGRB2_PRIMARY_AUTHORITY_NOT_PRESERVED');
  requireTrue(source.sflux_source_authority_qualified === false && source.sflux_spatial_authority_qualified === false, 'STATUS_PREMATURE_SFLUX_QUALIFICATION');
  requireTrue(source.direct_field_equivalence === false && source.interpolation_authorized === false, 'STATUS_SPATIAL_CLAIM_WEAKENED');

  const impact = status.contract_impact;
  requireTrue(impact.domain_model_delta === false, 'DOMAIN_MODEL_DELTA_ENABLED');
  requireTrue(impact.canonical_object_contract_delta === false, 'CANONICAL_CONTRACT_DELTA_ENABLED');
  requireTrue(impact.runtime_forcing_selector_delta === false, 'RUNTIME_SELECTOR_DELTA_ENABLED');
  requireTrue(impact.transaction_family_delta === false && impact.migration_delta === false, 'TRANSACTION_OR_MIGRATION_DELTA_ENABLED');
  requireTrue(impact.runtime_product_source_delta === false, 'RUNTIME_SOURCE_DELTA_ENABLED');

  const boundary = status.qualification_boundary;
  requireTrue(boundary.static_ncep_inventory_is_live_authority === false, 'STATIC_INVENTORY_PROMOTED_TO_LIVE_AUTHORITY');
  requireTrue(boundary.current_sflux_geometry_proven === false, 'CURRENT_GEOMETRY_PREMATURELY_PROVEN');
  requireTrue(boundary.current_sflux_72h_availability_proven === false, 'CURRENT_72H_AVAILABILITY_PREMATURELY_PROVEN');
  requireTrue(boundary.current_sflux_exact_record_uniqueness_proven === false, 'CURRENT_RECORD_UNIQUENESS_PREMATURELY_PROVEN');
  requireTrue(boundary.decoded_values_emitted === false, 'DECODED_VALUES_EMITTED');
  requireTrue(boundary.database_write_count === 0 && boundary.formal_evidence_write_count === 0 && boundary.canonical_evidence_write_count === 0, 'DATABASE_OR_EVIDENCE_WRITE_ENABLED');
  requireTrue(boundary.future_et0_execution_count === 0 && boundary.formal_window_started === false, 'ET0_EXECUTION_OR_FORMAL_WINDOW_ENABLED');

  requireTrue(status.effectiveness_condition === 'PRESENT_ON_PROTECTED_MAIN_UNDER_DELIVERY_POLICY', 'STATUS_EFFECTIVENESS_CONDITION_DRIFT');
  requireTrue(status.effective_claim_when_merged === 'S6_SOLAR_RADIATION_SOURCE_ARCHITECTURE_AMENDMENT_EFFECTIVE_ONLY', 'STATUS_EFFECTIVE_CLAIM_DRIFT');
  requireTrue(status.first_legal_successor_action_when_effective === 'EA1O_B_LIVE_SFLUX_SOURCE_AND_SPATIAL_QUALIFICATION', 'STATUS_NEXT_ACTION_DRIFT');
  requireTrue(status.mcft_cap09_completed === false, 'CAP09_COMPLETION_CLAIM_ENABLED');

  requireTrue(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA1O_SOLAR_RADIATION_AMENDMENT.cjs'), 'WORKFLOW_GATE_WIRING_MISSING');
  requireTrue(workflow.includes('persist-credentials: false'), 'WORKFLOW_CREDENTIAL_BOUNDARY_DRIFT');
  requireTrue(!/curl|wget|urlopen|requests\.|nomads\.ncep\.noaa\.gov/.test(workflow), 'AMENDMENT_WORKFLOW_PERFORMS_LIVE_PROVIDER_FETCH');

  result.amendment02_blob = blobAt('HEAD', AMENDMENT02);
  result.taskbook_v03_blob = blobAt('HEAD', TASKBOOK);
  result.ea1n_blob = blobAt(BASE, EA1N);
  result.source_exception = source.scope;
  result.candidate_product = source.candidate_product;
  result.live_source_authority_created = false;
  result.status = 'PASS';
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result));
else console.error(result.error);
