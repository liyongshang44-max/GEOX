import { mapGuardedReportCode } from "../api/reports";
import { customerGuardedAcceptanceText, customerGuardedEvidenceText, customerGuardedStatusText, isCustomerFormalChainPassed } from "./customerTrustGate";
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

export type FormalScenarioClosureStepV1 = {
  key: string;
  label: string;
  status: "PASS" | "NEEDS_REVIEW" | "BLOCKED";
  text: string;
};

export type FormalScenarioVm = {
  scenarioKey: string;
  scenarioLabel: string;
  chainText: string;
  evidenceText: string;
  acceptanceText: string;
  closureSteps: FormalScenarioClosureStepV1[];
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
  rawScenarioType: string;
  formalChainStatus: string;
  rawEvidenceStatus: string;
  needsReview: boolean;
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
  const pestDiseaseReasons = asList(reportOrOperation?.pest_disease_inspection?.blocking_reasons);
  const missingItems = asList(reportOrOperation?.acceptance?.missing_items);
  const chainReasons = asList(reportOrOperation?.chain_validation?.blocking_reasons);
  return [
    ...scenarioReasons,
    ...samplingReasons,
    ...fertilizationReasons,
    ...pestDiseaseReasons,
    ...missingItems,
    ...chainReasons,
  ]
    .map((x) => (x.startsWith("missing:") ? customerEvidenceGapText(x) : customerReasonText(x)))
    .filter(Boolean);
}

function sourceRefsOf(reportOrOperation: any): string[] {
  return asList(reportOrOperation?.formal_scenario?.source_refs);
}

