'use strict';
const { Client } = require('pg');
const { SOURCE, COMPUTED_AT } = require('./h53_4_recommendation_candidate_model.cjs');
const { DB } = require('./h53_4_reader.cjs');
async function writeRecommendation(record) {
  const p = record.payload;
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('insert into facts (fact_id, occurred_at, source, record_json) values ($1, $2, $3, $4::jsonb) on conflict do nothing', [p.recommendation_id, COMPUTED_AT, SOURCE, JSON.stringify(record)]);
    await client.query('COMMIT');
    return { recommendation_fact_id: p.recommendation_id, index: { skipped: true, reason: 'TEMP_FACT_ONLY' } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
module.exports = { writeRecommendation };
