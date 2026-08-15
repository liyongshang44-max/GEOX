#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const CROP_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json';
const SITE_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V2.json';
const REALITY_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V2.json';
const CONFIG_PATH = 'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json';
const OUTPUT = 'acceptance-output/MCFT_CAP_09_T3R1_FORMAL_SUCCESSOR_AUTHORITY_RESULT.json';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EXPECTED_GEOMETRY_HASH = 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a';

const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = (code, diagnostic = {}) => {
  const result = {
    schema_version: 'geox_mcft_cap09_t3r1_formal_successor_authority_result_v1',
    status: 'FAIL',
    authority_effect: 'NONE',
    runtime_scope_switched: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24',
    diagnostic,
    error: code,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exit(1);
};

function stageAt(ageDays, lengths) {
  if (!Array.isArray(lengths) || lengths.length !== 4) return null;
  const [a,b,c,d] = lengths;
  const b1 = a, b2 = a+b, b3 = a+b+c, b4 = a+b+c+d;
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return 'INITIAL';
  if (ageDays < b2) return 'DEVELOPMENT';
  if (ageDays < b3) return 'MID';
  return 'LATE';
}

function evaluateTarget(targetMs, crop) {
  const variants = crop.model_stage_prior?.variant_stage_lengths_days;
  const window = crop.planting_authority?.possible_event_window_utc;
  const policy = crop.as_of_derivation_policy;
  if (!Array.isArray(variants) || variants.length !== 6) fail('T3R1_SUCCESSOR_EXACT_SIX_VARIANTS_REQUIRED');
  if (policy?.backward_stability_hours !== 6 || policy?.forward_transition_guard_hours !== 30) fail('T3R1_SUCCESSOR_STAGE_GUARD_DRIFT');
  if (policy?.planting_time_uncertainty_must_be_carried !== true || policy?.future_observations_authorized !== false) fail('T3R1_SUCCESSOR_STAGE_POLICY_DRIFT');
  const start = Date.parse(window?.start_inclusive);
  const end = Date.parse(window?.end_exclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) fail('T3R1_SUCCESSOR_PLANTING_WINDOW_INVALID');
  const plantingTimes = [start, end - 1];
  const guardTimes = [targetMs - 6*HOUR, targetMs, targetMs + 30*HOUR];
  const stages = new Set();
  for (const variant of variants) {
    for (const plantingMs of plantingTimes) {
      for (const t of guardTimes) {
        const stage = stageAt((t - plantingMs) / DAY, variant);
        if (!stage) return { stage: null, stages: ['OUTSIDE_MODEL_WINDOW'] };
        stages.add(stage);
      }
    }
  }
  return { stage: stages.size === 1 ? [...stages][0] : null, stages: [...stages].sort() };
}

const site = load(SITE_PATH);
const reality = load(REALITY_PATH);
const crop = load(CROP_PATH);
const matrix = load(CONFIG_PATH);
const subject = String(process.env.MCFT_SUBJECT_SHA || '').trim();
if (!subject) fail('T3R1_SUCCESSOR_SUBJECT_SHA_REQUIRED');

if (site.site?.qualified_formal_site_id !== 'KBS_MCSE_T3R1') fail('T3R1_SUCCESSOR_SITE_ID_REQUIRED');
if (site.formal_scope_identity?.field_id !== 'field_kbs_mcse_t3r1' || site.formal_scope_identity?.zone_id !== 'zone_kbs_mcse_t3r1_crop_formal_v1') fail('T3R1_SUCCESSOR_SITE_SCOPE_REQUIRED');
if (site.geometry_authority?.semantic_hash !== EXPECTED_GEOMETRY_HASH) fail('T3R1_SUCCESSOR_GEOMETRY_HASH_REQUIRED');
if (site.geometry_authority?.whole_t3r1_plot_assumed_crop_only !== false || site.geometry_authority?.prairie_strip_excluded !== true) fail('T3R1_SUCCESSOR_CROP_ONLY_GEOMETRY_REQUIRED');
if (site.lifecycle_authority?.required_domain_state !== 'ACTIVE' || site.lifecycle_authority?.required_authority_status !== 'RESOLVED' || site.lifecycle_authority?.required_validity !== 'VALID') fail('T3R1_SUCCESSOR_LIFECYCLE_AUTHORITY_REQUIRED');
if (reality.scope?.field_id !== site.formal_scope_identity.field_id || reality.scope?.zone_id !== site.formal_scope_identity.zone_id) fail('T3R1_SUCCESSOR_REALITY_SCOPE_MISMATCH');
if (crop.scope?.field_id !== site.formal_scope_identity.field_id || crop.scope?.zone_id !== site.formal_scope_identity.zone_id) fail('T3R1_SUCCESSOR_CROP_SCOPE_MISMATCH');
if (crop.planting_authority?.observation_id !== 6966 || crop.planting_authority?.replicate_1_explicitly_included !== true || crop.planting_authority?.hybrid_product_code !== 'P0306Q') fail('T3R1_SUCCESSOR_PLANTING_IDENTITY_REQUIRED');

const source = matrix.configuration_source_definitions?.find((x) => x.configuration_source_id === 'mcft_crop_water_use_corn_v1');
if (!source || source.configuration_semantic_hash !== crop.crop_model_parameter_authority?.configuration_semantic_hash) fail('T3R1_SUCCESSOR_CROP_CONFIG_AUTHORITY_REQUIRED');
const kcSchedule = source.parameters?.kc_schedule?.value;
if (!Array.isArray(kcSchedule) || kcSchedule.length !== 4) fail('T3R1_SUCCESSOR_KC_SCHEDULE_REQUIRED');

const now = Date.now();
const firstTargetMs = Math.ceil(now / HOUR) * HOUR;
const first = evaluateTarget(firstTargetMs, crop);
if (!first.stage) fail('T3R1_SUCCESSOR_CURRENT_TARGET_STAGE_NOT_UNIQUE', { stages: first.stages });
const firstKcRow = kcSchedule.find((x) => x.stage_code === first.stage);
if (!firstKcRow || !Number.isFinite(firstKcRow.kc)) fail('T3R1_SUCCESSOR_CURRENT_TARGET_KC_NOT_UNIQUE');
if (first.stage !== 'MID' || firstKcRow.kc !== 1.15) fail('T3R1_SUCCESSOR_EXPECTED_MID_KC_REQUIRED', { stage: first.stage, kc: firstKcRow.kc });

let legalHours = 0;
let lastTargetMs = null;
let firstFailure = null;
for (let i = 0; i < 240; i += 1) {
  const targetMs = firstTargetMs + i * HOUR;
  const evaluated = evaluateTarget(targetMs, crop);
  const row = evaluated.stage ? kcSchedule.find((x) => x.stage_code === evaluated.stage) : null;
  if (evaluated.stage !== first.stage || !row || row.kc !== firstKcRow.kc) {
    firstFailure = { target_utc: new Date(targetMs).toISOString(), stages: evaluated.stages, stage: evaluated.stage, kc: row?.kc ?? null };
    break;
  }
  legalHours += 1;
  lastTargetMs = targetMs;
}
if (legalHours < 24) fail('T3R1_SUCCESSOR_MINIMUM_24H_LEGAL_WINDOW_REQUIRED', { legalHours, firstFailure });

const result = {
  schema_version: 'geox_mcft_cap09_t3r1_formal_successor_authority_result_v1',
  status: 'PASS',
  subject_sha: subject,
  authority_effect: 'SUCCESSOR_AUTHORITY_CANDIDATE_ONLY',
  candidate_scope: {
    site_id: site.site.qualified_formal_site_id,
    field_id: site.formal_scope_identity.field_id,
    season_id: site.formal_scope_identity.season_id,
    zone_id: site.formal_scope_identity.zone_id,
    crop: crop.scope.crop,
    hybrid_product_code: crop.scope.hybrid_product_code,
    planting_observation_id: crop.planting_authority.observation_id,
    planting_local_date: crop.planting_authority.planting_local_date,
    geometry_semantic_hash: site.geometry_authority.semantic_hash,
  },
  lifecycle_requirement: 'ACTIVE_RESOLVED_VALID_GOVERNED_PERSISTENT_STATE',
  derived_stage: first.stage,
  kc: firstKcRow.kc,
  configuration_source_id: source.configuration_source_id,
  configuration_semantic_hash: source.configuration_semantic_hash,
  first_legal_target_utc: new Date(firstTargetMs).toISOString(),
  last_contiguous_legal_target_utc: new Date(lastTargetMs).toISOString(),
  contiguous_legal_target_hours: legalHours,
  first_failure_after_window: firstFailure,
  exact_fao_variant_count: crop.model_stage_prior.variant_stage_lengths_days.length,
  planting_time_uncertainty_carried: true,
  backward_stability_hours: 6,
  forward_transition_guard_hours: 30,
  future_observations_used: false,
  runtime_scope_switched: false,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  scheduler_write_count: 0,
  ea5e2_operational_activation_qualified: false,
  formal_window_started: false,
  formal_execution_count: '0/24',
  next_frontier: 'T3R1_FORMAL_RUNTIME_SCOPE_REBIND'
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
