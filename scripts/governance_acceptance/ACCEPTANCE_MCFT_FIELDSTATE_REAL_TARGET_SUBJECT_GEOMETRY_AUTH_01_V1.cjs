#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const BASE = 'a56b419f6ddfc3ce2f2d957b0422bb8b4bd9d45c';
const CONTRACT = 'docs/digital_twin/mcft/field_state/GEOX-MCFT-FIELDSTATE-REAL-TARGET-SUBJECT-GEOMETRY-AUTH-01-CONTRACT-V1.json';
const PRIOR = 'docs/digital_twin/mcft/field_state/GEOX-MCFT-FIELDSTATE-TARGET-PARAM-AUTH-01-INVENTORY-V1.json';
const REALITY = 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json';
const ADJUDICATION = 'docs/digital_twin/mcft/GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md';
const SYNTH_GEOMETRY = 'fixtures/mcft/reality_binding/MCFT_C8_GOVERNED_ZONE_V1.geojson';
const ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_FIELDSTATE_REAL_TARGET_SUBJECT_GEOMETRY_AUTH_01_V1.cjs';
const WORKFLOW = '.github/workflows/mcft-fieldstate-real-target-subject-geometry-auth-01-v1.yml';
const EXPECTED_FILES = [WORKFLOW, CONTRACT, ACCEPTANCE].sort();

function fail(code, detail) {
  const e = new Error(detail ? `${code}:${detail}` : code);
  e.code = code;
  throw e;
}
function check(x, code, detail) { if (!x) fail(code, detail); }
function read(path) { return fs.readFileSync(path, 'utf8'); }
function readJson(path) { return JSON.parse(read(path)); }
function git(args) { return cp.execFileSync('git', args, {encoding:'utf8'}).trim(); }
function sameSet(a,b) { return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()); }
function pathGet(obj, dotted) {
  return dotted.split('.').reduce((v,k)=>v && Object.prototype.hasOwnProperty.call(v,k) ? v[k] : undefined, obj);
}
function present(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}
function parseInstant(v, code) {
  const ms = Date.parse(v);
  check(Number.isFinite(ms), code, v);
  return ms;
}
function reject(reasons, code) { if (!reasons.includes(code)) reasons.push(code); }

