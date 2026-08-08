'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'dd1d2e73afd4d6c707235f07b639a7cb11a899c9';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const A4 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md';
const EA1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const EA1SRC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SOURCE-QUALIFICATION-MATRIX-V1.json';
const EA1H = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1H-KBS-RAW-HOURLY-LIVE-PROBE-V1.json';
const EA1I = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json';
const EA1J = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json';
const EA1K = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const EA1L = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json';
const EA1M = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json';
const EA1N = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json';
const EA1OD = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-D-INSTANTANEOUS-SOLAR-LIVE-QUALIFICATION-V1.json';
const EA2A = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json';
const MODEL = 'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json';

const SITE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json';
const REALITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json';
const SOURCE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json';
const CROP = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json';
const PACKAGE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA2_FORMAL_AUTHORITY_FREEZE.cjs';
const WF = '.github/workflows/mcft-cap-09-ea2-formal-authority-freeze.yml';
const EXPECT = [SITE, REALITY, SOURCE, CROP, PACKAGE, GATE, WF].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA2_FORMAL_AUTHORITY_FREEZE_RESULT.json');

const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  a1: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  a4: '3cce5cb3f070404a2b7474ef61a009d87c7f809f',
  ea1: 'a4329330cfae941a033d65f55e91b8ae8e96d862',
  ea1src: 'c6a2394bc0d97ad2df159a8af95c7e1997ba9aed',
  ea1h: 'ea17427e2ac870664a2a9166761b907dfe807daa',
  ea1i: '47d41c48027e84285e934e7cda8af52fae6aa47d',
  ea1j: 'eeb7ab49ee3270421efe4d6674305426074d1541',
  ea1k: 'f36955b2847d1a2b58052f0dec2fea465e7eaec2',
  ea1l: 'af5f23425e35dd21a949727f508934f1be14d8e9',
  ea1m: 'bb487c0c6a91dd37b0409b5d446aec4707f7b0a4',
  ea1n: '607af693cd2f7d8d80e18d5308c16e128d397e44',
  ea1od: 'b5cf28809af89315966d1e02322a34fab14810cd',
  ea2a: '6c6e623ff96917d5ca6410d5fd5acc0f3372689c',
  model: 'c04c6805ab79c715781b99f8fbcf997fae3a8c48',
};
const NEW_BLOBS = {
  site: '926265e46073c86cfcf711eba49a829517bf6edb',
  reality: '8462233b755a9447bc15260c8b250c1c85d82d82',
  source: '4e65c12bb59a99ec76283988fc251e82f1d19b9b',
  crop: '6bd9de80643229ac7782c883823583630916d66a',
};

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));
const req = (value, code) => { if (!value) throw new Error(code); };
const iso = ms => new Date(ms).toISOString();

function stageForElapsedHours(hours, lengths) {
  const [initial, development, mid, late] = lengths.map(days => days * 24);
  if (hours < 0) return 'BEFORE_PLANTING';
  if (hours < initial) return 'INITIAL';
  if (hours < initial + development) return 'DEVELOPMENT';
  if (hours < initial + development + mid) return 'MID';
  if (hours < initial + development + mid + late) return 'LATE';
  return 'AFTER_FROZEN_STAGE_PRIOR';
}

