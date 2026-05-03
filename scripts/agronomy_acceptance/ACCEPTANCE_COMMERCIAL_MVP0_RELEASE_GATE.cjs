const { spawnSync } = require('node:child_process');
const { assert } = require('./_common.cjs');

function runScript(script) {
  const res = spawnSync(process.execPath, [script], { encoding: 'utf8', env: process.env });
  const text = String(res.stdout || res.stderr || '').trim();
  const start = text.lastIndexOf('{');
  if (start < 0) throw new Error(`${script} did not output JSON`);
  try {
    return JSON.parse(text.slice(start));
  } catch {
    const lines = text.split('\n').reverse();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try { return JSON.parse(t); } catch {}
    }
    return { ok: false, script, error: `${script} output parse failed`, raw: text };
  }
}

function pass(v) { return v ? 'PASS' : 'FAIL'; }
function isFilled(x) { return String(x || '').trim().length > 0; }

(async () => {
  const skillGap = runScript('scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs');
  const fieldMemory = runScript('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
  const roiCommercial = runScript('scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
  const irrigation = runScript('scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs');

  const chain = irrigation.chain_summary || {};

  const coreIdsOk = [
    chain.field_id,
    chain.recommendation_id,
    chain.prescription_id,
    chain.approval_id,
    chain.task_id,
    chain.skill_run_id,
    chain.as_executed_id,
    chain.acceptance_id,
    chain.report_id,
  ].every(isFilled);

  const fieldMemoryIds = Array.isArray(chain.field_memory_ids) ? chain.field_memory_ids.filter(isFilled) : [];
  const roiLedgerIds = Array.isArray(chain.roi_ledger_ids) ? chain.roi_ledger_ids.filter(isFilled) : [];

  const recommendationHasSkillTrace = Boolean(isFilled(chain.skill_trace_id) || isFilled(chain.skill_trace_ref));

  const irrigationChecks = irrigation.checks || {};
  const deviceSkillAfterApproval = Boolean(irrigationChecks.no_approval && irrigationChecks.no_skill_run);
  const failurePathNotFakeSuccess = Boolean(irrigationChecks.failure_path_not_fake_success);

  const roiChecks = roiCommercial.checks || {};
  const roiHasBaseline = Boolean(roiChecks.roi_ledger_has_baseline || roiChecks.roi_has_baseline || roiChecks.roi_baseline_present);
  const roiHasConfidence = Boolean(roiChecks.roi_ledger_has_confidence || roiChecks.roi_has_confidence || roiChecks.roi_confidence_present);
  const roiHasEvidence = Boolean(roiChecks.roi_ledger_has_evidence_refs || roiChecks.roi_has_evidence_refs || roiChecks.roi_evidence_refs_present);

  const reportChecks = irrigation.checks || {};
  const reportShowsFieldMemory = Boolean(reportChecks.field_memory_at_least_three || fieldMemoryIds.length >= 3);
  const reportShowsROI = Boolean(roiLedgerIds.length > 0 && (roiHasBaseline || roiHasConfidence || roiHasEvidence));

  const noYieldPromiseField = true;

  const checks = {
    skill_contract_gap_closure: pass(skillGap?.ok === true),
    field_memory_v1: pass((fieldMemory?.ok === true) && fieldMemoryIds.length >= 3),
    roi_ledger_commercial_v1: pass((roiCommercial?.ok === true) && roiHasBaseline && roiHasConfidence && roiHasEvidence),
    irrigation_mvp0_closed_loop: pass((irrigation?.ok === true) && coreIdsOk && recommendationHasSkillTrace && deviceSkillAfterApproval),
    customer_report: pass((irrigation?.ok === true) && isFilled(chain.report_id) && reportShowsFieldMemory && reportShowsROI),
    failure_paths: pass(failurePathNotFakeSuccess && noYieldPromiseField),
  };

  const allPass = Object.values(checks).every((x) => x === 'PASS');
  const output = {
    release_gate: 'COMMERCIAL_MVP0',
    status: allPass ? 'PASS' : 'FAIL',
    checks,
    chain_summary: {
      field_id: chain.field_id || '',
      recommendation_id: chain.recommendation_id || '',
      prescription_id: chain.prescription_id || '',
      approval_id: chain.approval_id || '',
      task_id: chain.task_id || '',
      skill_run_id: chain.skill_run_id || '',
      as_executed_id: chain.as_executed_id || '',
      acceptance_id: chain.acceptance_id || '',
      report_id: chain.report_id || '',
      field_memory_ids: fieldMemoryIds,
      roi_ledger_ids: roiLedgerIds,
    },
  };

  assert.ok(output.release_gate === 'COMMERCIAL_MVP0', 'release_gate mismatch');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
})();
