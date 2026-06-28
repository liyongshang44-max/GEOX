// scripts/governance_acceptance/postv1_02_fixture_cases.cjs
'use strict';

const RUN = String(process.env.POSTV1_02_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, '_');

const CASES = [
  { tenant_id: 'tenantA', key: 'a_rice_spring', project_id: 'postv1_project_a', group_id: 'postv1_group_a', field_id: 'postv1_field_a_rice_spring', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-01T00:00:00.000Z', water_state: 'NORMAL', soil: 29 },
  { tenant_id: 'tenantA', key: 'b_maize_summer', project_id: 'postv1_project_b', group_id: 'postv1_group_b', field_id: 'postv1_field_b_maize_summer', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-01T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 24 },
  { tenant_id: 'tenantA', key: 'c_rice_spring', project_id: 'postv1_project_c', group_id: 'postv1_group_c', field_id: 'postv1_field_c_rice_spring', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-02T00:00:00.000Z', water_state: 'NORMAL', soil: 28 },
  { tenant_id: 'tenantA', key: 'd_maize_summer', project_id: 'postv1_project_d', group_id: 'postv1_group_d', field_id: 'postv1_field_d_maize_summer', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-02T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 23 },
  { tenant_id: 'tenantA', key: 'e_rice_spring', project_id: 'postv1_project_e', group_id: 'postv1_group_e', field_id: 'postv1_field_e_rice_spring', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-03T00:00:00.000Z', water_state: 'NORMAL', soil: 30 },
  { tenant_id: 'tenantA', key: 'f_maize_summer', project_id: 'postv1_project_f', group_id: 'postv1_group_f', field_id: 'postv1_field_f_maize_summer', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-03T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 22 },
];

function base(fixture) {
  return `postv102_${fixture.key}_${RUN}`;
}

module.exports = { RUN, CASES, base };
