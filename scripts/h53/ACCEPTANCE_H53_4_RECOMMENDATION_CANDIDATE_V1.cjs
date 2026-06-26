'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SRC = 'H53_4_RECOMMENDATION_CANDIDATE_DERIVATION_V1';
function fail(error, details = {}) { console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H53_4_RECOMMENDATION_CANDIDATE_V1', error, details }, null, 2)); process.exit(1); }
function ok(v, e, d = {}) { if (!v) fail(e, d); }
function has(file, token) { const txt = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); ok(txt.includes(token), 'TOKEN_MISSING', { file, token }); }
(async function main() {
  has('apps/server/src/routes/v1/operator_evidence_twin.ts', 'H53_4_RECOMMENDATION_CANDIDATE_DERIVATION_V1');
  has('apps/server/src/routes/v1/operator_evidence_twin.ts', 'latestH534Recommendation');
  has('apps/server/src/routes/v1/operator_evidence_twin.ts', 'recommendationNode');
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const fact = await client.query("select fact_id, record_json::jsonb as record_json from facts where source=$1 and record_json::jsonb->>'type'='decision_recommendation_v1' order by occurred_at desc, fact_id desc limit 1", [SRC]);
    ok(fact.rows.length === 1, 'RECOMMENDATION_FACT_MISSING');
    const p = fact.rows[0].record_json.payload || {};
    ok(p.recommendation_status === 'RECOMMENDED', 'STATUS_INVALID', p);
    ok(p.selected_scenario_option_id === 'NO_ACTION', 'OPTION_INVALID', p);
    ok(p.human_approval_required === true, 'REVIEW_FLAG_MISSING', p);
    ok(p.no_direct_execution === true, 'DIRECT_EXECUTION_GUARD_MISSING', p);
    const idx = await client.query('select recommendation_id from decision_recommendation_index_v1 where recommendation_id=$1', [p.recommendation_id]);
    ok(idx.rows.length === 1, 'RECOMMENDATION_INDEX_MISSING', p);
    console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H53_4_RECOMMENDATION_CANDIDATE_V1', db: { recommendation_id: p.recommendation_id, selected_scenario_option_id: p.selected_scenario_option_id }, endpoint_static: { readback_declared: true } }, null, 2));
  } finally { await client.end(); }
})().catch((error) => fail(error.message));
