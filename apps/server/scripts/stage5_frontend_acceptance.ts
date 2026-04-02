import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgramDetailViewModel } from "../../web/src/viewmodels/programDetailViewModel";
import { buildOperationDetailViewModel } from "../../web/src/viewmodels/operationDetailViewModel";

function runViewModelChecks(): void {
  const programVm = buildProgramDetailViewModel({
    programId: "p1",
    controlPlane: { program: { field_id: "field_1", crop_code: "corn" } },
    detail: {
      crop_code: "corn",
      crop_name: "玉米",
      crop_stage: "vegetative",
      latest_recommendation: {
        crop_stage: "vegetative",
        summary: "土壤湿度偏低，建议灌溉",
        rule_hit: [{ rule_id: "corn_vegetative_irrigation_v1", matched: true }],
        reason_codes: ["soil_moisture_below_optimal"],
        current_metrics: { soil_moisture: 18, temperature: 30, humidity: 48 },
        updated_at: new Date().toISOString(),
      },
      recommendations: [
        {
          crop_stage: "vegetative",
          action_type: "IRRIGATE",
          summary: "建议灌溉",
          updated_ts_ms: Date.now(),
          rule_id: "corn_vegetative_irrigation_v1",
          reason_codes: ["soil_moisture_below_optimal"],
          risk_if_not_execute: "缺水风险",
          priority: "high",
        },
      ],
    },
    ops: [],
  });

  assert.ok(programVm.programAgronomy);
  assert.ok(programVm.currentMetrics);
  assert.ok(Array.isArray(programVm.activeRules));
  assert.ok(Array.isArray(programVm.recentRecommendations));
  assert.notEqual(programVm.programAgronomy.cropStage, "-");
  if (programVm.activeRules.length > 0) {
    assert.notEqual(programVm.activeRules[0].ruleId, "暂无数据");
  }

  const opVm = buildOperationDetailViewModel({
    detail: {
      operation_plan_id: "op_1",
      task: { action_type: "IRRIGATE", task_id: "t1", dispatched_at: new Date().toISOString() },
      recommendation: { recommendation_id: "rec_1", reason_codes: ["soil_moisture_below_optimal"], summary: "建议灌溉" },
      agronomy: {
        crop_code: "corn",
        crop_stage: "vegetative",
        rule_id: "corn_vegetative_irrigation_v1",
        reason_codes: ["soil_moisture_below_optimal"],
        risk_if_not_execute: "减产风险",
        expected_effect: { type: "moisture_increase", value: 10 },
        actual_effect: { value: 9 },
        before_metrics: { soil_moisture: 18 },
        after_metrics: { soil_moisture: 27 },
        effect_verdict: "EFFECTIVE",
      },
      business_effect: { risk_if_not_execute: "减产风险", expected_impact: "水分恢复", estimated_gain: "提升产量" },
    },
  });

  assert.ok(opVm.agronomyDecision);
  assert.ok(opVm.expectedEffectCard);
  assert.ok(opVm.effectEvaluation);
  assert.notEqual(opVm.agronomyDecision.ruleId, "-");
  assert.notEqual(opVm.agronomyDecision.cropStageLabel, "-");
  assert.notEqual(opVm.expectedEffectCard.effectTypeLabel, "-");
  assert.notEqual(opVm.expectedEffectCard.effectValueLabel, "-");
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

function runDashboardSmokeChecks(): void {
  const dashboardPage = readFileSync(resolve(repoRoot, "apps/web/src/views/CommercialDashboardPage.tsx"), "utf8");
  assert.ok(dashboardPage.includes("农学建议"));
  assert.ok(dashboardPage.includes("当前阶段分布"));
  assert.ok(dashboardPage.includes("效果反馈摘要"));

  const dashboardHook = readFileSync(resolve(repoRoot, "apps/web/src/hooks/useDashboard.ts"), "utf8");
  assert.ok(dashboardHook.includes("agronomyRecommendations"));
  assert.ok(dashboardHook.includes("cropStageDistribution"));
  assert.ok(dashboardHook.includes("effectSummary"));
}

runViewModelChecks();
runDashboardSmokeChecks();
console.log("stage5 frontend acceptance checks passed");
