const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function pickIrrigationRecommendation(json) {
  const list = Array.isArray(json?.recommendations) ? json.recommendations : [];
  return list.find((x) => String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1') ?? list[0] ?? null;
}

async function generateRecommendation({ base, token, tenant_id, project_id, group_id, field_id, season_id, device_id }) {
  const res = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn',
      image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 }
    }
  });
  const json = requireOk(res, 'recommendations.generate');
  const rec = pickIrrigationRecommendation(json);
  assert.ok(rec, 'NO_RECOMMENDATION');
  return rec;
}

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = env('ADMIN_TOKEN', 'admin_token');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos');

  const suffix = Date.now();
  const field_id = `field_mem_feedback_${suffix}`;
  const season_id = `season_mem_feedback_${suffix}`;
  const device_id = `device_mem_feedback_${suffix}`;

  const pool = new Pool({ connectionString: databaseUrl });

  const ts0 = Date.now() - 60000;
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'[]'::jsonb),
      ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'[]'::jsonb)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, ts0, randomUUID(), randomUUID()]
  );
  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,0.12,0.9,$7)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, ts0, `obs_${randomUUID()}`]
  );

  // Step 1: no memory => A
  const A = await generateRecommendation({ base, token: adminToken, tenant_id, project_id, group_id, field_id, season_id, device_id });

  // Step 2: add 2 weak response => B
  for (let i = 0; i < 2; i += 1) {
    await pool.query(
      `INSERT INTO field_memory_v1 (
        memory_id, tenant_id, project_id, group_id, field_id, season_id, memory_type, metric_key,
        before_value, after_value, delta_value, confidence, source_type, source_id, summary_text, evidence_refs, occurred_at
      ) VALUES ($1,$2,$3,$4,$5,$6,'FIELD_RESPONSE_MEMORY','soil_moisture_response',$7,$8,$9,$10,'acceptance',$11,$12,'[]'::jsonb,NOW())`,
      [
        `mem_${randomUUID().replace(/-/g, '')}`,
        tenant_id, project_id, group_id, field_id, season_id,
        0.20, 0.20, 0.01, 0.9,
        `src_${randomUUID()}`,
        'soil_moisture_delta_not_reached'
      ]
    );
  }
  const B = await generateRecommendation({ base, token: adminToken, tenant_id, project_id, group_id, field_id, season_id, device_id });

  const riskB = Array.isArray(B?.risk?.reasons) ? B.risk.reasons.map((x) => String(x)) : [];
  const explainB = String(B?.explain?.human ?? B?.explain?.action_summary ?? '');
  const changedFromA =
    Number(B.confidence ?? 0) < Number(A.confidence ?? 0)
    || B.requires_manual_review === true
    || riskB.length > (Array.isArray(A?.risk?.reasons) ? A.risk.reasons.length : 0)
    || explainB !== String(A?.explain?.human ?? A?.explain?.action_summary ?? '')
    || (Array.isArray(B.memory_refs) && B.memory_refs.length > 0);
  assert.ok(changedFromA, 'Step2: recommendation should change after weak-response memory');

  // Step 3: add deviation memory => C
  await pool.query(
    `INSERT INTO field_memory_v1 (
      memory_id, tenant_id, project_id, group_id, field_id, season_id, memory_type, metric_key,
      before_value, after_value, delta_value, confidence, source_type, source_id, summary_text, evidence_refs, occurred_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'FIELD_RESPONSE_MEMORY','execution_deviation',$7,$8,$9,$10,'acceptance',$11,$12,'[]'::jsonb,NOW())`,
    [
      `mem_${randomUUID().replace(/-/g, '')}`,
      tenant_id, project_id, group_id, field_id, season_id,
      1.0, 1.3, 0.3, 0.9,
      `src_${randomUUID()}`,
      'execution deviation > 15%'
    ]
  );
  const C = await generateRecommendation({ base, token: adminToken, tenant_id, project_id, group_id, field_id, season_id, device_id });

  const riskC = Array.isArray(C?.risk?.reasons) ? C.risk.reasons.map((x) => String(x)) : [];
  assert.ok(
    C.requires_manual_review === true || riskC.some((x) => x.includes('FIELD_MEMORY_EXECUTION_DEVIATION_RISK')),
    'Step3: should require manual review or include FIELD_MEMORY_EXECUTION_DEVIATION_RISK'
  );

  process.stdout.write('ACCEPTANCE_FIELD_MEMORY_RECOMMENDATION_FEEDBACK_V1: PASS\n');
  await pool.end();
})().catch(async (err) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2)}\n`);
  process.exitCode = 1;
});