function evaluateCandidate(contract, candidate, logicalTime) {
  const reasons = [];
  const ec = contract.candidate_evaluation_contract;

  for (const p of ec.required_candidate_paths) {
    if (!present(pathGet(candidate, p))) reject(reasons, `MISSING_REQUIRED:${p}`);
  }

  const fieldId = pathGet(candidate,'subject.field_identity');
  const zoneId = pathGet(candidate,'subject.zone_identity');
  if (ec.synthetic_identity_rejections.field_identity.includes(fieldId)) reject(reasons,'SYNTHETIC_FIELD_RELABEL_FORBIDDEN');
  if (ec.synthetic_identity_rejections.zone_identity.includes(zoneId)) reject(reasons,'SYNTHETIC_ZONE_RELABEL_FORBIDDEN');

  for (const axis of ['field','zone','crop','season']) {
    const subjectKey = axis === 'field' ? 'field_identity' : axis === 'zone' ? 'zone_identity' : axis;
    if (pathGet(candidate,`applicability.${axis}`) !== pathGet(candidate,`subject.${subjectKey}`)) {
      reject(reasons, `APPLICABILITY_SUBJECT_MISMATCH:${axis}`);
    }
  }

  for (const gName of ['field_geometry','zone_geometry']) {
    const g = candidate[gName] || {};
    if (!ec.geometry_type_allowlist.includes(g.geometry_type)) reject(reasons, `GEOMETRY_TYPE_INVALID:${gName}`);
    if (g.asserted_object_class !== ec.required_asserted_object_classes[gName]) reject(reasons, `ASSERTED_OBJECT_CLASS_INVALID:${gName}`);
    if (ec.forbidden_derivation_methods.includes(g.measurement_survey_or_derivation_method)) {
      reject(reasons, `FORBIDDEN_GEOMETRY_DERIVATION:${gName}`);
    }
    if (!String(g.content_hash || '').startsWith('sha256:')) reject(reasons, `GEOMETRY_HASH_REQUIRED:${gName}`);
  }

  const fg = candidate.field_geometry || {};
  if (fg.source_object_class === 'LEGAL_PARCEL' && !present(fg.parcel_to_agronomic_field_mapping_authority_ref)) {
    reject(reasons,'LEGAL_PARCEL_NOT_AGRONOMIC_FIELD_WITHOUT_MAPPING_AUTHORITY');
  }
  const zg = candidate.zone_geometry || {};
  if (zg.source_object_class === 'AGRONOMIC_FIELD' && !present(zg.field_to_management_zone_derivation_authority_ref)) {
    reject(reasons,'AGRONOMIC_FIELD_NOT_MANAGEMENT_ZONE_WITHOUT_DERIVATION_AUTHORITY');
  }

  if (present(pathGet(candidate,'temporal.effective_from')) &&
      present(pathGet(candidate,'temporal.effective_until')) &&
      present(pathGet(candidate,'temporal.available_at'))) {
    const from = parseInstant(candidate.temporal.effective_from,'TEMPORAL_EFFECTIVE_FROM_INVALID');
    const until = parseInstant(candidate.temporal.effective_until,'TEMPORAL_EFFECTIVE_UNTIL_INVALID');
    const available = parseInstant(candidate.temporal.available_at,'TEMPORAL_AVAILABLE_AT_INVALID');
    check(from < until,'TEMPORAL_INTERVAL_INVALID');
    if (logicalTime) {
      const logical = parseInstant(logicalTime,'LOGICAL_TIME_INVALID');
      if (!(from <= logical && logical < until)) reject(reasons,'AUTHORITY_NOT_EFFECTIVE_AT_LOGICAL_TIME');
      if (available > logical) reject(reasons,'AUTHORITY_NOT_AVAILABLE_AT_LOGICAL_TIME');
    }
  }

  const refs = pathGet(candidate,'provenance.immutable_authority_refs_or_hashes');
  if (present(refs)) {
    const arr = Array.isArray(refs) ? refs : [refs];
    if (!arr.every(x => typeof x === 'string' && (x.startsWith('sha256:') || x.startsWith('git:') || x.startsWith('urn:')))) {
      reject(reasons,'IMMUTABLE_AUTHORITY_REF_FORMAT_INVALID');
    }
  }

  return {
    result: reasons.length === 0 ? 'QUALIFIED' : 'REJECTED',
    reasons
  };
}

