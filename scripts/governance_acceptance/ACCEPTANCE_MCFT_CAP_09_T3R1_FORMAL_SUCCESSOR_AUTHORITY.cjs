#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXPECTED_BASE = '6081a363a665b7882bbca7592213ee49395872d7';
const FILES = [
  '.github/workflows/mcft-cap-09-t3r1-formal-successor-authority.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V2.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V2.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_FORMAL_SUCCESSOR_AUTHORITY.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_FORMAL_SUCCESSOR_AUTHORITY.mjs',
].sort();
const OUT = 'acceptance-output/MCFT_CAP_09_T3R1_FORMAL_SUCCESSOR_AUTHORITY_GOVERNANCE_RESULT.json';
const PINS = {
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json': 'eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json': 'dedc8db6e2e3c902066ed94b0d3322a69775b7b6',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json': 'b5de9d29189cb654444b3f57d00df290eefe16d3',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json': '073247dd9527246e423beedcccba832162ad0ff9',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json': '87b1c8fa37939085be68abb66bfa8e0918f65e95',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json': '30b7910a1bd27882b80eb56041924d0f6252ae02',
  'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json': 'c04c6805ab79c715781b99f8fbcf997fae3a8c48',
  'apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts': 'f7ea03a7f8387ce4de135dac61f0b063e91f0f25',
};
const sitePath = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V2.json';
const realityPath = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V2.json';
const cropPath = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify(value));
}

