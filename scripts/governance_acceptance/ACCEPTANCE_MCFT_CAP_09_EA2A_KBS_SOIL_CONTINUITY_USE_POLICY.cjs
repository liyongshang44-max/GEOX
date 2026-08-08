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

const result = {schema_version:'geox_mcft_cap09_ea2a_kbs_soil_continuity_use_policy_governance_result_v1',status:'FAIL',base_sha:BASE,exact_file_count:0,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false};

try {
  req(BASE === EXPECTED_BASE, `EA2A_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff','--name-only',`${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed; result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA2A_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  const pins = {
    task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
    a1: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
    ea1e: '69835c9877474f4d46980487f6e5789add803df2',
    ea1od: 'b5cf28809af89315966d1e02322a34fab14810cd',
  };
  const actual = {task:blob(BASE,TASK),a1:blob(BASE,A1),ea1e:blob(BASE,EA1E),ea1od:blob(BASE,EA1OD)};
  result.actual_predecessor_blobs = actual;
  req(actual.task === pins.task, `EA2A_TASKBOOK_BASE_BLOB_DRIFT:actual=${actual.task}:expected=${pins.task}`);
  req(actual.a1 === pins.a1, `EA2A_AMENDMENT01_BASE_BLOB_DRIFT:actual=${actual.a1}:expected=${pins.a1}`);
  req(actual.ea1e === pins.ea1e, `EA2A_EA1E_BASE_BLOB_DRIFT:actual=${actual.ea1e}:expected=${pins.ea1e}`);
  req(actual.ea1od === pins.ea1od, `EA2A_EA1OD_BASE_BLOB_DRIFT:actual=${actual.ea1od}:expected=${pins.ea1od}`);

  const authority = JSON.parse(read(AUTH)); const probe = read(PROBE); const workflow = read(WF);
  req(['EA2A_LIVE_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE','EA2A_LIVE_QUALIFICATION_PASS_CANDIDATE_NOT_EFFECTIVE'].includes(authority.record_status), 'EA2A_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA2A_AUTHORITY_BASE_DRIFT');
  for (const [ref,pin,code] of [[A1,pins.a1,'A1'],[EA1E,pins.ea1e,'EA1E'],[EA1OD,pins.ea1od,'EA1OD']]) req(authority.predecessor_authorities.some(e=>e.ref===ref&&e.blob_sha===pin), `EA2A_AUTHORITY_${code}_PIN_DRIFT`);

  const soil = authority.soil_source_candidate;
  req(soil.endpoint_id===25 && soil.role_id==='SOIL_MOISTURE_10CM', 'EA2A_SOIL_ROLE_DRIFT');
  req(soil.epistemic_class==='OBSERVED' && soil.quantity_kind==='VOLUMETRIC_WATER_CONTENT' && soil.measurement_depth_mm===100, 'EA2A_SOIL_SEMANTICS_DRIFT');
  req(soil.direct_field_equivalence===false && soil.direct_root_zone_equivalence===false, 'EA2A_EQUIVALENCE_FORBIDDEN');

  const c = authority.continuity_policy;
  req(c.qualification_window_hours===24 && c.latest_source_max_age_minutes===30 && c.maximum_allowed_gap_minutes===30, 'EA2A_CONTINUITY_LIMIT_DRIFT');
  req(c.minimum_distinct_hour_buckets===24 && c.minimum_window_span_minutes===1430, 'EA2A_CONTINUITY_COVERAGE_DRIFT');
  req(c.every_point_in_window_must_be_finite===true && c.every_point_in_window_must_be_vwc_fraction_range_0_to_1===true, 'EA2A_VALUE_RULE_WEAKENED');
  req(c.silent_imputation_authorized===false && c.gap_fill_authorized===false && c.value_publication_authorized===false, 'EA2A_REPAIR_OR_PUBLICATION_ENABLED');

  const use = authority.use_policy;
  req(use.terms_url==='https://lter.kbs.msu.edu/data/terms-of-use/' && use.terms_live_reproof_required===true, 'EA2A_TERMS_BOUNDARY_DRIFT');
  req(use.public_raw_data_redistribution_authorized===false && use.publication_without_written_permission_authorized===false && use.commercial_reuse_rights_established===false && use.private_stage1b_technical_processing_is_a_legal_opinion===false, 'EA2A_USE_RIGHTS_OVERCLAIM');

  const raw = authority.raw_provenance_policy;
  req(raw.exact_raw_endpoint_payload_must_be_retained_or_referencably_archived_before_canonicalization===true, 'EA2A_RAW_RETENTION_WEAKENED');
  req(raw.public_probe_output_may_not_include.includes('soil_moisture_values') && raw.public_probe_output_may_not_include.includes('raw_json_body'), 'EA2A_PUBLIC_RAW_BOUNDARY_MISSING');

  const effect = authority.qualification_effect;
  req(effect.formal_site_authority_created===false && effect.formal_source_authority_created===false && effect.formal_external_evidence_package_created===false, 'EA2A_PREMATURE_FORMAL_AUTHORITY');
  req(effect.collector_authorized===false && effect.ea3_authorized===false && effect.database_write_authorized===false && effect.formal_evidence_write_authorized===false, 'EA2A_PREMATURE_SUCCESSOR_OR_WRITE');
  req(effect.formal_window_started===false && effect.mcft_cap09_completed===false, 'EA2A_FORMAL_OR_COMPLETION_ENABLED');

  req(probe.includes('AUTH.soil_source_candidate.endpoint_url'), 'EA2A_PROBE_ENDPOINT_FROM_AUTHORITY_MISSING');
  req(probe.includes('maximum_allowed_gap_minutes') && probe.includes('minimum_distinct_hour_buckets'), 'EA2A_PROBE_CONTINUITY_RULE_MISSING');
  req(probe.includes('point.value < 0 || point.value > 1'), 'EA2A_PROBE_VWC_RANGE_RULE_MISSING');
  req(probe.includes('may not be published') && probe.includes('written permission'), 'EA2A_PROBE_TERMS_SEMANTICS_MISSING');
  req(probe.includes('raw_soil_values_emitted: false') && probe.includes('raw_json_body_emitted: false'), 'EA2A_PROBE_PRIVACY_ATTESTATION_MISSING');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(probe+'\n'+workflow), 'EA2A_DATABASE_PATH_PRESENT');
  req(workflow.includes('persist-credentials: false'), 'EA2A_PERSIST_CREDENTIALS_FORBIDDEN');

  Object.assign(result,{taskbook_blob:actual.task,amendment01_blob:actual.a1,ea1e_blob:actual.ea1e,ea1od_blob:actual.ea1od,authority_blob:blob('HEAD',AUTH),probe_blob:blob('HEAD',PROBE),live_qualification_required:true,taskbook_changed:false,runtime_source_changed:false,status:'PASS'});
} catch (error) { result.error = `${error.name||'Error'}:${error.message||String(error)}`; process.exitCode=1; }
fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
if(result.status==='PASS') console.log(JSON.stringify(result)); else console.error(result.error);