function validateContract(contract) {
  check(contract.schema_version === 'geox_mcft_fieldstate_real_target_subject_geometry_auth_01_contract_v1','SCHEMA_VERSION_MISMATCH');
  check(contract.frontier_id === 'MCFT-FIELDSTATE-REAL-TARGET-SUBJECT-GEOMETRY-AUTH-01','FRONTIER_ID_MISMATCH');
  check(contract.phase === 'PHASE_A_ACQUISITION_CONTRACT_QUALIFICATION_SUBSTRATE','PHASE_A_REQUIRED');
  check(contract.authoritative_successor_base === BASE,'SUCCESSOR_BASE_MISMATCH');

  const a = contract.authorization;
  check(a.phase_a === 'AUTHORIZED','PHASE_A_AUTHORIZATION_MISSING');
  check(a.phase_b_real_world_source_acquisition === 'NOT_SOFTWARE_AUTHORIZED','PHASE_B_MUST_NOT_BE_SOFTWARE_AUTHORIZED');
  for (const k of ['runtime_implementation_change','twin_state_estimate_v1_change','soil_hydraulic_configuration_replacement','production_runtime','production_owner','A0']) {
    check(a[k] === 'NOT_AUTHORIZED',`AUTHORITY_CEILING_WIDENED:${k}`);
  }
  check(a.formal_v5 === 'NOT_ARMED' && a.O00_O23 === 'NOT_STARTED','FORMAL_OR_O00_CEILING_WIDENED');
  check(a.adr === 'UNTOUCHED' && a.b_line_semantics === 'UNTOUCHED','CROSS_LINE_CEILING_WIDENED');

  const ids = contract.authority_model.components.map(x=>x.authority_id);
  for (const id of [
    'REAL_TARGET_SUBJECT_IDENTITY_AUTHORITY','FIELD_GEOMETRY_AUTHORITY','ZONE_GEOMETRY_AUTHORITY',
    'FIELD_ZONE_MAPPING_AUTHORITY','AGRONOMIC_APPLICABILITY_BINDING'
  ]) check(ids.includes(id),`AUTHORITY_COMPONENT_MISSING:${id}`);
  check(contract.authority_model.object_taxonomy.LEGAL_PARCEL &&
        contract.authority_model.object_taxonomy.AGRONOMIC_FIELD &&
        contract.authority_model.object_taxonomy.MANAGEMENT_ZONE,'OBJECT_TAXONOMY_INCOMPLETE');

  const env = contract.authority_envelope;
  for (const f of ['real_target_subject_identity','field_identity','zone_identity','crop','season']) {
    check(env.required_subject_fields.includes(f),`SUBJECT_FIELD_MISSING:${f}`);
  }
  for (const f of [
    'field_geometry','zone_geometry','field_zone_relationship','geometry_coordinate_reference_system',
    'geometry_interpretation_semantics','geometry_object_class','geometry_method',
    'geometry_uncertainty_or_confidence','geometry_content_hash'
  ]) check(env.required_geometry_fields.includes(f),`GEOMETRY_FIELD_MISSING:${f}`);
  for (const f of ['effective_from','effective_until','available_at']) {
    check(env.required_temporal_fields.includes(f),`TEMPORAL_FIELD_MISSING:${f}`);
  }
  for (const f of ['source_provenance','source_authority_or_issuer','measurement_survey_or_derivation_method','immutable_authority_refs_or_hashes']) {
    check(env.required_provenance_fields.includes(f),`PROVENANCE_FIELD_MISSING:${f}`);
  }
  check(env.version_selection_rule.must_resolve_to === 'EXACTLY_ONE_APPLICABLE_AUTHORITY_OR_FAIL_CLOSED','TEMPORAL_VERSION_SELECTION_NOT_FAIL_CLOSED');
  check(env.version_selection_rule.current_polygon_only_storage === 'FORBIDDEN','CURRENT_POLYGON_ONLY_STORAGE_FORBIDDEN');

  const sa = contract.source_admissibility;
  check(sa.single_source_class_gate === 'FORBIDDEN','SINGLE_SOURCE_CLASS_GATE_FORBIDDEN');
  for (const d of ['COMPLETE_AUTHORITY_ENVELOPE','EXACT_TARGET_BINDING','PROVENANCE','TEMPORAL_VALIDITY','GEOMETRY_SEMANTICS']) {
    check(sa.decision_basis.includes(d),`SOURCE_DECISION_BASIS_MISSING:${d}`);
  }
  check(sa.source_label_alone_sufficient === false,'SOURCE_LABEL_MUST_NOT_BE_SUFFICIENT');
  check(sa.potential_source_classes.length >= 5,'SOURCE_CLASS_EXAMPLES_TOO_NARROW');

  const may = contract.mcft_authority_boundary.may;
  for (const x of ['validate','bind','version','hash','preserve provenance','qualify','fail closed']) {
    check(may.includes(x),`MCFT_ALLOWED_CAPABILITY_MISSING:${x}`);
  }
  const mayNot = contract.mcft_authority_boundary.may_not;
  for (const x of [
    'invent land ownership','invent legal parcel identity','invent customer organization ownership',
    'invent field boundary','invent zone boundary','invent crop or season facts',
    'invent field-zone relation','silently geocode missing geometry','silently extrapolate missing geometry'
  ]) check(mayNot.includes(x),`MCFT_FORBIDDEN_CAPABILITY_MISSING:${x}`);

  const shortcuts = new Map(contract.prohibited_shortcuts.map(x=>[x.reject_code,x.shortcut]));
  for (const code of [
    'SYNTHETIC_FIELD_RELABEL_FORBIDDEN','SYNTHETIC_ZONE_RELABEL_FORBIDDEN',
    'SENSOR_POINT_TO_FIELD_GEOMETRY_FORBIDDEN','SINGLE_POINT_GEOMETRY_FORBIDDEN',
    'AREA_ONLY_GEOMETRY_FORBIDDEN','DISPLAY_NAME_IDENTITY_FORBIDDEN',
    'SOIL_SAMPLE_MAPPING_FORBIDDEN','LAB_PLUS_SYNTHETIC_TARGET_PROMOTION_FORBIDDEN',
    'PARCEL_FIELD_EQUIVALENCE_FORBIDDEN','FIELD_ZONE_EQUIVALENCE_FORBIDDEN'
  ]) check(shortcuts.has(code),`PROHIBITED_SHORTCUT_MISSING:${code}`);

  const dg = contract.dependency_gate;
  check(dg.blocking_gap === 'GAP_REAL_TARGET_SUBJECT_GEOMETRY_AUTHORITY','BLOCKING_GAP_MISMATCH');
  for (const p of [
    'REAL_TARGET_SUBJECT_AUTHORITY_QUALIFIED','REAL_TARGET_FIELD_GEOMETRY_AUTHORITY_QUALIFIED',
    'REAL_TARGET_ZONE_GEOMETRY_AUTHORITY_QUALIFIED','FIELD_ZONE_MAPPING_QUALIFIED',
    'AGRONOMIC_APPLICABILITY_BINDING_QUALIFIED'
  ]) check(dg.required_before_target_parameter_frontiers.includes(p),`DEPENDENCY_PREREQUISITE_MISSING:${p}`);
  for (const g of [
    'GAP_ROOT_ZONE_DEPTH_TARGET_STAGE_AWARE','GAP_SOIL_WATER_RETENTION_TARGET_PROFILE',
    'GAP_DRAINAGE_TARGET_CHARACTERIZATION','GAP_RUNOFF_TARGET_CHARACTERIZATION'
  ]) check(dg.blocked_until_prerequisites_qualify.includes(g),`DOWNSTREAM_GAP_NOT_BLOCKED:${g}`);
  check(dg.soil_lab_report_bypass === 'FORBIDDEN','SOIL_LAB_DEPENDENCY_BYPASS_FORBIDDEN');

  const cs = contract.controlled_synthetic_world;
  check(cs.status === 'PRESERVED' && cs.scope_class === 'CONTROLLED_SYNTHETIC_REPLAY_PROXY','SYNTHETIC_WORLD_NOT_PRESERVED');
  check(cs.field_id === 'field_c8_demo' && cs.zone_id === 'zone_mcft_c8_water_001','SYNTHETIC_SCOPE_CHANGED');
  check(cs.must_not_be_promoted_to_real_target === true,'SYNTHETIC_PROMOTION_GUARD_MISSING');

  const audit = contract.bounded_repository_audit;
  check(audit.existing_real_target_source_candidate === 'NOT_DISCOVERED_IN_BOUNDED_REPOSITORY_AUDIT','REAL_TARGET_SOURCE_CANDIDATE_PROMOTED_OR_UNRESOLVED');
  check(audit.promotion_performed === false,'SOURCE_PROMOTION_FORBIDDEN_IN_PHASE_A');

  const t = contract.terminal_state;
  check(t.acquisition_contract === 'READY_FOR_MACHINE_QUALIFICATION','CONTRACT_TERMINAL_DECLARATION_INVALID');
  check(t.software_qualification_substrate === 'READY','SOFTWARE_SUBSTRATE_NOT_READY');
  for (const k of [
    'real_target_subject_authority','real_target_field_geometry_authority','real_target_zone_geometry_authority',
    'field_zone_mapping_authority','agronomic_applicability_binding'
  ]) check(t[k] === 'ABSENT',`REAL_AUTHORITY_MUST_REMAIN_ABSENT:${k}`);
  check(t.real_world_source === 'NOT_YET_ACQUIRED' &&
        t.real_world_source_acquisition === 'REQUIRED' &&
        t.next_owner === 'REAL_WORLD_DATA_OR_FIELD_ONBOARDING','REAL_WORLD_ACQUISITION_TERMINAL_STATE_INVALID');

  const ec = contract.candidate_evaluation_contract;
  check(ec.mode === 'READ_ONLY_FAIL_CLOSED','CANDIDATE_EVALUATION_MUST_BE_READ_ONLY_FAIL_CLOSED');
  check(ec.source_class_rule.includes('MUST NOT bypass envelope checks'),'SOURCE_CLASS_BYPASS_GUARD_MISSING');
}