function rederiveCropContext(authorityTimeMs) {
  const plantingStart = Date.parse('2026-05-11T04:00:00.000Z');
  const plantingEndExclusive = Date.parse('2026-05-12T04:00:00.000Z');
  const windowStart = authorityTimeMs - 6 * 3600_000;
  const windowEnd = authorityTimeMs + 30 * 3600_000;
  const minElapsedHours = (windowStart - plantingEndExclusive) / 3600_000;
  const maxElapsedHours = (windowEnd - plantingStart) / 3600_000;
  const variants = [
    [30,50,60,40], [25,40,45,30], [20,35,40,30],
    [20,35,40,30], [30,40,50,30], [30,40,50,50],
  ];
  const stages = [];
  let minimumHoursToNextBoundary = Infinity;
  for (const lengths of variants) {
    const atMin = stageForElapsedHours(minElapsedHours, lengths);
    const atMax = stageForElapsedHours(maxElapsedHours, lengths);
    req(atMin === atMax, `EA2_CROP_STAGE_TRANSITION_RISK:${atMin}:${atMax}`);
    stages.push(atMin);
    const [i,d,m] = lengths;
    const nextMidBoundaryHours = (i + d + m) * 24;
    if (atMin === 'MID') minimumHoursToNextBoundary = Math.min(minimumHoursToNextBoundary, nextMidBoundaryHours - maxElapsedHours);
  }
  req(new Set(stages).size === 1, `EA2_CROP_STAGE_NO_CONSERVATIVE_CONSENSUS:${stages.join(',')}`);
  req(stages[0] === 'MID', `EA2_CROP_STAGE_NOT_MID_AT_FREEZE:${stages[0]}`);
  req(minimumHoursToNextBoundary >= 0, 'EA2_CROP_STAGE_GUARD_NEGATIVE');
  return { authority_time_utc: iso(authorityTimeMs), derived_stage_code: stages[0], minimum_hours_to_next_model_stage_boundary: Number(minimumHoursToNextBoundary.toFixed(3)), guarded_elapsed_min_hours: Number(minElapsedHours.toFixed(3)), guarded_elapsed_max_hours: Number(maxElapsedHours.toFixed(3)) };
}

const result = { schema_version:'geox_mcft_cap09_ea2_formal_authority_freeze_result_v1', status:'FAIL', applicability:'APPLICABLE', base_sha:BASE, formal_eligible:false, database_write_count:0, formal_evidence_write_count:0, formal_window_started:false };

