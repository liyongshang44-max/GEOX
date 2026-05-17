import { mapGuardedReportCode } from "../api/reports";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText } from "./customerTrustGate";
import { failSafeStatusLabel, manualTakeoverStatusLabel, scenarioTypeLabel } from "./customerScenarioLabels";

export type FormalScenarioVm = {
  scenarioLabel: string;
  chainText: string;
  evidenceText: string;
  acceptanceText: string;
  failSafeText?: string;
  manualTakeoverText?: string;
  zoneSummaryText?: string;
  roiTrustText: string;
  memoryTrustText: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

function zoneSummaryText(value: any): string | undefined {
  const zones = Array.isArray(value?.zone_matrix) ? value.zone_matrix : [];
  if (!zones.length) return undefined;
  const pass = zones.filter((z: any) => String(z?.zone_acceptance_result ?? "").toUpperCase() === "PASS").length;
  return `分区验收：${pass}/${zones.length} 通过`;
}

export function buildFormalScenarioVm(reportOrOperation: any): FormalScenarioVm {
  const scenario = reportOrOperation?.formal_scenario ?? {};
  const scenarioLabel = scenarioTypeLabel(scenario.scenario_type ?? reportOrOperation?.scenario_type);
  const chainText = customerGuardedStatusText(reportOrOperation);
  const evidenceText = customerGuardedEvidenceText(reportOrOperation);
  const acceptanceText = customerGuardedAcceptanceText(reportOrOperation);
  const finalMapped = mapGuardedReportCode(reportOrOperation?.execution?.final_status ?? reportOrOperation?.final_status, reportOrOperation);
  const tone: FormalScenarioVm["tone"] = finalMapped.tone === "danger" ? "danger" : finalMapped.tone === "success" ? "success" : "warning";
  const failSafeText = reportOrOperation?.fail_safe?.status ? failSafeStatusLabel(reportOrOperation.fail_safe.status) : undefined;
  const manualTakeoverText = reportOrOperation?.manual_takeover?.status ? manualTakeoverStatusLabel(reportOrOperation.manual_takeover.status) : undefined;
  return {
    scenarioLabel,
    chainText,
    evidenceText,
    acceptanceText,
    failSafeText,
    manualTakeoverText,
    zoneSummaryText: zoneSummaryText(reportOrOperation),
    roiTrustText: scenario?.customer_visible_eligible === true ? "价值结论可对客展示" : "价值结论需复核后展示",
    memoryTrustText: scenario?.customer_visible_eligible === true ? "学习结论可对客展示" : "学习结论需复核后展示",
    tone,
  };
}