function validateInheritedEvidence(contract, prior, reality, adjudication, geometry) {
  check(prior.frontier_id === 'MCFT-FIELDSTATE-TARGET-PARAM-AUTH-01','PRIOR_FRONTIER_MISMATCH');
  check(prior.inventory_result.real_target_subject_authority === 'ABSENT','PRIOR_REAL_TARGET_SUBJECT_AUTHORITY_CHANGED');
  check(prior.inventory_result.real_target_geometry_authority === 'ABSENT','PRIOR_REAL_TARGET_GEOMETRY_AUTHORITY_CHANGED');
  check(prior.inventory_result.real_target_source === 'NOT_YET_ACQUIRED','PRIOR_REAL_TARGET_SOURCE_CHANGED');
  check(prior.source_acquisition_order[0] === 'GAP_REAL_TARGET_SUBJECT_GEOMETRY_AUTHORITY','PRIOR_DEPENDENCY_ORDER_CHANGED');

  check(reality.semantic_payload.reality_scope_class === 'CONTROLLED_SYNTHETIC_REPLAY_PROXY','REALITY_SCOPE_PROMOTED');
  check(reality.semantic_payload.reality_classification.geometry_truth_status === 'CONTROLLED_SYNTHETIC','REALITY_GEOMETRY_PROMOTED');
  check(reality.semantic_payload.reality_classification.real_field_pilot_status === 'NOT_CLAIMED','REAL_FIELD_PILOT_PROMOTED');
  check(reality.semantic_payload.geometry_binding.geometry_source === 'MCFT_00_PINNED_FIXTURE','SYNTHETIC_GEOMETRY_SOURCE_CHANGED');
  check(reality.semantic_payload.limitations.includes('geometry not surveyed'),'GEOMETRY_NOT_SURVEYED_LIMITATION_MISSING');

  check(geometry.properties.geometry_truth_status === 'CONTROLLED_SYNTHETIC','SYNTHETIC_GEOJSON_PROMOTED');
  check(geometry.properties.geometry_source === 'MCFT_00_PINNED_FIXTURE','SYNTHETIC_GEOJSON_SOURCE_CHANGED');

  for (const text of [
    '`field_c8_demo` | C8 builder and demo SQL both contain stable ID | PROVEN | field identity | geometry, area, State, or live-field truth',
    'legacy C8 polygons | demo SQL and builder contain different polygon/area expressions | REJECTED',
    'new MCFT governed zone | dedicated checked-in GeoJSON and canonicalization contract | PROVEN | only MCFT-00 geometry authority | surveyed/field-verified claim'
  ]) check(adjudication.includes(text),`CANDIDATE_ADJUDICATION_GUARD_MISSING:${text.slice(0,32)}`);

  check(contract.bounded_repository_audit.examined_refs.every(p=>fs.existsSync(p)), 'BOUNDED_AUDIT_REF_MISSING');
}