try {
  const changed = git(['diff','--name-only',`${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  const ownedChanged = changed.filter(file => EXPECT.includes(file));
  if (ownedChanged.length === 0) {
    Object.assign(result,{status:'PASS',applicability:'NOT_APPLICABLE_NO_EA2_OWNED_FILE_CHANGE',changed_files:changed});
  } else {
    req(BASE === EXPECTED_BASE, `EA2_BASE_MAIN_DRIFT:${BASE}`);
    req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA2_EXACT_SEVEN_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
    result.changed_files = changed; result.exact_file_count = changed.length;

    const predecessorFiles = { task:TASK, a1:A1, a4:A4, ea1:EA1, ea1src:EA1SRC, ea1h:EA1H, ea1i:EA1I, ea1j:EA1J, ea1k:EA1K, ea1l:EA1L, ea1m:EA1M, ea1n:EA1N, ea1od:EA1OD, ea2a:EA2A, model:MODEL };
    result.predecessor_blobs = {};
    for (const [key,file] of Object.entries(predecessorFiles)) {
      const actual = blob(BASE,file); result.predecessor_blobs[key] = actual;
      req(actual === PINS[key], `EA2_PREDECESSOR_BLOB_DRIFT:${key}:actual=${actual}:expected=${PINS[key]}`);
    }
    for (const [key,file] of Object.entries({site:SITE,reality:REALITY,source:SOURCE,crop:CROP})) req(blob('HEAD',file) === NEW_BLOBS[key], `EA2_NEW_AUTHORITY_BLOB_DRIFT:${key}`);

    const task = read(TASK); const amendment = read(A1);
    req(task.includes('S6-EA2 External Formal authorities frozen'), 'EA2_TASKBOOK_FRONTIER_CONTRACT_MISSING');
    req(task.includes('S6-EA3 collector/canonicalizer qualification'), 'EA2_TASKBOOK_SUCCESSOR_CONTRACT_MISSING');
    for (const requiredAuthorityFile of [
      'GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json',
      'GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json',
      'GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json',
      'GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json',
      'GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json',
    ]) req(amendment.includes(requiredAuthorityFile), `EA2_AMENDMENT_SUPPORTING_AUTHORITY_MISSING:${requiredAuthorityFile}`);
    req(amendment.includes('No partial package may start the Formal window.'), 'EA2_AMENDMENT_NO_PARTIAL_PACKAGE_RULE_MISSING');

    const site = json(SITE); const reality = json(REALITY); const source = json(SOURCE); const crop = json(CROP); const pkg = json(PACKAGE);

    req(site.record_status === 'EA2_FORMAL_SITE_AUTHORITY_WHEN_PRESENT_ON_PROTECTED_MAIN', 'EA2_SITE_STATUS_DRIFT');
    req(site.site.qualified_formal_site_id === 'KBS_MCSE_T1R1' && site.site.qualification === 'QUALIFIED_FORMAL_SITE', 'EA2_SITE_ID_OR_QUALIFICATION_DRIFT');
    req(site.formal_scope_identity.field_id === 'field_kbs_mcse_t1r1' && site.formal_scope_identity.field_c8_demo_reused === false && site.formal_scope_identity.cross_scope_canonical_stitching_authorized === false, 'EA2_SITE_SCOPE_FRESH_BOOTSTRAP_DRIFT');
    req(site.spatial_limitations.soil_direct_field_equivalence === false && site.spatial_limitations.soil_direct_root_zone_equivalence === false && site.spatial_limitations.soil_root_zone_representativeness === 'PARTIAL', 'EA2_SITE_SOIL_LIMITATION_WEAKENED');
    req(site.use_policy_boundary.public_raw_data_redistribution_authorized === false && site.use_policy_boundary.publication_without_written_permission_authorized === false && site.use_policy_boundary.commercial_reuse_rights_established === false, 'EA2_SITE_USE_RIGHTS_OVERCLAIM');
    req(Object.values(site.qualification_gates).every(v => typeof v === 'string' && v.startsWith('PASS')), 'EA2_SITE_GATE_NOT_PASS');
    req(site.authority_effect.formal_ingress_eligible === false && site.authority_effect.database_write_authorized === false && site.authority_effect.formal_evidence_write_authorized === false, 'EA2_SITE_PREMATURE_INGRESS_OR_WRITE');

    req(reality.reality_class === 'EXTERNAL_PUBLIC_RESEARCH_SCOPE', 'EA2_REALITY_CLASS_DRIFT');
    req(reality.scope.field_id === site.formal_scope_identity.field_id && reality.scope.zone_id === site.formal_scope_identity.zone_id, 'EA2_REALITY_SCOPE_MISMATCH');
    req(reality.scope_origin.cap08_kernel_semantic_authority_reused === true && reality.scope_origin.cap08_replay_scope_identity_reused === false && reality.scope_origin.field_c8_demo_reused === false && reality.scope_origin.cross_scope_canonical_stitching_authorized === false, 'EA2_REALITY_REPLAY_IDENTITY_LEAK');
    req(reality.model_configuration_prior.authority_class === 'MODEL_PRIOR_FROM_CAP08' && reality.model_configuration_prior.field_calibrated === undefined && reality.model_configuration_prior.synthetic_schedule_dates_authorized_as_crop_context === false, 'EA2_REALITY_MODEL_PRIOR_CLASS_DRIFT');
    req(reality.model_configuration_prior.source_blob_sha === PINS.model && reality.model_configuration_prior.source_determinism_hash === 'sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5', 'EA2_REALITY_MODEL_PRIOR_PIN_DRIFT');
    req(reality.bootstrap_contract.database_bootstrap_authorized_in_ea2 === false && reality.bootstrap_contract.collector_or_canonicalizer_activation_authorized_in_ea2 === false && reality.bootstrap_contract.formal_o00_o23_start_authorized === false, 'EA2_REALITY_PREMATURE_BOOTSTRAP');

    req(source.record_status === 'EA2_FORMAL_SOURCE_BINDING_MATRIX_WHEN_PRESENT_ON_PROTECTED_MAIN', 'EA2_SOURCE_STATUS_DRIFT');
    req(source.amendment_04_blob_sha === PINS.a4 && source.predecessor_blobs.ea1n === PINS.ea1n && source.predecessor_blobs.ea1od === PINS.ea1od && source.predecessor_blobs.ea2a === PINS.ea2a, 'EA2_SOURCE_PREDECESSOR_PIN_DRIFT');
    const roles = new Map(source.source_bindings.map(entry => [entry.role, entry]));
    for (const role of ['SOIL_MOISTURE','OBSERVED_RAINFALL','HISTORICAL_REFERENCE_ET','FUTURE_WEATHER','FUTURE_REFERENCE_ET']) req(roles.has(role), `EA2_SOURCE_ROLE_MISSING:${role}`);
    const soil = roles.get('SOIL_MOISTURE'); req(soil.epistemic_class === 'OBSERVED' && soil.measurement_depth_mm === 100 && soil.direct_field_equivalence === false && soil.direct_root_zone_equivalence === false, 'EA2_SOURCE_SOIL_SEMANTICS_DRIFT');
    const fw = roles.get('FUTURE_WEATHER');
    req(fw.canonical_point_count === 72 && fw.direct_field_equivalence === false && fw.full_72h_decoded_normalized_value_pipeline_qualified === false && fw.formal_ingress_eligible === false, 'EA2_FUTURE_WEATHER_FALSE_PRESERVATION_FAIL');
    const precip = fw.variables.precipitation_mm;
    req(precip.temporal_method_id === 'APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE_WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE', 'EA2_APCP_METHOD_DRIFT');
    req(precip.block_start_formula === 'S=6*floor((lead-1)/6)' && precip.cross_block_difference_authorized === false && precip.first_record_wins_authorized === false && precip.negative_clipping_authorized === false, 'EA2_APCP_FAIL_CLOSED_RULE_DRIFT');
    req(precip.semantic_duplicate_collapse_rule.includes('IDENTICAL_SECTION4_SHA256') && precip.semantic_duplicate_collapse_rule.includes('IDENTICAL_FLOAT_VALUE') && precip.semantic_duplicate_collapse_rule.includes('IDENTICAL_UNITS'), 'EA2_APCP_SEMANTIC_DUPLICATE_RULE_WEAKENED');
    const fet = roles.get('FUTURE_REFERENCE_ET');
    req(fet.same_cycle_as_future_weather_required === true && fet.future_et0_execution_status === 'NOT_EXECUTED_IN_EA1O_D' && fet.future_et0_execution_authorized_in_ea2 === false && fet.formal_ingress_eligible === false, 'EA2_FUTURE_ET0_OVERCLAIM');
    req(fet.meteorological_inputs.solar_radiation.epistemic_class === 'MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION' && fet.meteorological_inputs.solar_radiation.quality_status === 'LIMITED' && fet.meteorological_inputs.solar_radiation.direct_field_equivalence === false, 'EA2_SOLAR_LIMITATION_DRIFT');
    req(source.explicit_predecessor_nonqualifications_preserved.ea1n_gfs_72h_value_pipeline_qualified === false && source.authority_effect.live_72h_full_value_pipeline_qualified === false && source.authority_effect.formal_external_evidence_ingress_eligible === false, 'EA2_EA1N_FALSE_REWRITTEN');

    req(crop.record_status === 'EA2_FORMAL_CROP_CONTEXT_AUTHORITY_WHEN_PRESENT_ON_PROTECTED_MAIN', 'EA2_CROP_STATUS_DRIFT');
    req(crop.scope.site_id === 'KBS_MCSE_T1R1' && crop.scope.crop === 'corn' && crop.scope.observed_biological_stage_claimed === false, 'EA2_CROP_SCOPE_DRIFT');
    req(crop.predecessor_exact_head_proof.subject_sha === 'b030758fc926aa632e3996ea24152fc7f4879359' && crop.predecessor_exact_head_proof.workflow_run_id === 31250643714 && crop.predecessor_exact_head_proof.artifact_id === 9019894277, 'EA2_CROP_PREDECESSOR_PROOF_DRIFT');
    req(crop.ea2_freeze_rule.ea2_exact_head_gate_must_rederive_stage_from_frozen_inputs_at_runner_utc === true && crop.ea2_freeze_rule.formal_startup_must_rederive_as_of_fresh_boundary === true, 'EA2_CROP_REPROOF_RULE_DRIFT');
    result.crop_context_reproof = rederiveCropContext(Date.now());

    req(pkg.record_status === 'EA2_FORMAL_EXTERNAL_EVIDENCE_PACKAGE_FREEZE_WHEN_PRESENT_ON_PROTECTED_MAIN', 'EA2_PACKAGE_STATUS_DRIFT');
    const expectedRefs = {site_authority:[SITE,NEW_BLOBS.site],reality_binding:[REALITY,NEW_BLOBS.reality],crop_context:[CROP,NEW_BLOBS.crop],source_bindings:[SOURCE,NEW_BLOBS.source]};
    for (const [key,[ref,sha]] of Object.entries(expectedRefs)) req(pkg.supporting_authorities[key].ref === ref && pkg.supporting_authorities[key].blob_sha === sha, `EA2_PACKAGE_SUPPORT_REF_DRIFT:${key}`);
    req(pkg.supporting_authorities.model_prior.ref === MODEL && pkg.supporting_authorities.model_prior.blob_sha === PINS.model && pkg.supporting_authorities.model_prior.authority_class === 'MODEL_PRIOR_FROM_CAP08', 'EA2_PACKAGE_MODEL_PRIOR_DRIFT');
    req(pkg.formal_scope.field_id === site.formal_scope_identity.field_id && pkg.formal_scope.zone_id === site.formal_scope_identity.zone_id && pkg.formal_scope.replay_scope_identity_reused === false, 'EA2_PACKAGE_SCOPE_DRIFT');
    req(pkg.required_evidence_families.future_weather.ea1n_full_72h_value_pipeline_qualified === false && pkg.required_evidence_families.future_et0.future_et0_executed === false, 'EA2_PACKAGE_FALSE_PRESERVATION_FAIL');
    req(pkg.formal_eligibility.formal_eligible === false && pkg.formal_eligibility.package_status === 'EA2_AUTHORITY_PACKAGE_FROZEN_NOT_QUALIFIED_FOR_FORMAL_INGRESS', 'EA2_PACKAGE_PREMATURE_FORMAL_ELIGIBILITY');
    for (const blocker of ['EA3_EXTERNAL_COLLECTOR_AND_CANONICALIZER_NOT_IMPLEMENTED_OR_QUALIFIED','EA4_LIVE_SOURCE_EXACT_HEAD_FULL_VALUE_PIPELINE_NOT_QUALIFIED','EA4_72H_FUTURE_ET0_VALUE_EXECUTION_NOT_QUALIFIED','EA5_FORMAL_AUTHORITY_V3_AND_DATABASE_PREFLIGHT_NOT_EFFECTIVE']) req(pkg.formal_eligibility.blocking_conditions.includes(blocker), `EA2_PACKAGE_BLOCKER_MISSING:${blocker}`);
    req(pkg.formal_eligibility.ea1n_false_may_be_rewritten_true_by_ea2 === false && pkg.formal_eligibility.ea1od_solar_pass_is_sufficient_for_full_future_et0 === false, 'EA2_PACKAGE_AUTHORITY_LAUNDERING');
    req(pkg.successor_authority.first_legal_successor_after_effective_ea2_merge === 'S6-EA3_EXTERNAL_COLLECTOR_AND_CANONICALIZER_CANDIDATE' && pkg.successor_authority.ea3_candidate_development_authorized === true && pkg.successor_authority.collector_runtime_activation_authorized === false, 'EA2_SUCCESSOR_BOUNDARY_DRIFT');
    req(pkg.successor_authority.database_write_authorized === false && pkg.successor_authority.formal_evidence_write_authorized === false && pkg.successor_authority.formal_o00_o23_start_authorized === false, 'EA2_PACKAGE_WRITE_OR_FORMAL_START_ENABLED');

    const all = [read(SITE),read(REALITY),read(SOURCE),read(CROP),read(PACKAGE),read(WF)].join('\n');
    req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|psql\b|INSERT\s+INTO|public\.facts/i.test(all), 'EA2_DATABASE_OR_FORMAL_WRITE_PATH_PRESENT');
    req(!/field_c8_demo\"\s*:\s*true|replay_scope_identity_reused\"\s*:\s*true|cross_scope_canonical_stitching_authorized\"\s*:\s*true/i.test(all), 'EA2_REPLAY_OR_STITCHING_AUTHORIZED');

    Object.assign(result,{status:'PASS',applicability:'APPLICABLE_EXACT_EA2_BOUNDARY',authority_blobs:{site:blob('HEAD',SITE),reality:blob('HEAD',REALITY),source:blob('HEAD',SOURCE),crop:blob('HEAD',CROP),package:blob('HEAD',PACKAGE)},formal_eligible:false,ea3_candidate_development_authorized:true,collector_runtime_activation_authorized:false,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false,mcft_cap09_completed:false});
  }
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}
fs.mkdirSync(path.dirname(OUT), { recursive:true });
fs.writeFileSync(OUT, JSON.stringify(result,null,2)+'\n');
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
