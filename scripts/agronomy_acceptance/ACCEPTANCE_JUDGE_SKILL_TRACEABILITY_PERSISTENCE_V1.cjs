#!/usr/bin/env node
/* eslint-disable no-console */
const assert = require('node:assert/strict');

async function loadModules() {
  try {
    const pg = await import('pg');
    const evidence = await import('../../apps/server/src/domain/judge/evidence_judge_v2.ts');
    const execution = await import('../../apps/server/src/domain/judge/execution_judge_v2.ts');
    const result = await import('../../apps/server/src/domain/judge/judge_result_v2.ts');
    return { Pool: pg.Pool, ...evidence, ...execution, ...result };
  } catch (_err) {
    const pg = await import('pg');
    const evidence = await import('../../apps/server/src/domain/judge/evidence_judge_v2.js');
    const execution = await import('../../apps/server/src/domain/judge/execution_judge_v2.js');
    const result = await import('../../apps/server/src/domain/judge/judge_result_v2.js');
    return { Pool: pg.Pool, ...evidence, ...execution, ...result };
  }
}

function assertTraceFields(item) {
  assert(Array.isArray(item.source_refs) && item.source_refs.length > 0, 'source_refs must be non-empty');
  for (const ref of item.source_refs) {
    assert(ref.skill_id, 'missing source_refs.skill_id');
    assert(ref.skill_version, 'missing source_refs.skill_version');
    assert(ref.skill_category, 'missing source_refs.skill_category');
    assert(ref.trace_id, 'missing source_refs.trace_id');
    assert(ref.run_id, 'missing source_refs.run_id');
    assert(ref.input_digest, 'missing source_refs.input_digest');
  }

  assert(Array.isArray(item.outputs?.skill_traces), 'outputs.skill_traces must be array');
  for (const st of item.outputs.skill_traces) {
    assert(st.skill_id, 'missing outputs.skill_traces.skill_id');
    assert(st.skill_version, 'missing outputs.skill_traces.skill_version');
    assert(st.skill_category, 'missing outputs.skill_traces.skill_category');
    assert(st.trace_id, 'missing outputs.skill_traces.trace_id');
    assert(st.run_id, 'missing outputs.skill_traces.run_id');
  }
}

(async () => {
  const {
    Pool,
    evaluateEvidenceJudgeV2,
    evaluateExecutionJudgeV2,
    buildJudgeResultV2,
    insertJudgeResultV2,
    loadJudgeResultV2,
  } = await loadModules();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const t = Date.now();
  const base = { tenant_id: 't1', project_id: 'p1', group_id: 'g1' };

  const evidenceInput = {
    ...base,
    field_id: `field_${t}`,
    device_id: `device_${t}`,
    soil_moisture: 0.5,
    observed_at_ts_ms: t - 60_000,
    now_ts_ms: t,
    last_heartbeat_ts_ms: t - 60_000,
    evidence_refs: ['sensor:e1'],
  };
  const evidenceBuilt = buildJudgeResultV2(evaluateEvidenceJudgeV2(evidenceInput));
  const evidenceInserted = await insertJudgeResultV2(pool, evidenceBuilt);
  const evidenceLoaded = await loadJudgeResultV2(pool, { ...base, judge_id: evidenceInserted.judge_id });
  assert(evidenceLoaded, 'failed to load evidence result');
  assertTraceFields(evidenceLoaded);

  const executionInput = {
    ...base,
    field_id: `field_${t}`,
    prescription_id: `pres_${t}`,
    receipt: { receipt_id: `r_${t}`, task_id: `task_${t}`, status: 'executed', evidence_refs: ['receipt:e1'] },
    as_executed: { as_executed_id: `ae_${t}`, task_id: `task_${t}` },
    as_applied: { as_applied_id: `aa_${t}` },
    pre_soil_moisture: 0.30,
    post_soil_moisture: 0.35,
    evidence_refs: ['receipt:e1'],
  };
  const executionBuilt = buildJudgeResultV2(evaluateExecutionJudgeV2(executionInput));
  const executionInserted = await insertJudgeResultV2(pool, executionBuilt);
  const executionLoaded = await loadJudgeResultV2(pool, { ...base, judge_id: executionInserted.judge_id });
  assert(executionLoaded, 'failed to load execution result');
  assertTraceFields(executionLoaded);

  await pool.end();
  console.log('ACCEPTANCE_JUDGE_SKILL_TRACEABILITY_PERSISTENCE_V1: PASS');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
