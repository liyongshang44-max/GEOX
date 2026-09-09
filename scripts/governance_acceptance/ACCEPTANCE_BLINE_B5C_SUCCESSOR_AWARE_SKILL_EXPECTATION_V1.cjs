const fs = require('node:fs');

const TASK = 'BLINE_B5C_SUCCESSOR_AWARE_SKILL_EXPECTATION_V1';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function pass(v) {
  return v ? 'PASS' : 'FAIL';
}

function blockBetween(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) return '';
  return text.slice(start, end);
}

const gapPath = 'scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs';
const loopPath = 'scripts/agronomy_acceptance/ACCEPTANCE_IRRIGATION_CLOSED_LOOP_V1.cjs';
const judgePath = 'apps/server/src/domain/judge/agronomy_judge_v2.test.ts';
const decisionPath = 'apps/server/src/routes/decision_engine_v1.ts';

const gap = read(gapPath);
const loop = read(loopPath);
const judge = read(judgePath);
const decision = read(decisionPath);

const selector = blockBetween(
  gap,
  'function pickIrrigationRecommendation(genJson) {',
  '\n}\n\nfunction buildIrrigationReceiptBody'
);

const checks = {
  gap_selector_primary_requirement: pass(
    selector.includes("String(x?.skill_trace?.skill_id ?? '') === 'irrigation_requirement_skill_v1'")
  ),
  gap_selector_not_primary_deficit: pass(
    selector.length > 0 && !selector.includes("String(x?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'")
  ),
  gap_primary_assertion_requirement: pass(
    gap.includes("checks.recommendation_has_skill_trace = toPassFail(String(recommendation.skill_trace.skill_id ?? '') === 'irrigation_requirement_skill_v1' && ids.skill_trace_id.length > 0);")
  ),
  gap_deficit_registry_contract_preserved: pass(
    gap.includes("irrigation_deficit_skill_query_or_register")
      && gap.includes('/api/v1/skills/irrigation_deficit_skill_v1?')
  ),
  gap_deficit_supporting_receipt_preserved: pass(
    gap.includes("skill_id: 'irrigation_deficit_skill_v1', skill_trace_ref")
  ),
  gap_deficit_supporting_roi_preserved: pass(
    gap.includes("skill_refs: [{ skill_id: 'irrigation_deficit_skill_v1', trace_id: ids.skill_trace_id || undefined }]")
  ),

  loop_primary_assertion_requirement: pass(
    loop.includes("assert.equal(recommendationTraceFieldChecks.skill_id, 'irrigation_requirement_skill_v1', 'recommendation.skill_trace.skill_id mismatch');")
  ),
  loop_result_key_requirement: pass(
    loop.includes("skill_trace_skill_id_is_irrigation_requirement: String(recommendationSkillTrace?.skill_id ?? '') === 'irrigation_requirement_skill_v1'")
  ),
  loop_old_primary_result_key_removed: pass(
    !loop.includes('skill_trace_skill_id_is_irrigation_deficit:')
  ),
  loop_prescription_primary_requirement_or_trace_ref: pass(
    loop.includes("prescription_inherits_skill_trace: Boolean((prescriptionSkillTrace && String(prescriptionSkillTrace?.skill_id ?? '') === 'irrigation_requirement_skill_v1') || prescriptionSkillTraceRef.length > 0)")
  ),
  loop_deficit_supporting_roi_preserved: pass(
    loop.includes("skill_id: 'irrigation_deficit_skill_v1',")
      && loop.includes('roi-ledger/from-as-executed')
  ),
  loop_deficit_supporting_memory_preserved: pass(
    loop.includes("String(r.skill_id ?? '') === 'irrigation_deficit_skill_v1'")
      && loop.includes("String(r.memory_type ?? '') === 'SKILL_PERFORMANCE_MEMORY'")
  ),

  successor_judge_primary_requirement: pass(
    judge.includes('assert.equal((result.outputs as any).skill_id, "irrigation_requirement_skill_v1");')
  ),
  successor_judge_supporting_deficit: pass(
    judge.includes('assert.equal((result.outputs as any).supporting_skill_id, "irrigation_deficit_skill_v1");')
  ),
  successor_decision_primary_requirement: pass(
    decision.includes('skill_id: "irrigation_requirement_skill_v1"')
  ),
};

const ok = Object.values(checks).every((v) => v === 'PASS');

process.stdout.write(`${JSON.stringify({ ok, task: TASK, checks }, null, 2)}\n`);
if (!ok) process.exitCode = 1;
