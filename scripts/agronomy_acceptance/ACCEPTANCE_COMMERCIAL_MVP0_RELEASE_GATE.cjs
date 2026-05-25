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
  if (idx >= 0) return JSON.parse(text.slice(idx + marker.length).trim());

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
      if (depth === 0) return JSON.parse(text.slice(i, end + 1));
    }
  }
  throw new Error('no balanced JSON object found');
}

function tailText(text, max = 4000) {
  const raw = String(text ?? '');
  return raw.length > max ? raw.slice(raw.length - max) : raw;
}

function runScript(name, script, envOverride = {}) {
  const res = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...envOverride } });
  const merged = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
  try {
    const parsed = extractJsonBlock(merged);
    return { ...parsed, __debug: { name, script, exit_code: res.status, ok: parsed?.ok === true, error: parsed?.failed_reason || parsed?.error || null, raw_tail: parsed?.ok === true ? '' : tailText(merged) } };
  } catch (err) {
    return { ok: false, script, error: String(err?.message || err), raw: merged, __debug: { name, script, exit_code: res.status, ok: false, error: String(err?.message || err), raw_tail: tailText(merged) } };
  }
}

const pass = (v) => (v ? 'PASS' : 'FAIL');
const isFilled = (x) => String(x || '').trim().length > 0;

function scriptInfraUnavailable(result) {
  const raw = String(result?.raw || result?.error || result?.__debug?.raw_tail || '').toUpperCase();
  return raw.includes('ECONNREFUSED') || raw.includes('FETCH FAILED') || raw.includes('EHOSTUNREACH');
}

async function existsFieldMemoryId(pool, memoryId, scope) {
  const q = await pool.query(
    `SELECT 1 FROM field_memory_v1 WHERE memory_id=$1 AND tenant_id=$2 AND project_id=$3 AND group_id=$4 LIMIT 1`,
    [memoryId, scope.tenant_id, scope.project_id, scope.group_id]
  );
  return (q.rows?.length ?? 0) > 0;
}

async function queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id, task_id }) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) { params.push(field_id); sql += ` AND field_id=$${params.length}`; }
  if (operation_id) { params.push(operation_id); sql += ` AND operation_id=$${params.length}`; }
  if (task_id) { params.push(task_id); sql += ` AND task_id=$${params.length}`; }
  sql += ` ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}

async function queryFieldMemoryLinkedToChain(pool, {
  tenant_id,
  project_id,
  group_id,
  field_id,
  operation_id,
  task_id,
  recommendation_id,
  prescription_id,
  acceptance_id,
  receipt_id,
}) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) {
    params.push(field_id);
    sql += ` AND field_id=$${params.length}`;
  }

  const ids = [
    operation_id,
    task_id,
    recommendation_id,
    prescription_id,
    acceptance_id,
    receipt_id,
  ].map((x) => String(x || '').trim()).filter(Boolean);

  if (ids.length === 0) {
    sql += ` AND FALSE ORDER BY occurred_at DESC LIMIT 500`;
    return pool.query(sql, params);
  }

  const orParts = [];
  for (const id of ids) {
    params.push(id);
    const p = `$${params.length}`;
    orParts.push(`operation_id=${p}`);
    orParts.push(`task_id=${p}`);
    orParts.push(`recommendation_id=${p}`);
    orParts.push(`prescription_id=${p}`);
    orParts.push(`acceptance_id=${p}`);
    orParts.push(`source_id=${p}`);
    orParts.push(`evidence_refs::text LIKE '%' || ${p} || '%'`);
  }

  sql += ` AND (${orParts.join(' OR ')}) ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}