try {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  const subject = String(process.env.MCFT_SUBJECT_SHA || '').trim();
  const head = git('rev-parse', 'HEAD');
  assert.equal(base, EXPECTED_BASE, 'T3R1_SUCCESSOR_EXACT_BASE_REQUIRED');
  assert.equal(subject, head, 'T3R1_SUCCESSOR_EXACT_HEAD_REQUIRED');
  assert.equal(git('merge-base', base, head), base, 'T3R1_SUCCESSOR_BASE_NOT_ANCESTOR');
  const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'T3R1_SUCCESSOR_EXACT_SEVEN_FILE_BOUNDARY_REQUIRED');

  for (const [file, sha] of Object.entries(PINS)) {
    assert.equal(git('rev-parse', `HEAD:${file}`), sha, `T3R1_SUCCESSOR_PREDECESSOR_MUTATED:${file}`);
  }

  const amendment = fs.readFileSync(FILES.find((x) => x.includes('AMENDMENT-17')), 'utf8');
  for (const marker of [
    'KBS_MCSE_T3R1',
    'field_kbs_mcse_t3r1',
    'zone_kbs_mcse_t3r1_crop_formal_v1',
    'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a',
    'Cross-scope canonical stitching is forbidden',
    'active runtime remains T1R1',
  ]) assert(amendment.includes(marker), `T3R1_SUCCESSOR_AMENDMENT_MARKER_REQUIRED:${marker}`);

  const site = load(sitePath);
  const reality = load(realityPath);
  const crop = load(cropPath);
  assert.equal(site.site.qualified_formal_site_id, 'KBS_MCSE_T3R1');
  assert.equal(site.site.provider_treatment_code, 'T3');
  assert.equal(site.site.replicate, 'R1');
  assert.equal(site.formal_scope_identity.field_id, 'field_kbs_mcse_t3r1');
  assert.equal(site.formal_scope_identity.season_id, 'season_2026_corn');
  assert.equal(site.formal_scope_identity.zone_id, 'zone_kbs_mcse_t3r1_crop_formal_v1');
  assert.equal(site.formal_scope_identity.fresh_bootstrap_required, true);
  assert.equal(site.formal_scope_identity.t1r1_canonical_state_reused, false);
  assert.equal(site.formal_scope_identity.cross_scope_canonical_stitching_authorized, false);
  assert.equal(site.geometry_authority.semantic_hash, 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a');
  assert.equal(site.geometry_authority.whole_t3r1_plot_assumed_crop_only, false);
  assert.equal(site.geometry_authority.prairie_strip_excluded, true);
  assert.equal(site.lifecycle_authority.required_domain_state, 'ACTIVE');
  assert.equal(site.lifecycle_authority.required_authority_status, 'RESOLVED');
  assert.equal(site.lifecycle_authority.required_validity, 'VALID');
  assert.equal(site.activation_boundary.active_runtime_scope_changed_by_this_file, false);
  assert.equal(site.activation_boundary.ea5e2_operational_activation_authorized, false);

  assert.equal(reality.represented_site_id, site.site.qualified_formal_site_id);
  assert.deepEqual(reality.scope, {
    tenant_id: 'tenant_mcft_external',
    project_id: 'project_mcft_cap09',
    group_id: 'group_public_research',
    field_id: 'field_kbs_mcse_t3r1',
    season_id: 'season_2026_corn',
    zone_id: 'zone_kbs_mcse_t3r1_crop_formal_v1',
  });
  assert.equal(reality.scope_origin.t1r1_canonical_state_reused, false);
  assert.equal(reality.scope_origin.cross_scope_canonical_stitching_authorized, false);
  assert.equal(reality.reality_boundaries.field_equivalence_claimed, false);
  assert.equal(reality.reality_boundaries.root_zone_observation_equivalence_claimed, false);
  assert.equal(reality.reality_boundaries.model_grid_observation_truth_claimed, false);
  assert.equal(reality.activation_boundary.active_runtime_scope_changed, false);

  assert.equal(crop.scope.site_id, 'KBS_MCSE_T3R1');
  assert.equal(crop.scope.field_id, 'field_kbs_mcse_t3r1');
  assert.equal(crop.scope.zone_id, 'zone_kbs_mcse_t3r1_crop_formal_v1');
  assert.equal(crop.scope.hybrid_product_code, 'P0306Q');
  assert.equal(crop.planting_authority.observation_id, 6966);
  assert.equal(crop.planting_authority.replicate_1_explicitly_included, true);
  assert.equal(crop.planting_authority.planting_local_date, '2026-05-20');
  assert.deepEqual(crop.model_stage_prior.variant_stage_lengths_days, [[30,50,60,40],[25,40,45,30],[20,35,40,30],[20,35,40,30],[30,40,50,30],[30,40,50,50]]);
  assert.equal(crop.as_of_derivation_policy.backward_stability_hours, 6);
  assert.equal(crop.as_of_derivation_policy.forward_transition_guard_hours, 30);
  assert.equal(crop.as_of_derivation_policy.planting_time_uncertainty_must_be_carried, true);
  assert.equal(crop.as_of_derivation_policy.future_observations_authorized, false);
  assert.equal(crop.crop_model_parameter_authority.required_parameter, 'Kc');
  assert.equal(crop.crop_model_parameter_authority.configuration_source_id, 'mcft_crop_water_use_corn_v1');
  assert.equal(crop.crop_model_parameter_authority.configuration_semantic_hash, 'sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c');
  assert.equal(crop.activation_boundary.active_runtime_crop_context_changed_by_this_file, false);

  const runtime = fs.readFileSync('apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts', 'utf8');
  assert(runtime.includes('field_id: "field_kbs_mcse_t1r1"'), 'T3R1_SUCCESSOR_RUNTIME_MUST_REMAIN_T1_BEFORE_ACTIVATION');
  assert(runtime.includes('zone_id: "zone_kbs_mcse_t1r1_formal_v1"'), 'T3R1_SUCCESSOR_RUNTIME_ZONE_MUST_REMAIN_T1_BEFORE_ACTIVATION');
  assert(!runtime.includes('field_id: "field_kbs_mcse_t3r1"'), 'T3R1_SUCCESSOR_PREMATURE_RUNTIME_SWITCH_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_formal_successor_authority_governance_result_v1',
    status: 'PASS',
    subject_sha: head,
    exact_base_sha: base,
    exact_seven_file_boundary: true,
    historical_t1_authorities_preserved: true,
    t3r1_lifecycle_authority_pinned: true,
    t3r1_crop_only_geometry_authority_pinned: true,
    source_binding_matrix_reused_without_field_equivalence_upgrade: true,
    runtime_scope_intentionally_still_t1r1: true,
    runtime_scope_switch_authorized: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_formal_successor_authority_governance_result_v1',
    status: 'FAIL',
    error: String(error?.message || error),
    runtime_scope_switch_authorized: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
  });
  process.exitCode = 1;
}