function negativeSelfTests(contract) {
  const base = {
    subject:{real_target_subject_identity:'synthetic_selftest_subject',field_identity:'field_real_candidate',zone_identity:'zone_real_candidate',crop:'corn',season:'season_real_candidate'},
    field_geometry:{
      geometry:{type:'Polygon',coordinates:[[[0,0],[0,1],[1,1],[0,0]]]},
      geometry_type:'Polygon',coordinate_reference_system:'EPSG:4326',interpretation_semantics:'SELFTEST_ONLY',
      source_object_class:'AGRONOMIC_FIELD',asserted_object_class:'AGRONOMIC_FIELD',
      measurement_survey_or_derivation_method:'SURVEYED_GEOMETRY',uncertainty_or_confidence:'SELFTEST',content_hash:'sha256:'+'1'.repeat(64)
    },
    zone_geometry:{
      geometry:{type:'Polygon',coordinates:[[[0,0],[0,.5],[.5,.5],[0,0]]]},
      geometry_type:'Polygon',coordinate_reference_system:'EPSG:4326',interpretation_semantics:'SELFTEST_ONLY',
      source_object_class:'MANAGEMENT_ZONE',asserted_object_class:'MANAGEMENT_ZONE',
      measurement_survey_or_derivation_method:'MANAGEMENT_ZONE_PRESCRIPTION',uncertainty_or_confidence:'SELFTEST',content_hash:'sha256:'+'2'.repeat(64)
    },
    field_zone_mapping:{
      relationship:'FIELD_CONTAINS_ZONE',source_provenance:'SELFTEST_ONLY',source_authority_or_issuer:'SELFTEST_ONLY',
      measurement_survey_or_derivation_method:'SELFTEST_MAPPING',uncertainty_or_confidence:'SELFTEST',
      immutable_authority_ref_or_hash:'sha256:'+'3'.repeat(64)
    },
    applicability:{field:'field_real_candidate',zone:'zone_real_candidate',crop:'corn',season:'season_real_candidate'},
    temporal:{effective_from:'2026-01-01T00:00:00Z',effective_until:'2027-01-01T00:00:00Z',available_at:'2026-01-01T00:00:00Z'},
    provenance:{source_provenance:'SELFTEST_ONLY',source_authority_or_issuer:'SELFTEST_ONLY',immutable_authority_refs_or_hashes:['sha256:'+'4'.repeat(64)]},
    governance:{supersession_semantics:'SELFTEST_ONLY',uncertainty_or_confidence:'SELFTEST'}
  };

  // Structural evaluator selftest only; never persisted or promoted as a real-world authority artifact.
  const good = evaluateCandidate(contract, base, '2026-06-01T00:00:00Z');
  check(good.result === 'QUALIFIED','QUALIFICATION_EVALUATOR_STRUCTURAL_SELFTEST_FAILED');

  const demoField = structuredClone(base); demoField.subject.field_identity='field_c8_demo'; demoField.applicability.field='field_c8_demo';
  check(evaluateCandidate(contract,demoField,'2026-06-01T00:00:00Z').reasons.includes('SYNTHETIC_FIELD_RELABEL_FORBIDDEN'),'DEMO_FIELD_RELABEL_NEGATIVE_SELFTEST_FAILED');

  const demoZone = structuredClone(base); demoZone.subject.zone_identity='zone_mcft_c8_water_001'; demoZone.applicability.zone='zone_mcft_c8_water_001';
  check(evaluateCandidate(contract,demoZone,'2026-06-01T00:00:00Z').reasons.includes('SYNTHETIC_ZONE_RELABEL_FORBIDDEN'),'DEMO_ZONE_RELABEL_NEGATIVE_SELFTEST_FAILED');

  const sensor = structuredClone(base); sensor.field_geometry.measurement_survey_or_derivation_method='SENSOR_COORDINATE_INFERENCE';
  check(evaluateCandidate(contract,sensor,'2026-06-01T00:00:00Z').reasons.some(x=>x.startsWith('FORBIDDEN_GEOMETRY_DERIVATION')),'SENSOR_COORDINATE_NEGATIVE_SELFTEST_FAILED');

  const parcel = structuredClone(base); parcel.field_geometry.source_object_class='LEGAL_PARCEL';
  check(evaluateCandidate(contract,parcel,'2026-06-01T00:00:00Z').reasons.includes('LEGAL_PARCEL_NOT_AGRONOMIC_FIELD_WITHOUT_MAPPING_AUTHORITY'),'PARCEL_FIELD_NEGATIVE_SELFTEST_FAILED');

  const fieldAsZone = structuredClone(base); fieldAsZone.zone_geometry.source_object_class='AGRONOMIC_FIELD';
  check(evaluateCandidate(contract,fieldAsZone,'2026-06-01T00:00:00Z').reasons.includes('AGRONOMIC_FIELD_NOT_MANAGEMENT_ZONE_WITHOUT_DERIVATION_AUTHORITY'),'FIELD_ZONE_NEGATIVE_SELFTEST_FAILED');

  const late = structuredClone(base); late.temporal.available_at='2026-07-01T00:00:00Z';
  check(evaluateCandidate(contract,late,'2026-06-01T00:00:00Z').reasons.includes('AUTHORITY_NOT_AVAILABLE_AT_LOGICAL_TIME'),'AVAILABLE_AT_NEGATIVE_SELFTEST_FAILED');
}

