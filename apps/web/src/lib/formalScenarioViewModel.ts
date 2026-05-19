import { mapGuardedReportCode } from "../api/reports";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText } from "./customerTrustGate";
import {
  customerEvidenceGapText,
  customerReasonText,
  failSafeStatusLabel,
  fertilizationCustomerSummaryText,
  manualTakeoverStatusLabel,
  pestDiseaseInspectionCustomerSummaryText,
  scenarioTypeLabel,
} from "./customerScenarioLabels";

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
  fertilizationSummaryText?: string;
  pestDiseaseSummaryText?: string;
  tone: "success" | "warning" | "danger" | "neutral";
  customerReasonSummary: string;
  customerBlockingReasons: string[];
};

function scenarioKeyOf(reportOrOperation: any): string {
  return String(reportOrOperation?.formal_scenario?.scenario_type ?? reportOrOperation?.scenario_type ?? "").trim().toUpperCase();
}


function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

function collectBlockingReasons(reportOrOperation: any): string[] {
  const scenarioReasons = asList(reportOrOperation?.formal_scenario?.blocking_reasons);
  const samplingReasons = asList(reportOrOperation?.sampling?.blocking_reasons);
  const fertilizationReasons = asList(reportOrOperation?.fertilization?.blocking_reasons);
  const missingItems = asList(reportOrOperation?.acceptance?.missing_items);
  const chainReasons = asList(reportOrOperation?.chain_validation?.blocking_reasons);
  return [...scenarioReasons, ...samplingReasons, ...fertilizationReasons, ...missingItems, ...chainReasons]
    .map((x) => (x.startsWith("missing:") ? customerEvidenceGapText(x) : customerReasonText(x)))
    .filter(Boolean);
}


function samplingSummaryText(value: any): string | undefined {
  const sampling = value?.sampling ?? {};
  const lab = String(sampling?.lab_result_status ?? "").toUpperCase();
  const acc = String(sampling?.acceptance_status ?? "").toUpperCase();
  const simulated = asList(sampling?.blocking_reasons).some((x) => String(x).toLowerCase().includes("simulated"));
  if (lab === "INVALID" || lab === "NEEDS_REVIEW") return "采样已完成，但实验室结果未通过质量校验 → 需复核";
  if (simulated) return "采样记录来自模拟链路 → 不作为客户结论";
  if (lab === "PASS" && (acc === "MISSING" || acc === "FAIL")) return "实验室结果已导入，但缺少采样回执 → 证据不足";
  if (lab === "PASS" && acc === "PASS") return "采样与实验室结果均通过 → 可作为农艺判断依据";
  return undefined;
}

function zoneSummaryText(value: any): string | undefined {
  const fertilizationZones = Array.isArray(value?.fertilization?.zone_rates) ? value.fertilization.zone_rates : [];
  if (fertilizationZones.length) {
    const pass = fertilizationZones.filter((z: any) => String(z?.result ?? "").toUpperCase() === "PASS").length;
    const fail = fertilizationZones.filter((z: any) => String(z?.result ?? "").toUpperCase() === "FAIL").length;
    return `施氮分区验收：${pass}/${fertilizationZones.length} 通过${fail > 0 ? "，存在偏差分区" : ""}`;
  }
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
  const fertilization = reportOrOperation?.fertilization ?? null;
  const pestDiseaseInspection = reportOrOperation?.pest_disease_inspection ?? null;
  const fertilizationSummaryText = scenarioKey === "FORMAL_FERTILIZATION" || fertilization ? fertilizationCustomerSummaryText(fertilization) : undefined;
  const pestDiseaseInspectionSummaryText = scenarioKey === "FORMAL_PEST_DISEASE_INSPECTION" || pestDiseaseInspection
    ? pestDiseaseInspectionCustomerSummaryText(pestDiseaseInspection)
    : undefined;
  const tone: FormalScenarioVm["tone"] = fertilization?.acceptance_status === "FAIL"
    ? "danger"
    : fertilization?.acceptance_status === "NEEDS_REVIEW"
      ? "warning"
      : finalMapped.tone === "danger" ? "danger" : finalMapped.tone === "success" ? "success" : "warning";
  const failSafeText = reportOrOperation?.fail_safe?.status ? failSafeStatusLabel(reportOrOperation.fail_safe.status) : undefined;
  const manualTakeoverText = reportOrOperation?.manual_takeover?.status ? manualTakeoverStatusLabel(reportOrOperation.manual_takeover.status) : undefined;
  const deviceStatusText = scenarioKey === "DEVICE_ANOMALY" ? `设备状态：${customerText(reportOrOperation?.device_status ?? reportOrOperation?.device?.status ?? "未知", "未知")}` : undefined;
  const executionGuardText = scenarioKey === "DEVICE_ANOMALY" ? "设备异常场景下，不对客户展示“执行成功”结论，需先完成人工复核。" : undefined;
  const customerBlockingReasons = collectBlockingReasons(reportOrOperation);
  const customerReasonSummary = pestDiseaseInspectionSummaryText ?? fertilizationSummaryText ?? customerBlockingReasons[0] ?? "正式链路信息已记录，当前无额外阻塞说明。";
  return {
    scenarioKey,
    scenarioLabel,
    chainText,
    evidenceText,
    acceptanceText,
    failSafeText,
    manualTakeoverText,
    zoneSummaryText: samplingSummaryText(reportOrOperation) ?? zoneSummaryText(reportOrOperation),
    roiTrustText: scenario?.customer_visible_eligible === true ? "价值结论可对客展示" : "价值结论暂不展示：缺少正式验收结果。",
    memoryTrustText: scenario?.customer_visible_eligible === true ? "学习结论可对客展示" : "学习结论暂不展示：缺少正式田块响应验证。",
    deviceStatusText,
    executionGuardText,
    fertilizationSummaryText,
    pestDiseaseSummaryText: pestDiseaseInspectionSummaryText,
    tone,
    customerReasonSummary,
    customerBlockingReasons,
  };
}
