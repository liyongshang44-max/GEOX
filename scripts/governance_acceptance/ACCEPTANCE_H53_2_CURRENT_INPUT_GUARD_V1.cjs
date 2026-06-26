#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H53_2_CURRENT_INPUT_GUARD_V1.cjs
// Purpose: verify that H53.2 current-state derivation does not use post-irrigation sensing windows.
// Boundary: read-only acceptance; it writes no facts or projections.

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SOURCE = 'H53_2_WATER_STRESS_STATE_DERIVATION_V1';
const VERSION = 'h53.2.v1';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H53_2_CURRENT_INPUT_GUARD_V1', error, details }, null, 2));
  process.exit(1);
}
function ok(condition, error, details = {}) { if (!condition) fail(error, details); }
function lower(value) { return String(value || '').toLowerCase(); }
function read(file) { return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); }
function rejectPost(payload) {
  const values = [payload.source_sensing_window_id, payload.source_sensing_window_fact_id, payload.source_observation_id, payload.source_observation_fact_id].map(lower);
  ok(!values.some((value) => value.includes('post_irrigation')), 'POST_IRRIGATION_INPUT_USED', { values });
}

async function main() {
  const derive = read('scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  ok(derive.includes('POST_IRRIGATION_INPUT_FORBIDDEN_IN_H53_2_CURRENT_STATE'), 'DERIVATION_POST_IRRIGATION_GUARD_MISSING');
  ok(derive.includes('CURRENT_STATE_INPUT'), 'CURRENT_STATE_INPUT_ROLE_MISSING');

  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const result = await client.query(
      `select fact_id, record_json::jsonb as record_json
         from facts
        where source=$1
          and record_json::jsonb->>'type'='water_state_estimate_v1'
          and record_json::jsonb#>>'{payload,derivation_version}'=$2
        order by occurred_at desc, fact_id desc
        limit 1`,
      [SOURCE, VERSION],
    );
    ok(result.rows.length === 1, 'H53_2_FACT_MISSING');
    const payload = result.rows[0].record_json.payload || {};
    ok(payload.source_input_role === 'CURRENT_STATE_INPUT', 'SOURCE_INPUT_ROLE_NOT_CURRENT', { payload });
    ok(payload.rule && payload.rule.post_irrigation_window_forbidden === true, 'POST_IRRIGATION_RULE_FLAG_MISSING', { payload });
    rejectPost(payload);
    console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H53_2_CURRENT_INPUT_GUARD_V1', fact_id: result.rows[0].fact_id, source_sensing_window_id: payload.source_sensing_window_id }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => fail(error.message));
