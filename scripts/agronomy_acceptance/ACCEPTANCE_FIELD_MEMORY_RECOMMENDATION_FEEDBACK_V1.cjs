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

  // seed formal trigger
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

  // Step1 baseline
  const baseline = await generateRecommendation({ base, token: adminToken, tenant_id, project_id, group_id, field_id, season_id, device_id });

  // Step2 write two weak-response memories
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

  // Step3 regenerate
  const after = await generateRecommendation({ base, token: adminToken, tenant_id, project_id, group_id, field_id, season_id, device_id });

  // assert 1 memory refs
  assert.ok(Array.isArray(after.memory_refs) && after.memory_refs.length >= 2, 'memory_refs should include >=2 entries');

  // assert 2 structural changes
  const riskReasons = Array.isArray(after?.risk?.reasons) ? after.risk.reasons.map((x) => String(x).toLowerCase()) : [];
  const structureChanged =
    after.requires_manual_review === true
    || Number(after.confidence ?? 0) < Number(baseline.confidence ?? 0)
    || riskReasons.some((x) => x.includes('field_memory_weak_response') || x.includes('weak_field_response'));
  assert.ok(structureChanged, 'expected memory-driven structure change on recommendation');

  // assert 3 explain changed
  const explainText = String(after?.explain?.human ?? after?.explain?.action_summary ?? '');
  assert.ok(explainText.includes('历史'), 'explain should include 历史');

  // final standard
  assert.ok(baseline.requires_manual_review !== true, 'baseline should not require manual review');
  assert.ok(after.requires_manual_review === true, 'after should require manual review');
  assert.ok(Number(after.confidence ?? 0) <= Number(baseline.confidence ?? 0), 'after confidence should be <= baseline');

  process.stdout.write(`${JSON.stringify({ ok: true, baseline, after }, null, 2)}\n`);
  await pool.end();
})().catch(async (err) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2)}\n`);
  process.exitCode = 1;
});
