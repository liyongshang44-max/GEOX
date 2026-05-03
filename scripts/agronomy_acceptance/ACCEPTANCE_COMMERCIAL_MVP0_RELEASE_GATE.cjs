const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
function hasValidRoiConfidence(confidence) {
  if (typeof confidence === 'number') return confidence > 0;
  if (!confidence || typeof confidence !== 'object') return false;
  return ['HIGH', 'MEDIUM', 'LOW'].includes(String(confidence.level || ''))
    && ['measured', 'estimated', 'assumed'].includes(String(confidence.basis || ''))
    && Array.isArray(confidence.reasons);
}

function extractJsonBlock(text) {
  const marker = '::ACCEPTANCE_JSON::';
  const idx = text.lastIndexOf(marker);
  if (idx >= 0) {
    const marked = text.slice(idx + marker.length).trim();
    return JSON.parse(marked);
  }

  let end = -1;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (text[i] === '}') { end = i; break; }
  }
  if (end < 0) throw new Error('no JSON object end brace found');

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = end; i >= 0; i -= 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(i, end + 1));
      }
    }
  }
  throw new Error('no balanced JSON object found');
}

function runScript(script, envOverride = {}) {
  const res = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...envOverride } });
  const merged = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
  try {
    return extractJsonBlock(merged);
  } catch (err) {
    return { ok: false, script, error: String(err?.message || err), raw: merged };
  }
}

const pass = (v) => (v ? 'PASS' : 'FAIL');
const isFilled = (x) => String(x || '').trim().length > 0;
const isPass = (v) => String(v || '').toUpperCase() === 'PASS';