function sourceRefsInclude(refs: string[], ...needles: string[]): boolean {
  const haystack = refs.join("|").toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function formalChainStatusOf(reportOrOperation: any): "PASSED" | "NEEDS_REVIEW" | "BLOCKED" {
  const raw = String(reportOrOperation?.formal_scenario?.formal_chain_status ?? reportOrOperation?.chain_status ?? "").trim().toUpperCase();
  if (raw === "PASSED") return "PASSED";
  if (raw === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  return "BLOCKED";
}

function closureStatus(params: { refs: string[]; report: any; passed: boolean; needles: string[]; fallbackPass?: boolean }): FormalScenarioClosureStepV1["status"] {
  if (params.passed && (params.fallbackPass || sourceRefsInclude(params.refs, ...params.needles))) return "PASS";
  if (params.report?.formal_scenario?.needs_review === true || formalChainStatusOf(params.report) === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  return "BLOCKED";
}

function closureText(status: FormalScenarioClosureStepV1["status"]): string {
  if (status === "PASS") return "已闭合";
  if (status === "NEEDS_REVIEW") return "需复核";
  return "未闭合";
}

function buildClosureSteps(reportOrOperation: any): FormalScenarioClosureStepV1[] {
  const refs = sourceRefsOf(reportOrOperation);
  const chainPassed = isCustomerFormalChainPassed(reportOrOperation);
  const stepDefs: Array<{ key: string; label: string; needles: string[]; fallbackPass?: boolean }> = [
    { key: "stage1_evidence", label: "Stage-1 evidence", needles: ["stage1", "evidence:formal_passed"], fallbackPass: reportOrOperation?.formal_scenario?.evidence_status === "FORMAL_EVIDENCE_PASSED" },
    { key: "diagnosis", label: "Diagnosis / problem state", needles: ["problem_state", "diagnosis"] },
    { key: "recommendation", label: "Recommendation", needles: ["recommendation:"] },
    { key: "prescription", label: "Prescription", needles: ["prescription:"] },
    { key: "approval", label: "Approval", needles: ["approval:"] },
    { key: "ao_act_task", label: "AO-ACT task", needles: ["ao_act_task:", "task:"] },
    { key: "receipt", label: "Receipt", needles: ["receipt:"] },
    { key: "formal_acceptance", label: "Formal acceptance", needles: ["acceptance:"] },
    { key: "roi_trust_lane", label: "ROI trust lane", needles: ["roi:"] },
    { key: "field_memory_lane", label: "Field Memory lane", needles: ["field_memory:"] },
  ];

  return stepDefs.map((step) => {
    const status = closureStatus({ refs, report: reportOrOperation, passed: chainPassed, needles: step.needles, fallbackPass: step.fallbackPass });
    return { key: step.key, label: step.label, status, text: closureText(status) };
  });
}

function roiTrustLaneText(reportOrOperation: any): string {
  const scenario = reportOrOperation?.formal_scenario ?? {};
  const roi = reportOrOperation?.roi_ledger ?? reportOrOperation?.roi ?? {};
  const trust = String(roi?.trust_level ?? roi?.summary?.trust_level ?? scenario?.roi_trust_lane ?? scenario?.trust_level ?? "").trim().toUpperCase();
  const valueType = String(roi?.value_type ?? roi?.value_kind ?? roi?.projection?.value_type ?? roi?.projection?.projection_basis ?? roi?.hypothesis?.value_type ?? "").trim().toUpperCase();
  if (isCustomerFormalChainPassed(reportOrOperation) && (trust === "FORMAL_ACCEPTED" || trust === "FORMAL_CHAIN_PASSED")) return "ROI trust lane：trusted / 正式可信价值，可对客展示。";
  if (trust.includes("ESTIMATE") || valueType.includes("ESTIMATE") || valueType.includes("PROJECTION")) return "ROI trust lane：estimate / 估算线索，需正式验收后才可作为可信收益。";
  if (trust.includes("HYPOTHESIS") || valueType.includes("HYPOTHESIS") || valueType.includes("ASSUMPTION")) return "ROI trust lane：hypothesis / 假设线索，不作为销售收益结论。";
  return "ROI trust lane：insufficient evidence / 证据不足，暂不展示收益结论。";
}

function memoryTrustLaneText(reportOrOperation: any): string {
  const memory = reportOrOperation?.field_memory ?? reportOrOperation?.field_memory_summary ?? {};
  const lane = String(memory?.memory_lane ?? memory?.trust_lane ?? memory?.trust_level ?? reportOrOperation?.formal_scenario?.field_memory_lane ?? "").trim().toUpperCase();
  if (isCustomerFormalChainPassed(reportOrOperation) && (memory?.customer_visible_memory === true || memory?.learning_eligible === true || lane === "FORMAL_FIELD_MEMORY" || lane === "FORMAL_ACCEPTED")) return "Field Memory trust lane：formal memory / 正式记忆，可进入客户学习闭环。";
  if (lane.includes("SIMULATED") || reportOrOperation?.is_simulated === true) return "Field Memory trust lane：simulated memory / 模拟记忆，不进入客户学习闭环。";
  if (lane.includes("TECHNICAL") || lane.includes("DIAGNOSTIC") || memory?.technical_memory === true) return "Field Memory trust lane：technical memory / 技术记忆，仅供内部排障。";
  return "Field Memory trust lane：technical memory / 未通过正式学习门禁，仅作技术线索。";
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
  const pestDiseaseInspection = value?.pest_disease_inspection ?? null;
  if (pestDiseaseInspection) {
    const mediaCount = Number(pestDiseaseInspection.media_count ?? 0);
    const geoText = pestDiseaseInspection.geo_evidence_present ? "有定位" : "缺定位";
    const reviewText = pestDiseaseInspection.reviewed_by_human ? "已人工复核" : "待人工复核";
    return `巡检证据：图片/媒体 ${mediaCount} 条，${geoText}，${reviewText}`;
  }
  const zones = Array.isArray(value?.zone_matrix) ? value.zone_matrix : [];
  if (!zones.length) return undefined;
  const pass = zones.filter((z: any) => String(z?.zone_acceptance_result ?? "").toUpperCase() === "PASS").length;
  return `分区验收：${pass}/${zones.length} 通过`;
}

export function buildFormalScenarioVm(reportOrOperation: any): FormalScenarioVm {
  const scenario = reportOrOperation?.formal_scenario ?? {};
  const scenarioKey = scenarioKeyOf(reportOrOperation);
  const rawScenarioType = scenarioKey;
  const scenarioLabel = scenarioTypeLabel(scenario.scenario_type ?? reportOrOperation?.scenario_type);
  const chainText = customerGuardedStatusText(reportOrOperation);
  const evidenceText = customerGuardedEvidenceText(reportOrOperation);
  const acceptanceText = customerGuardedAcceptanceText(reportOrOperation);
  const finalMapped = mapGuardedReportCode(reportOrOperation?.execution?.final_status ?? reportOrOperation?.final_status, reportOrOperation);
  const fertilization = reportOrOperation?.fertilization ?? null;
  const pestDiseaseInspection = reportOrOperation?.pest_disease_inspection ?? null;
  const fertilizationSummaryText = scenarioKey === "FORMAL_FERTILIZATION" || fertilization ? fertilizationCustomerSummaryText(fertilization) : undefined;
  const pestDiseaseSummaryText = scenarioKey === "FORMAL_PEST_DISEASE_INSPECTION" || pestDiseaseInspection
    ? pestDiseaseInspectionCustomerSummaryText(pestDiseaseInspection)
    : undefined;
  const guardedPassed = isCustomerFormalChainPassed(reportOrOperation);
  const tone: FormalScenarioVm["tone"] =
    guardedPassed
      ? "success"
      : pestDiseaseInspection?.review_status === "REJECTED" || pestDiseaseInspection?.acceptance_status === "FAIL"
        ? "danger"
        : pestDiseaseInspection?.review_required || pestDiseaseInspection?.customer_visible_eligible === false
          ? "warning"
          : fertilization?.acceptance_status === "FAIL"
            ? "danger"
            : fertilization?.acceptance_status === "NEEDS_REVIEW"
              ? "warning"
              : finalMapped.tone === "danger"
                ? "danger"
                : finalMapped.tone === "success"
                  ? "warning"
                  : "warning";
  const failSafeText = reportOrOperation?.fail_safe?.status ? failSafeStatusLabel(reportOrOperation.fail_safe.status) : undefined;
  const manualTakeoverText = reportOrOperation?.manual_takeover?.status ? manualTakeoverStatusLabel(reportOrOperation.manual_takeover.status) : undefined;
  const deviceStatusText = scenarioKey === "DEVICE_ANOMALY" ? `设备状态：${customerText(reportOrOperation?.device_status ?? reportOrOperation?.device?.status ?? "未知", "未知")}` : undefined;
  const executionGuardText = scenarioKey === "DEVICE_ANOMALY" ? "设备异常场景下，不对客户展示“执行成功”结论，需先完成人工复核。" : undefined;
  const customerBlockingReasons = collectBlockingReasons(reportOrOperation);
  const customerReasonSummary = scenarioKey === "FORMAL_FERTILIZATION"
    ? "实验性 / non-selling：施氮仅作为受控试点线索，不包装成客户可售试点资格。"
    : pestDiseaseSummaryText ?? fertilizationSummaryText ?? customerBlockingReasons[0] ?? "正式链路信息已记录，当前无额外阻塞说明。";
  const formalChainStatus = String(scenario?.formal_chain_status ?? reportOrOperation?.formal_chain_status ?? reportOrOperation?.chain_status ?? "NEEDS_REVIEW").trim().toUpperCase() || "NEEDS_REVIEW";
  const rawEvidenceStatus = String(scenario?.evidence_status ?? reportOrOperation?.evidence_status ?? reportOrOperation?.evidence?.status ?? "NEEDS_REVIEW").trim().toUpperCase() || "NEEDS_REVIEW";
  const needsReview = !guardedPassed || scenario?.needs_review === true || reportOrOperation?.needs_review === true;
  return {
    scenarioKey,
    scenarioLabel,
    chainText,
    evidenceText,
    acceptanceText,
    closureSteps: buildClosureSteps(reportOrOperation),
    failSafeText,
    manualTakeoverText,
    zoneSummaryText: samplingSummaryText(reportOrOperation) ?? zoneSummaryText(reportOrOperation),
    roiTrustText: roiTrustLaneText(reportOrOperation),
    memoryTrustText: memoryTrustLaneText(reportOrOperation),
    deviceStatusText,
    executionGuardText,
    fertilizationSummaryText,
    pestDiseaseSummaryText,
    tone,
    customerReasonSummary,
    customerBlockingReasons,
    rawScenarioType,
    formalChainStatus,
    rawEvidenceStatus,
    needsReview,
  };
}