function main() {
  const liveMain = git(['rev-parse','origin/main']);
  check(liveMain === BASE,'PROTECTED_MAIN_DRIFT',liveMain);
  const head = git(['rev-parse','HEAD']);
  const changed = git(['diff','--name-only',`${BASE}...${head}`]).split(/\r?\n/).filter(Boolean).sort();
  check(sameSet(changed,EXPECTED_FILES),'CHANGED_FILE_BOUNDARY_MISMATCH',JSON.stringify(changed));
  for (const p of changed) {
    check(!p.startsWith('apps/'),'RUNTIME_OR_PRODUCT_WRITE_FORBIDDEN',p);
    check(!p.startsWith('packages/'),'RUNTIME_OR_PRODUCT_WRITE_FORBIDDEN',p);
    check(!p.startsWith('docker/'),'RUNTIME_OR_PRODUCT_WRITE_FORBIDDEN',p);
    check(!p.startsWith('migrations/'),'RUNTIME_OR_PRODUCT_WRITE_FORBIDDEN',p);
    check(!p.toLowerCase().includes('adr'),'ADR_WRITE_FORBIDDEN',p);
    check(!p.toLowerCase().includes('bline') && !p.toLowerCase().includes('b-line'),'BLINE_WRITE_FORBIDDEN',p);
  }

  const contract = readJson(CONTRACT);
  const prior = readJson(PRIOR);
  const reality = readJson(REALITY);
  const adjudication = read(ADJUDICATION);
  const geometry = readJson(SYNTH_GEOMETRY);

  validateContract(contract);
  validateInheritedEvidence(contract,prior,reality,adjudication,geometry);
  negativeSelfTests(contract);

  const candidateArg = process.argv.indexOf('--candidate');
  if (candidateArg >= 0) {
    const candidatePath = process.argv[candidateArg+1];
    check(candidatePath,'CANDIDATE_PATH_REQUIRED');
    const candidate = readJson(candidatePath);
    const logicalIdx = process.argv.indexOf('--logical-time');
    const logicalTime = logicalIdx >= 0 ? process.argv[logicalIdx+1] : null;
    const result = evaluateCandidate(contract,candidate,logicalTime);
    console.log(JSON.stringify({
      frontier:contract.frontier_id,
      mode:'EXTERNAL_CANDIDATE_READ_ONLY_ADJUDICATION',
      candidate_path:candidatePath,
      logical_time:logicalTime,
      ...result
    },null,2));
    process.exit(result.result === 'QUALIFIED' ? 0 : 2);
  }

  console.log(JSON.stringify({
    frontier:contract.frontier_id,
    phase:'PHASE_A',
    acquisition_contract:'QUALIFIED',
    software_qualification_substrate:'READY',
    real_target_subject_authority:'ABSENT',
    real_target_field_geometry_authority:'ABSENT',
    real_target_zone_geometry_authority:'ABSENT',
    field_zone_mapping_authority:'ABSENT',
    agronomic_applicability_binding:'ABSENT',
    real_world_source:'NOT_YET_ACQUIRED',
    real_world_source_acquisition:'REQUIRED',
    existing_real_target_source_candidate:'NOT_DISCOVERED_IN_BOUNDED_REPOSITORY_AUDIT',
    next_owner:'REAL_WORLD_DATA_OR_FIELD_ONBOARDING',
    runtime_product_writes:0,
    phase_b_facts_manufactured:false,
    protected_main:liveMain,
    candidate_head:head,
    changed_files:changed
  },null,2));
}

main();
