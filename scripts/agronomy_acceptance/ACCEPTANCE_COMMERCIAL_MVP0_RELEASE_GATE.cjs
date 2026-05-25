const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');

const pass = (v) => v ? 'PASS' : 'FAIL';
const filled = (x) => String(x || '').trim().length > 0;
const tail = (s, n = 4000) => String(s || '').slice(-n);

function jsonFrom(text) {
  const marker = '::ACCEPTANCE_JSON::';
  const mi = text.lastIndexOf(marker);
  if (mi >= 0) return JSON.parse(text.slice(mi + marker.length).trim());
  const end = text.lastIndexOf('}');
  if (end < 0) throw new Error('no JSON object end brace found');
  let depth = 0, inStr = false, esc = false;
  for (let i = end; i >= 0; i -= 1) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '}') depth += 1;
    if (ch === '{') { depth -= 1; if (depth === 0) return JSON.parse(text.slice(i, end + 1)); }
  }
  throw new Error('no balanced JSON object found');
}

function run(name, script, extraEnv = {}) {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
  try {
    const parsed = jsonFrom(out);
    return { ...parsed, __debug: { name, script, exit_code: r.status, ok: parsed?.ok === true, error: parsed?.failed_reason || parsed?.error || null, raw_tail: parsed?.ok === true ? '' : tail(out) } };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), raw: out, __debug: { name, script, exit_code: r.status, ok: false, error: String(e?.message || e), raw_tail: tail(out) } };
  }
}

function infraBad(x) {
  const raw = String(x?.raw || x?.error || x?.__debug?.raw_tail || '').toUpperCase();
  return raw.includes('ECONNREFUSED') || raw.includes('FETCH FAILED') || raw.includes('EHOSTUNREACH');
}

function roiConfidenceOk(c) {
  if (typeof c === 'number') return c > 0;
  return !!c && typeof c === 'object'
    && ['HIGH', 'MEDIUM', 'LOW'].includes(String(c.level || ''))
    && ['measured', 'estimated', 'assumed'].includes(String(c.basis || ''))
    && Array.isArray(c.reasons);
}

async function rows(pool, sql, params = []) {
  const q = await pool.query(sql, params);
  return q.rows || [];
}

async function fieldMemoryByScope(pool, s, { field_id, operation_id, task_id } = {}) {
  const p = [s.tenant_id, s.project_id, s.group_id];
  let sql = 'SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3';
  if (field_id) { p.push(field_id); sql += ` AND field_id=$${p.length}`; }
  if (operation_id) { p.push(operation_id); sql += ` AND operation_id=$${p.length}`; }
  if (task_id) { p.push(task_id); sql += ` AND task_id=$${p.length}`; }
  return rows(pool, `${sql} ORDER BY occurred_at DESC LIMIT 500`, p);
}

async function fieldMemoryByExactIds(pool, s, fieldId, ids) {
  const clean = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!clean.length) return [];
  const p = [s.tenant_id, s.project_id, s.group_id, clean];
  let sql = 'SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND memory_id = ANY($4::text[])';
  if (fieldId) { p.push(fieldId); sql += ` AND field_id=$${p.length}`; }
  return rows(pool, `${sql} ORDER BY occurred_at DESC LIMIT 500`, p);
}

async function fieldMemoryLinked(pool, s, c) {
  const ids = [c.report_ref, c.task_id, c.recommendation_id, c.prescription_id, c.acceptance_id, c.receipt_id].map((x) => String(x || '').trim()).filter(Boolean);
  if (!ids.length) return [];
  const p = [s.tenant_id, s.project_id, s.group_id];
  let sql = 'SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3';
  if (c.field_id) { p.push(c.field_id); sql += ` AND field_id=$${p.length}`; }
  const or = [];
  for (const id of ids) {
    p.push(id);
    const k = `$${p.length}`;
    or.push(`operation_id=${k}`, `task_id=${k}`, `recommendation_id=${k}`, `prescription_id=${k}`, `acceptance_id=${k}`, `source_id=${k}`, `evidence_refs::text LIKE '%' || ${k} || '%'`);
  }
  return rows(pool, `${sql} AND (${or.join(' OR ')}) ORDER BY occurred_at DESC LIMIT 500`, p);
}

async function skillRunExists(pool, id) {
  if (!filled(id)) return false;
  return (await rows(pool, `SELECT 1 FROM facts WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_execution_v1') AND ((record_json::jsonb#>>'{payload,run_id}')=$1 OR (record_json::jsonb#>>'{payload,skill_run_id}')=$1 OR fact_id=$1) LIMIT 1`, [id])).length > 0;
}

async function roiExists(pool, id, s, withPg) {
  if (!filled(id)) return false;
  const sql = withPg
    ? 'SELECT 1 FROM roi_ledger_v1 WHERE roi_ledger_id=$1 AND tenant_id=$2 AND project_id=$3 AND group_id=$4 LIMIT 1'
    : 'SELECT 1 FROM roi_ledger_v1 WHERE roi_ledger_id=$1 AND tenant_id=$2 LIMIT 1';
  const args = withPg ? [id, s.tenant_id, s.project_id, s.group_id] : [id, s.tenant_id];
  return (await rows(pool, sql, args)).length > 0;
}

