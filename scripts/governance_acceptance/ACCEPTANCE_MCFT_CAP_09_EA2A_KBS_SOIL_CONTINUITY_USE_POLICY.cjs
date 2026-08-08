'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'b378c836de78eb855cf5786a58786e573fc17d36';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const EA1E = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1E-KBS-TRANSIENT-ROLE-MAP-PROBE-V1.json';
const EA1OD = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-D-INSTANTANEOUS-SOLAR-LIVE-QUALIFICATION-V1.json';
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA2A_KBS_SOIL_CONTINUITY_USE_POLICY.mjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA2A_KBS_SOIL_CONTINUITY_USE_POLICY.cjs';
const WF = '.github/workflows/mcft-cap-09-ea2a-kbs-soil-continuity-use-policy.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA2A_KBS_SOIL_CONTINUITY_USE_POLICY_GOVERNANCE_RESULT.json');
const EXPECT = [AUTH, PROBE, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea2a_kbs_soil_continuity_use_policy_governance_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  formal_window_started: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA2A_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA2A_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === '39f6a09273c30088a7ea264cfa94ff930ea5518e', 'EA2A_TASKBOOK_BASE_BLOB_DRIFT');
  req(blob(BASE, A1) === '443edcfc6cbaafcd4b94f93d7002ab40442be8c9', 'EA2A_AMENDMENT01_BASE_BLOB_DRIFT');
  req(blob(BASE, EA1E) === '69835c9877474f4d46980487f6e5789add803df2', 'EA2A_EA1E_BASE_BLOB_DRIFT');
  req(blob(BASE, EA1OD) === 'b5cf28809af89315966d1e02322a34fab14810cd', 'EA2A_EA1OD_BASE_BLOB_DRIFT');

  const authority = JSON.parse(read(AUTH));
  const probe = read(PROBE);
  const workflow = read(WF);

  req(authority.record_status === 'EA2A_LIVE_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE' || authority.record_status === 'EA2A_LIVE_QUALIFICATION_PASS_CANDIDATE_NOT_EFFECTIVE', 'EA2A_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA2A_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_authorities.some(entry => entry.ref === A1 && entry.blob_sha === '443edcfc6cbaafcd4b94f93d7002ab40442be8c9'), 'EA2A_AUTHORITY_AMENDMENT01_PIN_DRIFT');
  req(authority.soil_source_candidate.endpoint_id === 25, 'EA2A_ENDPOINT_ID_DRIFT');
  req(authority.soil_source_candidate.role_id === 'SOIL_MOISTURE_10CM', 'EA2A_ROLE_DRIFT');
  req(authority.soil_source_candidate.epistemic_class === 'OBSERVED', 'EA2A_EPISTEMIC_CLASS_DRIFT');
  req(authority.soil_source_candidate.quantity_kind === 'VOLUMETRIC_WATER_CONTENT', 'EA2A_QUANTITY_DRIFT');
  req(authority.soil_source_candidate.measurement_depth_mm === 100, 'EA2A_DEPTH_DRIFT');
  req(authority.soil_source_candidate.direct_field_equivalence === false, 'EA2A_FIELD_EQUIVALENCE_FORBIDDEN');
  req(authority.soil_source_candidate.direct_root_zone_equivalence === false, 'EA2A_ROOT_ZONE_EQUIVALENCE_FORBIDDEN');

  const continuity = authority.continuity_policy;
  req(continuity.qualification_window_hours === 24, 'EA2A_WINDOW_HOURS_DRIFT');
  req(continuity.latest_source_max_age_minutes === 30, 'EA2A_LATEST_AGE_DRIFT');
  req(continuity.maximum_allowed_gap_minutes === 30, 'EA2A_MAX_GAP_DRIFT');
  req(continuity.minimum_distinct_hour_buckets === 24, 'EA2A_HOUR_BUCKET_DRIFT');
  req(continuity.minimum_window_span_minutes === 1430, 'EA2A_WINDOW_SPAN_DRIFT');
  req(continuity.every_point_in_window_must_be_finite === true && continuity.every_point_in_window_must_be_vwc_fraction_range_0_to_1 === true, 'EA2A_VALUE_RULE_WEAKENED');
  req(continuity.silent_imputation_authorized === false && continuity.gap_fill_authorized === false, 'EA2A_GAP_REPAIR_ENABLED');
  req(continuity.value_publication_authorized === false, 'EA2A_VALUE_PUBLICATION_ENABLED');

  const use = authority.use_policy;
  req(use.terms_url === 'https://lter.kbs.msu.edu/data/terms-of-use/', 'EA2A_TERMS_URL_DRIFT');
  req(use.public_raw_data_redistribution_authorized === false, 'EA2A_RAW_REDISTRIBUTION_ENABLED');
  req(use.publication_without_written_permission_authorized === false, 'EA2A_PUBLICATION_WITHOUT_PERMISSION_ENABLED');
  req(use.commercial_reuse_rights_established === false, 'EA2A_COMMERCIAL_RIGHTS_OVERCLAIM');
  req(use.private_stage1b_technical_processing_is_a_legal_opinion === false, 'EA2A_LEGAL_OPINION_OVERCLAIM');
  req(use.terms_live_reproof_required === true, 'EA2A_TERMS_REPROOF_REQUIRED');

  const raw = authority.raw_provenance_policy;
  req(raw.exact_raw_endpoint_payload_must_be_retained_or_referencably_archived_before_canonicalization === true, 'EA2A_RAW_RETENTION_WEAKENED');
  req(raw.public_probe_output_may_not_include.includes('soil_moisture_values'), 'EA2A_VALUE_NONPUBLIC_RULE_MISSING');
  req(raw.public_probe_output_may_not_include.includes('raw_json_body'), 'EA2A_RAW_BODY_NONPUBLIC_RULE_MISSING');

  const effect = authority.qualification_effect;
  req(effect.formal_site_authority_created === false && effect.formal_source_authority_created === false && effect.formal_external_evidence_package_created === false, 'EA2A_PREMATURE_FORMAL_AUTHORITY');
  req(effect.collector_authorized === false && effect.ea3_authorized === false, 'EA2A_PREMATURE_SUCCESSOR');
  req(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false, 'EA2A_WRITE_AUTHORITY_ENABLED');
  req(effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA2A_FORMAL_OR_COMPLETION_ENABLED');

  req(probe.includes('AUTH.soil_source_candidate.endpoint_url'), 'EA2A_PROBE_ENDPOINT_FROM_AUTHORITY_MISSING');
  req(probe.includes('maximum_allowed_gap_minutes'), 'EA2A_PROBE_GAP_RULE_MISSING');
  req(probe.includes('minimum_distinct_hour_buckets'), 'EA2A_PROBE_HOUR_BUCKET_RULE_MISSING');
  req(probe.includes('point.value < 0 || point.value > 1'), 'EA2A_PROBE_VWC_RANGE_RULE_MISSING');
  req(probe.includes('may not be published') && probe.includes('written permission'), 'EA2A_PROBE_TERMS_SEMANTICS_MISSING');
  req(probe.includes('raw_soil_values_emitted: false') && probe.includes('raw_json_body_emitted: false'), 'EA2A_PROBE_PRIVACY_ATTESTATION_MISSING');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(probe + '\n' + workflow), 'EA2A_DATABASE_PATH_PRESENT');
  req(workflow.includes('persist-credentials: false'), 'EA2A_PERSIST_CREDENTIALS_FORBIDDEN');

  Object.assign(result, {
    taskbook_blob: blob(BASE, TASK),
    amendment01_blob: blob(BASE, A1),
    ea1e_blob: blob(BASE, EA1E),
    ea1od_blob: blob(BASE, EA1OD),
    authority_blob: blob('HEAD', AUTH),
    probe_blob: blob('HEAD', PROBE),
    live_qualification_required: true,
    taskbook_changed: false,
    runtime_source_changed: false,
    status: 'PASS',
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
if (result.status === 'PASS') console.log(JSON.stringify(result));
else console.error(result.error);