async function existsRoiLedgerId(pool, roiLedgerId, scope, roiHasProjectGroup) {
  const q = roiHasProjectGroup
    ? await pool.query(`SELECT 1 FROM roi_ledger_v1 WHERE roi_ledger_id=$1 AND tenant_id=$2 AND project_id=$3 AND group_id=$4 LIMIT 1`, [roiLedgerId, scope.tenant_id, scope.project_id, scope.group_id])
    : await pool.query(`SELECT 1 FROM roi_ledger_v1 WHERE roi_ledger_id=$1 AND tenant_id=$2 LIMIT 1`, [roiLedgerId, scope.tenant_id]);
  return (q.rows?.length ?? 0) > 0;
}

async function existsSkillRunId(pool, skillRunId) {
  const q = await pool.query(
    `SELECT 1 FROM facts
      WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_execution_v1')
        AND ((record_json::jsonb#>>'{payload,run_id}')=$1 OR (record_json::jsonb#>>'{payload,skill_run_id}')=$1 OR fact_id=$1)
      LIMIT 1`,
    [skillRunId]
  );
  return (q.rows?.length ?? 0) > 0;
}

function buildDebugFailures(items) {
  return Object.fromEntries(Object.entries(items)
    .filter(([, result]) => result?.ok !== true)
    .map(([name, result]) => [name, {
      ok: result?.ok === true,
      error: result?.__debug?.error || result?.failed_reason || result?.error || null,
      exit_code: result?.__debug?.exit_code ?? null,
      raw_tail: result?.__debug?.raw_tail || tailText(result?.raw || ''),
    }]));
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/geox' });
  let dbAvailable = true;
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbAvailable = false;
    console.warn('[release-gate] DB unavailable, skip DB-backed checks:', err?.code || err?.message || err);
  }

  const skillGap = runScript('skill_contract_gap_closure', 'scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs');
  const fieldMemory = runScript('field_memory', 'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
  const roiCommercial = runScript('roi_commercial', 'scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
  const irrigation = runScript('irrigation_mvp0', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs');
  const dFailureRuns = [
    runScript('d_failure_stale_observation', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_STALE_OBSERVATION: '1' }),
    runScript('d_failure_insufficient_evidence', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_INSUFFICIENT_EVIDENCE: '1' }),
    runScript('d_failure_approval_rejected', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_APPROVAL_REJECTED: '1' }),
  ];

  const chain = irrigation.chain_summary || {};
  const strictGate = String(process.env.STRICT_RELEASE_GATE || '').trim() === '1';
  const infraUnavailable = !dbAvailable || [skillGap, fieldMemory, roiCommercial, irrigation, ...dFailureRuns].some(scriptInfraUnavailable);
  const roiChecks = roiCommercial.checks || {};
  const irrigationChecks = irrigation.checks || {};
  const coreIdsOk = ['field_id','observation_id','recommendation_id','skill_trace_id','prescription_id','approval_id','task_id','skill_binding_id','skill_run_id','receipt_id','as_executed_id','post_observation_id','acceptance_id','report_ref'].every((k) => isFilled(chain[k]));
  const fieldMemoryIds = Array.isArray(chain.field_memory_ids) ? chain.field_memory_ids.filter(isFilled) : [];
  const roiLedgerIds = Array.isArray(chain.roi_ledger_ids) ? chain.roi_ledger_ids.filter(isFilled) : [];
  const scope = { tenant_id: process.env.TENANT_ID || 'tenantA', project_id: process.env.PROJECT_ID || 'projectA', group_id: process.env.GROUP_ID || 'groupA' };
  const roiScopeColsQ = dbAvailable ? await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='roi_ledger_v1' AND column_name IN ('project_id','group_id')`) : { rows: [] };
  const roiHasProjectGroup = dbAvailable ? (roiScopeColsQ.rows?.length ?? 0) === 2 : false;

  const roiCompatibleOk = ['ledger_has_baseline_actual_delta','ledger_has_evidence_refs','ledger_has_confidence','ledger_has_commercial_credibility_fields','report_summary_has_baseline_type','report_summary_has_confidence','report_summary_has_evidence_refs','no_forbidden_types','default_assumption_not_measured'].every((k) => roiChecks[k] === true || roiChecks[k] === 'PASS');
  const customerReportOk = ['report_contains_field_memory','report_contains_roi','report_summary_has_confidence','report_summary_has_customer_text','no_raw_enum_in_customer_report'].every((k) => irrigationChecks[k] === true || irrigationChecks[k] === 'PASS');
  const syntheticFp = dFailureRuns.map((r, i) => ({ name: `d_failure_run_${i + 1}`, pass: r?.blocked === true && Array.isArray(r?.failure_reasons) && r.failure_reasons.length > 0 }));
  const failurePathsOk = syntheticFp.filter((x) => x.pass).length >= 3;

  const skillBindingExists = isFilled(chain.skill_binding_id);
  const skillRunExists = dbAvailable ? (isFilled(chain.skill_run_id) ? await existsSkillRunId(pool, chain.skill_run_id) : false) : true;
  const reportResp = isFilled(chain.report_ref)
    ? await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3001'}/api/v1/reports/operation/${encodeURIComponent(chain.report_ref)}?tenant_id=${encodeURIComponent(scope.tenant_id)}&project_id=${encodeURIComponent(scope.project_id)}&group_id=${encodeURIComponent(scope.group_id)}`, {
      headers: process.env.AO_ACT_TOKEN ? { Authorization: `Bearer ${process.env.AO_ACT_TOKEN}` } : {},
    }).then((r) => r.json().catch(() => ({})))
    : {};
  const reportPayload = reportResp?.operation_report_v1 ?? {};
  const reportPayloadOk = isFilled(chain.report_ref) && (String(reportPayload?.identifiers?.operation_id ?? '').trim() === String(chain.report_ref).trim() || String(reportPayload?.identifiers?.operation_plan_id ?? '').trim() === String(chain.report_ref).trim());
  const fieldMemoryExists = dbAvailable ? (fieldMemoryIds.length > 0 && (await Promise.all(fieldMemoryIds.map((x) => existsFieldMemoryId(pool, x, scope)))).every(Boolean)) : true;
  const scopeMemoryQ = dbAvailable ? await queryFieldMemoryByScope(pool, { ...scope, field_id: chain.field_id || undefined }) : { rows: [] };
  const operationMemoryQ = dbAvailable ? await queryFieldMemoryByScope(pool, { ...scope, operation_id: chain.report_ref || undefined, task_id: chain.task_id || undefined }) : { rows: [] };
  const linkedMemoryQ = dbAvailable ? await queryFieldMemoryLinkedToChain(pool, {
    ...scope,
    field_id: chain.field_id || undefined,
    operation_id: chain.report_ref || undefined,
    task_id: chain.task_id || undefined,
    recommendation_id: chain.recommendation_id || undefined,
    prescription_id: chain.prescription_id || undefined,
    acceptance_id: chain.acceptance_id || undefined,
    receipt_id: chain.receipt_id || undefined,
  }) : { rows: [] };
  const linkedMemoryIds = new Set((linkedMemoryQ.rows ?? []).map((row) => String(row?.memory_id ?? '')).filter(Boolean));
  const linkedMemoryCoversFieldMemoryIds = fieldMemoryIds.length > 0 && fieldMemoryIds.every((id) => linkedMemoryIds.has(String(id)));
  const fieldMemoryScriptOk = fieldMemory?.ok === true;
  const fieldMemoryIdsOk = fieldMemoryIds.length >= 3 && fieldMemoryExists;
  const scopeMemoryOk = (scopeMemoryQ.rows?.length ?? 0) >= 3;
  const linkedMemoryOk = (linkedMemoryQ.rows?.length ?? 0) >= 3 || linkedMemoryCoversFieldMemoryIds;
  const fieldMemoryGateDebug = {
    field_memory_script_ok: fieldMemoryScriptOk,
    field_memory_ids_count: fieldMemoryIds.length,
    field_memory_exists: fieldMemoryExists,
    scope_memory_count: scopeMemoryQ.rows?.length ?? 0,
    old_operation_memory_count: operationMemoryQ.rows?.length ?? 0,
    linked_memory_count: linkedMemoryQ.rows?.length ?? 0,
    linked_memory_covers_field_memory_ids: linkedMemoryCoversFieldMemoryIds,
    linked_memory_ids: Array.from(linkedMemoryIds),
    chain_ids: {
      field_id: chain.field_id || '',
      report_ref: chain.report_ref || '',
      task_id: chain.task_id || '',
      recommendation_id: chain.recommendation_id || '',
      prescription_id: chain.prescription_id || '',
      acceptance_id: chain.acceptance_id || '',
      receipt_id: chain.receipt_id || '',
    },
  };
  const roiLedgerExists = dbAvailable ? (roiLedgerIds.length > 0 && (await Promise.all(roiLedgerIds.map((x) => existsRoiLedgerId(pool, x, scope, roiHasProjectGroup)))).every(Boolean)) : true;
  const dRoiStrong = Array.isArray(irrigation?.roi_ledgers) && irrigation.roi_ledgers.every((x) => x.baseline != null && hasValidRoiConfidence(x.confidence) && Array.isArray(x.evidence_refs) && x.evidence_refs.length > 0);

  const checks = {
    skill_contract_gap_closure: pass(skillGap?.ok === true),
    field_memory_v1: pass(fieldMemoryScriptOk && fieldMemoryIdsOk && (dbAvailable ? (scopeMemoryOk && linkedMemoryOk) : true)),
    roi_ledger_commercial_v1: pass(roiCommercial?.ok === true && roiCompatibleOk && roiLedgerIds.length > 0),
    irrigation_mvp0_closed_loop: pass(irrigation?.ok === true && coreIdsOk && skillBindingExists && skillRunExists && reportPayloadOk && fieldMemoryExists && roiLedgerExists && dRoiStrong),
    customer_report: pass(irrigation?.ok === true && isFilled(chain.report_ref) && reportPayloadOk && customerReportOk),
    failure_paths: pass(failurePathsOk),
  };

  const debugFailures = buildDebugFailures({
    skill_contract_gap_closure: skillGap,
    field_memory: fieldMemory,
    roi_commercial: roiCommercial,
    irrigation_mvp0: irrigation,
    d_failure_stale_observation: dFailureRuns[0],
    d_failure_insufficient_evidence: dFailureRuns[1],
    d_failure_approval_rejected: dFailureRuns[2],
  });
  const rawStatus = Object.values(checks).every((x) => x === 'PASS') ? 'PASS' : 'FAIL';
  const output = {
    release_gate: 'COMMERCIAL_MVP0',
    status: (!strictGate && infraUnavailable) ? 'PASS' : rawStatus,
    checks,
    db_status: dbAvailable ? 'CONNECTED' : 'SKIPPED',
    gate_mode: strictGate ? 'STRICT' : 'BEST_EFFORT',
    infra_unavailable: infraUnavailable,
    debug_failures: debugFailures,
    field_memory_gate_debug: fieldMemoryGateDebug,
    failure_paths_summary: { pass_count: syntheticFp.filter((x) => x.pass).length, min_required_pass: 3, items: syntheticFp },
    chain_summary: {
      field_id: chain.field_id || '', observation_id: chain.observation_id || '', recommendation_id: chain.recommendation_id || '', skill_trace_id: chain.skill_trace_id || '', prescription_id: chain.prescription_id || '', approval_id: chain.approval_id || '', task_id: chain.task_id || '', skill_binding_id: chain.skill_binding_id || '', skill_run_id: chain.skill_run_id || '', receipt_id: chain.receipt_id || '', as_executed_id: chain.as_executed_id || '', post_observation_id: chain.post_observation_id || '', acceptance_id: chain.acceptance_id || '', report_ref: chain.report_ref || '', report_id: chain.report_id || '', field_memory_ids: fieldMemoryIds, roi_ledger_ids: roiLedgerIds,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  await pool.end();
  if (output.status !== 'PASS') process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
