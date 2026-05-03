const { spawnSync } = require('node:child_process');

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

function runScript(script) {
  const res = spawnSync(process.execPath, [script], { encoding: 'utf8', env: process.env });
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

(() => {
  const skillGap = runScript('scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs');
  const fieldMemory = runScript('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
  const roiCommercial = runScript('scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
  const irrigation = runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs');

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
  const failurePathsPassCount = Array.isArray(fp)
    ? fp.filter((x) => x && (x.blocked === true || isPass(x.status))).length
    : 0;
  const failurePathsOk = failurePathsPassCount >= 3 && (irrigationChecks.failure_path_not_fake_success === true || irrigationChecks.failure_path_not_fake_success === 'PASS');

  const checks = {
    skill_contract_gap_closure: pass(skillGap?.ok === true),
    field_memory_v1: pass(fieldMemory?.ok === true && fieldMemoryIds.length >= 3),
    roi_ledger_commercial_v1: pass(roiCommercial?.ok === true && roiCompatibleOk && roiLedgerIds.length > 0),
    irrigation_mvp0_closed_loop: pass(irrigation?.ok === true && coreIdsOk),
    customer_report: pass(irrigation?.ok === true && isFilled(chain.report_id) && customerReportOk),
    failure_paths: pass(failurePathsOk),
  };

  const output = {
    release_gate: 'COMMERCIAL_MVP0',
    status: Object.values(checks).every((x) => x === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    failure_paths_summary: {
      pass_count: failurePathsPassCount,
      min_required_pass: 3,
      items: Array.isArray(fp) ? fp : [],
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
  if (output.status !== 'PASS') process.exit(1);
})();
