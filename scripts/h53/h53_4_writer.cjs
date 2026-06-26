'use strict';
const { Client } = require('pg');
const { SOURCE, COMPUTED_AT } = require('./h53_4_recommendation_candidate_model.cjs');
const { DB } = require('./h53_4_reader.cjs');
function js(v) { return JSON.stringify(v); }
async function writeRecommendation(record) {
  const p = record.payload;
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('insert into facts (fact_id, occurred_at, source, record_json) values ($1, $2, $3, $4::jsonb) on conflict do nothing', [p.recommendation_id, COMPUTED_AT, SOURCE, js(record)]);
    await client.query('insert into decision_recommendation_index_v1 (recommendation_id,tenant_id,project_id,group_id,field_id,recommendation_status,selected_scenario_option_id,source_water_state_estimate_id,source_scenario_set_id,scenario_summary_json,input_refs_json,evidence_refs_json,derivation_json,quality_json,confidence_json,human_approval_required,source_fact_id,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19) on conflict do nothing', [p.recommendation_id,p.tenant_id,p.project_id,p.group_id,p.field_id,p.recommendation_status,p.selected_scenario_option_id,p.source_water_state_estimate_id,p.source_scenario_set_id,js(p.scenario_summary_json),js(p.input_refs),js(p.evidence_refs),js(p.derivation),js(p.quality),js(p.confidence),p.human_approval_required,p.recommendation_id,COMPUTED_AT,COMPUTED_AT]);
    await client.query('COMMIT');
    return { recommendation_fact_id: p.recommendation_id, index: { skipped: false } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
module.exports = { writeRecommendation };