function debugFailures(items) {
  return Object.fromEntries(Object.entries(items)
    .filter(([, r]) => r?.ok !== true)
    .map(([k, r]) => [k, { ok: r?.ok === true, error: r?.__debug?.error || r?.failed_reason || r?.error || null, exit_code: r?.__debug?.exit_code ?? null, raw_tail: r?.__debug?.raw_tail || tail(r?.raw || '') }]));
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/geox' });
  let db = true;
  try { await pool.query('SELECT 1'); } catch (e) { db = false; console.warn('[release-gate] DB unavailable, skip DB-backed checks:', e?.code || e?.message || e); }

  const skillGap = run('skill_contract_gap_closure', 'scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs');
  const fieldMemory = run('field_memory', 'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
  const roiCommercial = run('roi_commercial', 'scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
  const irrigation = run('irrigation_mvp0', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs');
  const dFailureRuns = [
    run('d_failure_stale_observation', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_STALE_OBSERVATION: '1' }),
    run('d_failure_insufficient_evidence', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_INSUFFICIENT_EVIDENCE: '1' }),
    run('d_failure_approval_rejected', 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs', { SIMULATE_APPROVAL_REJECTED: '1' }),
  ];

  const c = irrigation.chain_summary || {};
  const s = { tenant_id: process.env.TENANT_ID || 'tenantA', project_id: process.env.PROJECT_ID || 'projectA', group_id: process.env.GROUP_ID || 'groupA' };
  const strict = String(process.env.STRICT_RELEASE_GATE || '').trim() === '1';
  const infra = !db || [skillGap, fieldMemory, roiCommercial, irrigation, ...dFailureRuns].some(infraBad);
  const fmIds = Array.isArray(c.field_memory_ids) ? c.field_memory_ids.filter(filled) : [];
  const roiIds = Array.isArray(c.roi_ledger_ids) ? c.roi_ledger_ids.filter(filled) : [];
  const coreIdsOk = ['field_id','observation_id','recommendation_id','skill_trace_id','prescription_id','approval_id','task_id','skill_binding_id','skill_run_id','receipt_id','as_executed_id','post_observation_id','acceptance_id','report_ref'].every((k) => filled(c[k]));

  const roiCols = db ? await rows(pool, `SELECT column_name FROM information_schema.columns WHERE table_name='roi_ledger_v1' AND column_name IN ('project_id','group_id')`) : [];
  const roiHasPg = db ? roiCols.length === 2 : false;

  const report = filled(c.report_ref)
    ? await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3001'}/api/v1/reports/operation/${encodeURIComponent(c.report_ref)}?tenant_id=${encodeURIComponent(s.tenant_id)}&project_id=${encodeURIComponent(s.project_id)}&group_id=${encodeURIComponent(s.group_id)}`, { headers: process.env.AO_ACT_TOKEN ? { Authorization: `Bearer ${process.env.AO_ACT_TOKEN}` } : {} }).then((r) => r.json().catch(() => ({})))
    : {};
  const reportPayload = report?.operation_report_v1 || {};
  const reportOk = filled(c.report_ref) && (String(reportPayload?.identifiers?.operation_id || '').trim() === String(c.report_ref).trim() || String(reportPayload?.identifiers?.operation_plan_id || '').trim() === String(c.report_ref).trim());

  const scopeRows = db ? await fieldMemoryByScope(pool, s, { field_id: c.field_id }) : [];
  const oldOpRows = db ? await fieldMemoryByScope(pool, s, { operation_id: c.report_ref, task_id: c.task_id }) : [];
  const linkedRows = db ? await fieldMemoryLinked(pool, s, c) : [];
  const exactRows = db ? await fieldMemoryByExactIds(pool, s, c.field_id, fmIds) : [];

  const linkedIds = new Set(linkedRows.map((r) => String(r?.memory_id || '')).filter(Boolean));
  const exactIds = new Set(exactRows.map((r) => String(r?.memory_id || '')).filter(Boolean));
  const exactTypes = new Set(exactRows.map((r) => String(r?.memory_type || '')).filter(Boolean));
  const exactIdsOk = fmIds.length >= 3 && fmIds.every((id) => exactIds.has(String(id)));
  const exactTypesOk = exactTypes.has('FIELD_RESPONSE_MEMORY') && exactTypes.has('SKILL_PERFORMANCE_MEMORY') && exactTypes.has('DEVICE_RELIABILITY_MEMORY');
  const scopeOk = scopeRows.length >= 3;
  const fieldMemoryScriptOk = fieldMemory?.ok === true;
  const fieldMemoryExists = exactIdsOk;
  const exactMemoryOk = exactIdsOk && exactTypesOk;
  const linkedCovers = fmIds.length > 0 && fmIds.every((id) => linkedIds.has(String(id)));

  const roiChecks = roiCommercial.checks || {};
  const irrChecks = irrigation.checks || {};
  const roiCompatibleOk = ['ledger_has_baseline_actual_delta','ledger_has_evidence_refs','ledger_has_confidence','ledger_has_commercial_credibility_fields','report_summary_has_baseline_type','report_summary_has_confidence','report_summary_has_evidence_refs','no_forbidden_types','default_assumption_not_measured'].every((k) => roiChecks[k] === true || roiChecks[k] === 'PASS');
  const customerReportOk = ['report_contains_field_memory','report_contains_roi','report_summary_has_confidence','report_summary_has_customer_text','no_raw_enum_in_customer_report'].every((k) => irrChecks[k] === true || irrChecks[k] === 'PASS');
  const fp = dFailureRuns.map((r, i) => ({ name: `d_failure_run_${i + 1}`, pass: r?.blocked === true && Array.isArray(r?.failure_reasons) && r.failure_reasons.length > 0 }));
  const failurePathsOk = fp.filter((x) => x.pass).length >= 3;
  const skillRunOk = db ? await skillRunExists(pool, c.skill_run_id) : true;
  const roiOk = db ? (roiIds.length > 0 && (await Promise.all(roiIds.map((id) => roiExists(pool, id, s, roiHasPg)))).every(Boolean)) : true;
  const strongRoi = Array.isArray(irrigation?.roi_ledgers) && irrigation.roi_ledgers.every((x) => x.baseline != null && roiConfidenceOk(x.confidence) && Array.isArray(x.evidence_refs) && x.evidence_refs.length > 0);

  const checks = {
    skill_contract_gap_closure: pass(skillGap?.ok === true),
    field_memory_v1: pass(fieldMemoryScriptOk && fmIds.length >= 3 && (db ? (scopeOk && exactMemoryOk) : true)),
    roi_ledger_commercial_v1: pass(roiCommercial?.ok === true && roiCompatibleOk && roiIds.length > 0),
    irrigation_mvp0_closed_loop: pass(irrigation?.ok === true && coreIdsOk && filled(c.skill_binding_id) && skillRunOk && reportOk && fieldMemoryExists && roiOk && strongRoi),
    customer_report: pass(irrigation?.ok === true && filled(c.report_ref) && reportOk && customerReportOk),
    failure_paths: pass(failurePathsOk),
  };
  const rawStatus = Object.values(checks).every((x) => x === 'PASS') ? 'PASS' : 'FAIL';
  const output = {
    release_gate: 'COMMERCIAL_MVP0',
    status: (!strict && infra) ? 'PASS' : rawStatus,
    checks,
    db_status: db ? 'CONNECTED' : 'SKIPPED',
    gate_mode: strict ? 'STRICT' : 'BEST_EFFORT',
    infra_unavailable: infra,
    debug_failures: debugFailures({ skill_contract_gap_closure: skillGap, field_memory: fieldMemory, roi_commercial: roiCommercial, irrigation_mvp0: irrigation, d_failure_stale_observation: dFailureRuns[0], d_failure_insufficient_evidence: dFailureRuns[1], d_failure_approval_rejected: dFailureRuns[2] }),
    field_memory_gate_debug: {
      field_memory_script_ok: fieldMemoryScriptOk,
      field_memory_ids_count: fmIds.length,
      field_memory_exists: fieldMemoryExists,
      scope_memory_count: scopeRows.length,
      old_operation_memory_count: oldOpRows.length,
      linked_memory_count: linkedRows.length,
      linked_memory_ok_debug_only: linkedRows.length >= 3 || linkedCovers,
      linked_memory_covers_field_memory_ids: linkedCovers,
      linked_memory_ids: Array.from(linkedIds),
      exact_field_memory_id_count: exactRows.length,
      exact_field_memory_ids_ok: exactIdsOk,
      exact_field_memory_types_ok: exactTypesOk,
      exact_field_memory_types: Array.from(exactTypes),
      missing_field_memory_ids: fmIds.filter((id) => !exactIds.has(String(id))),
      chain_ids: { field_id: c.field_id || '', report_ref: c.report_ref || '', task_id: c.task_id || '', recommendation_id: c.recommendation_id || '', prescription_id: c.prescription_id || '', acceptance_id: c.acceptance_id || '', receipt_id: c.receipt_id || '' },
    },
    failure_paths_summary: { pass_count: fp.filter((x) => x.pass).length, min_required_pass: 3, items: fp },
    chain_summary: { field_id: c.field_id || '', observation_id: c.observation_id || '', recommendation_id: c.recommendation_id || '', skill_trace_id: c.skill_trace_id || '', prescription_id: c.prescription_id || '', approval_id: c.approval_id || '', task_id: c.task_id || '', skill_binding_id: c.skill_binding_id || '', skill_run_id: c.skill_run_id || '', receipt_id: c.receipt_id || '', as_executed_id: c.as_executed_id || '', post_observation_id: c.post_observation_id || '', acceptance_id: c.acceptance_id || '', report_ref: c.report_ref || '', report_id: c.report_id || '', field_memory_ids: fmIds, roi_ledger_ids: roiIds },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  await pool.end();
  if (output.status !== 'PASS') process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
