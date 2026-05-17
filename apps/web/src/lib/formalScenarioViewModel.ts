import { mapGuardedReportCode } from "../api/reports";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText } from "./customerTrustGate";
import { failSafeStatusLabel, manualTakeoverStatusLabel, scenarioTypeLabel } from "./customerScenarioLabels";

function customerText(value: unknown, fallback = "暂无记录"): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

export type FormalScenarioVm = {
  scenarioKey: string;
  scenarioLabel: string;
  chainText: string;
  evidenceText: string;
  acceptanceText: string;
  failSafeText?: string;
  manualTakeoverText?: string;
  zoneSummaryText?: string;
  roiTrustText: string;
  memoryTrustText: string;
  deviceStatusText?: string;
  executionGuardText?: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

function scenarioKeyOf(reportOrOperation: any): string {
  return String(reportOrOperation?.formal_scenario?.scenario_type ?? reportOrOperation?.scenario_type ?? "").trim().toUpperCase();
}

function zoneSummaryText(value: any): string | undefined {
  const zones = Array.isArray(value?.zone_matrix) ? value.zone_matrix : [];
  if (!zones.length) return undefined;
  const pass = zones.filter((z: any) => String(z?.zone_acceptance_result ?? "").toUpperCase() === "PASS").length;
  return `分区验收：${pass}/${zones.length} 通过`;
}

export function buildFormalScenarioVm(reportOrOperation: any): FormalScenarioVm {
  const scenario = reportOrOperation?.formal_scenario ?? {};
  const scenarioKey = scenarioKeyOf(reportOrOperation);
  const scenarioLabel = scenarioTypeLabel(scenario.scenario_type ?? reportOrOperation?.scenario_type);
  const chainText = customerGuardedStatusText(reportOrOperation);
  const evidenceText = customerGuardedEvidenceText(reportOrOperation);
  const acceptanceText = customerGuardedAcceptanceText(reportOrOperation);
  const finalMapped = mapGuardedReportCode(reportOrOperation?.execution?.final_status ?? reportOrOperation?.final_status, reportOrOperation);
  const tone: FormalScenarioVm["tone"] = finalMapped.tone === "danger" ? "danger" : finalMapped.tone === "success" ? "success" : "warning";
  const failSafeText = reportOrOperation?.fail_safe?.status ? failSafeStatusLabel(reportOrOperation.fail_safe.status) : undefined;
  const manualTakeoverText = reportOrOperation?.manual_takeover?.status ? manualTakeoverStatusLabel(reportOrOperation.manual_takeover.status) : undefined;
  const deviceStatusText = scenarioKey === "DEVICE_ANOMALY" ? `设备状态：${customerText(reportOrOperation?.device_status ?? reportOrOperation?.device?.status ?? "未知", "未知")}` : undefined;
  const executionGuardText = scenarioKey === "DEVICE_ANOMALY" ? "设备异常场景下，不对客户展示“执行成功”结论，需先完成人工复核。" : undefined;
  return {
    scenarioKey,
    scenarioLabel,
    chainText,
    evidenceText,
    acceptanceText,
    failSafeText,
    manualTakeoverText,
    zoneSummaryText: zoneSummaryText(reportOrOperation),
    roiTrustText: scenario?.customer_visible_eligible === true ? "价值结论可对客展示" : "价值结论需复核后展示",
    memoryTrustText: scenario?.customer_visible_eligible === true ? "学习结论可对客展示" : "学习结论需复核后展示",
    deviceStatusText,
    executionGuardText,
    tone,
  };
}