async function existsFieldMemoryId(pool, memoryId) {
  const q = await pool.query('SELECT 1 FROM field_memory_v1 WHERE memory_id=$1 LIMIT 1', [memoryId]);
  return (q.rows?.length ?? 0) > 0;
}
async function queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id }) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) { params.push(field_id); sql += ` AND field_id=$${params.length}`; }
  if (operation_id) { params.push(operation_id); sql += ` AND operation_id=$${params.length}`; }
  sql += ` ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}
async function existsRoiLedgerId(pool, roiLedgerId) {
  const q = await pool.query('SELECT 1 FROM roi_ledger_v1 WHERE roi_ledger_id=$1 LIMIT 1', [roiLedgerId]);
  return (q.rows?.length ?? 0) > 0;
}
async function existsSkillRunId(pool, skillRunId) {
  const q = await pool.query(
    `SELECT 1 FROM facts
      WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_execution_v1')
        AND (record_json::jsonb#>>'{payload,skill_run_id}')=$1
      LIMIT 1`,
    [skillRunId]
  );
  return (q.rows?.length ?? 0) > 0;
}
async function existsReportId(pool, reportId) {
  const q = await pool.query(
    `SELECT 1 FROM facts
      WHERE (record_json::jsonb#>>'{payload,report_id}')=$1
         OR (record_json::jsonb#>>'{payload,fact_id}')=$1
      LIMIT 1`,
    [reportId]
  );
  return (q.rows?.length ?? 0) > 0;
}
async function existsSkillBindingFromTaskFact(pool, taskId, skillBindingId) {
  const q = await pool.query(
    `SELECT 1 FROM facts
      WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
        AND (
          (record_json::jsonb#>>'{payload,meta,skill_binding_evidence,skill_binding_id}')=$2
          OR (record_json::jsonb#>>'{payload,meta,skill_binding_evidence,skill_binding_fact_id}')=$2
        )
      LIMIT 1`,
    [taskId, skillBindingId]
  );
  return (q.rows?.length ?? 0) > 0;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/geox' });
  const skillGap = runScript('scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs');
  const fieldMemory = runScript('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
  const roiCommercial = runScript('scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
  const irrigation = runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs');
  const dFailureRuns = [
    runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_STALE_OBSERVATION: '1' }),
    runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_INSUFFICIENT_EVIDENCE: '1' }),
    runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_APPROVAL_REJECTED: '1' }),
  ];

  const chain = irrigation.chain_summary || {};
  const roiChecks = roiCommercial.checks || {};
  const irrigationChecks = irrigation.checks || {};

  const coreIdsOk = [
    'field_id','observation_id','recommendation_id','skill_trace_id','prescription_id','approval_id','task_id','skill_binding_id','skill_run_id','receipt_id','as_executed_id','post_observation_id','acceptance_id','report_id',
  ].every((k) => isFilled(chain[k]));

  const fieldMemoryIds = Array.isArray(chain.field_memory_ids) ? chain.field_memory_ids.filter(isFilled) : [];
  const roiLedgerIds = Array.isArray(chain.roi_ledger_ids) ? chain.roi_ledger_ids.filter(isFilled) : [];

  const roiCompatibleOk = [
    'ledger_has_baseline_actual_delta',
    'ledger_has_evidence_refs',
    'ledger_has_confidence',
    'ledger_has_commercial_credibility_fields',
    'report_summary_has_baseline_type',
    'report_summary_has_confidence',
    'report_summary_has_evidence_refs',
    'no_forbidden_types',
    'default_assumption_not_measured',
  ].every((k) => roiChecks[k] === true || roiChecks[k] === 'PASS');

  const customerReportOk = [
    'report_contains_field_memory',
    'report_contains_roi',
    'report_summary_has_confidence',
    'report_summary_has_customer_text',
    'no_raw_enum_in_customer_report',
  ].every((k) => irrigationChecks[k] === true || irrigationChecks[k] === 'PASS');

  const fp = irrigation.failure_audit_summary;
  const syntheticFp = dFailureRuns.map((r, i) => ({ name: `d_failure_run_${i + 1}`, pass: r?.blocked === true && Array.isArray(r?.failure_reasons) && r.failure_reasons.length > 0 }));
  const failurePathsPassCount = Array.isArray(fp)
    ? fp.filter((x) => x && (x.blocked === true || isPass(x.status))).length
    : 0;
  const failurePathsOk = syntheticFp.filter((x) => x.pass).length >= 3;

  const skillBindingExists = isFilled(chain.task_id) && isFilled(chain.skill_binding_id)
    ? await existsSkillBindingFromTaskFact(pool, chain.task_id, chain.skill_binding_id)
    : false;
  const skillRunExists = isFilled(chain.skill_run_id) ? await existsSkillRunId(pool, chain.skill_run_id) : false;
  const reportExists = isFilled(chain.report_id) ? await existsReportId(pool, chain.report_id) : false;
  const fieldMemoryExists = fieldMemoryIds.length > 0
    && (await Promise.all(fieldMemoryIds.map((x) => existsFieldMemoryId(pool, x)))).every(Boolean);
  const scopeMemoryQ = await queryFieldMemoryByScope(pool, {
    tenant_id: process.env.TENANT_ID || 'tenantA',
    project_id: process.env.PROJECT_ID || 'projectA',
    group_id: process.env.GROUP_ID || 'groupA',
    field_id: chain.field_id || undefined,
  });
  const operationMemoryQ = await queryFieldMemoryByScope(pool, {
    tenant_id: process.env.TENANT_ID || 'tenantA',
    project_id: process.env.PROJECT_ID || 'projectA',
    group_id: process.env.GROUP_ID || 'groupA',
    operation_id: chain.task_id || undefined,
  });
  const roiLedgerExists = roiLedgerIds.length > 0
    && (await Promise.all(roiLedgerIds.map((x) => existsRoiLedgerId(pool, x)))).every(Boolean);
  const dRoiStrong = Array.isArray(irrigation?.roi_ledgers)
    && irrigation.roi_ledgers.every((x) =>
      x.baseline != null
      && hasValidRoiConfidence(x.confidence)
      && Array.isArray(x.evidence_refs)
      && x.evidence_refs.length > 0
    );

  const checks = {
    skill_contract_gap_closure: pass(skillGap?.ok === true),
    field_memory_v1: pass(fieldMemory?.ok === true && fieldMemoryIds.length >= 3 && (scopeMemoryQ.rows?.length ?? 0) >= 3 && (operationMemoryQ.rows?.length ?? 0) >= 1 && fieldMemoryExists),
    roi_ledger_commercial_v1: pass(roiCommercial?.ok === true && roiCompatibleOk && roiLedgerIds.length > 0),
    irrigation_mvp0_closed_loop: pass(irrigation?.ok === true && coreIdsOk && skillBindingExists && skillRunExists && reportExists && fieldMemoryExists && roiLedgerExists && dRoiStrong),
    customer_report: pass(irrigation?.ok === true && isFilled(chain.report_id) && customerReportOk),
    failure_paths: pass(failurePathsOk),
  };

  const output = {
    release_gate: 'COMMERCIAL_MVP0',
    status: Object.values(checks).every((x) => x === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    failure_paths_summary: {
      pass_count: syntheticFp.filter((x) => x.pass).length,
      min_required_pass: 3,
      items: syntheticFp,
    },
    chain_summary: {
      field_id: chain.field_id || '',
      observation_id: chain.observation_id || '',
      recommendation_id: chain.recommendation_id || '',
      skill_trace_id: chain.skill_trace_id || '',
      prescription_id: chain.prescription_id || '',
      approval_id: chain.approval_id || '',
      task_id: chain.task_id || '',
      skill_binding_id: chain.skill_binding_id || '',
      skill_run_id: chain.skill_run_id || '',
      receipt_id: chain.receipt_id || '',
      as_executed_id: chain.as_executed_id || '',
      post_observation_id: chain.post_observation_id || '',
      acceptance_id: chain.acceptance_id || '',
      report_id: chain.report_id || '',
      field_memory_ids: fieldMemoryIds,
      roi_ledger_ids: roiLedgerIds,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  await pool.end();
  if (output.status !== 'PASS') process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
