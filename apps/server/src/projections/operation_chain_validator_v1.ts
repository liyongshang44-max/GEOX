type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type OperationChainStatusV1 =
  | "DONE"
  | "AVAILABLE"
  | "PENDING"
  | "MISSING"
  | "BLOCKED"
  | "INVALID"
  | "SIMULATED"
  | "NEEDS_EVIDENCE"
  | "NOT_APPLICABLE";

export type OperationChainItemV1 = {
  key: string;
  label: string;
  status: OperationChainStatusV1;
  reason: string;
  source: string;
};

export type OperationChainValidationResultV1 = {
  chain_integrity: "COMPLETE" | "LEGACY_OR_MANUAL" | "BLOCKED_BY_UPSTREAM" | "SIMULATED_CHAIN" | "INVALID_CHAIN";
  chain_flags: string[];
  missing_links: string[];
  legacy_warning: string | null;
  status_chain: OperationChainItemV1[];
  validation: {
    passed: boolean;
    helper_or_simulated: boolean;
    blocking_reasons: string[];
  };
};

type ValidatorInput = {
  facts: FactRow[];
  report: any;
  rec: any;
  prescriptionPayload: any;
  approvalDecision: any;
  task: any;
  receipt: any;
  acceptancePayload: any;
  recommendation: any;
  prescription: any;
  approval: any;
  operationPlan: any;
  execution: any;
  evidence: any;
  acceptance: any;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const s = upper(value);
  if (["TRUE", "YES", "1"].includes(s)) return true;
  if (["FALSE", "NO", "0"].includes(s)) return false;
  return null;
}

function payload(fact: FactRow | null | undefined): any {
  const record = fact?.record_json ?? {};
  if (record?.payload && typeof record.payload === "object") return record.payload;
  return record;
}

function factType(fact: FactRow | null | undefined): string {
  return text(fact?.record_json?.type);
}

function latestByType(facts: FactRow[], type: string): FactRow | null {
  return [...facts].reverse().find((fact) => factType(fact) === type) ?? null;
}

function latestByTypes(facts: FactRow[], types: string[]): FactRow | null {
  const allow = new Set(types);
  return [...facts].reverse().find((fact) => allow.has(factType(fact))) ?? null;
}

function containsFlightTableMarker(value: unknown): boolean {
  const raw = JSON.stringify(value ?? "").toLowerCase();
  return raw.includes("flight_table") || raw.includes("flight-table") || raw.includes("irrigation_simulator") || raw.includes("receipt_success_is_not_acceptance_pass");
}

function hasHelperOrSimulatedFact(facts: FactRow[]): boolean {
  return facts.some((fact) => containsFlightTableMarker(fact.record_json) || containsFlightTableMarker(fact.record_json?.payload) || containsFlightTableMarker(fact.record_json?.source));
}

function receiptBlocksAcceptance(receipt: any, facts: FactRow[]): boolean {
  if (receipt?.meta?.receipt_success_is_not_acceptance_pass === true) return true;
  return facts.some((fact) => fact.record_json?.payload?.meta?.receipt_success_is_not_acceptance_pass === true);
}

function hasExecutionWindow(receipt: any): boolean {
  const executionTime = receipt?.execution_time ?? receipt?.meta?.execution_time ?? {};
  return Boolean(executionTime?.start_ts && executionTime?.end_ts) || Boolean(receipt?.execution_started_at && receipt?.execution_finished_at);
}

function actionTypeFrom(input: ValidatorInput): string {
  const reportLooksFertilization = Boolean(input.report?.fertilization?.fertilization_prescription_id);
  return upper(
    input.prescription?.operation_type
      ?? input.prescriptionPayload?.operation_type
      ?? input.prescriptionPayload?.action_type
      ?? input.task?.meta?.operation_type
      ?? input.task?.operation_type
      ?? input.operationPlan?.meta?.operation_type
      ?? input.operationPlan?.operation_type
      ?? (reportLooksFertilization ? "FERTILIZATION" : undefined)
      ?? input.rec?.suggested_action?.action_type
      ?? input.report?.operation_type,
  );
}

function isIrrigation(input: ValidatorInput): boolean {
  const action = actionTypeFrom(input);
  return action.includes("IRRIG") || action.includes("WATER");
}

function isFertilization(input: ValidatorInput): boolean {
  const action = actionTypeFrom(input);
  return action.includes("FERTIL") || Boolean(input.report?.fertilization?.fertilization_prescription_id);
}

function node(key: string, label: string, status: OperationChainStatusV1, reason: string, source: string): OperationChainItemV1 {
  return { key, label, status, reason, source };
}

function missingFrom(items: OperationChainItemV1[]): string[] {
  return items
    .filter((item) => !["DONE", "AVAILABLE", "NOT_APPLICABLE"].includes(item.status))
    .map((item) => item.key);
}

const STAGE1_SENSING_SUMMARY_FACT_TYPES = [
  "stage1_sensing_summary",
  "stage1_sensing_summary_v1",
  "ao_sense_stage1_summary_v1",
];

function isFormalStage1SensingSummary(stage1: any): boolean {
  const sourceLane = upper(stage1?.source_lane ?? stage1?.lane);
  const trigger = stage1?.formal_trigger ?? stage1?.formal_triggered ?? stage1?.triggered;
  const passed = stage1?.formal_evidence_passed ?? stage1?.formal_sensing_passed ?? stage1?.passed;
  const simulated = stage1?.is_simulated === true || sourceLane === "SIMULATED_DEV_ONLY" || sourceLane === "DEBUG_ONLY";
  return !simulated && (trigger === true || passed === true || upper(stage1?.status) === "FORMAL_TRIGGERED" || upper(stage1?.status) === "PASSED");
}

function isFormalAcceptancePayload(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  const sourceLane = upper(payload.source_lane);
  const trustLevel = upper(payload.trust_level);
  const status = upper(payload.acceptance_status ?? payload.verdict);

  if (payload.is_simulated === true) return false;
  if (sourceLane === "SIMULATED_DEV_ONLY" || sourceLane === "DEBUG_ONLY") return false;
  if (payload.customer_visible_eligible === false) return false;

  if (payload.formal_acceptance === true) return true;
  if (payload.type === "fertilization_acceptance_v1" && ["PASS", "FAIL"].includes(status)) return true;

  return payload.formal_evidence_passed === true
    && payload.formal_execution_passed !== false
    && payload.non_simulated_chain !== false
    && (sourceLane === "FORMAL_OPERATION" || trustLevel === "FORMAL_ACCEPTED");
}

export function validateOperationChainV1(input: ValidatorInput): OperationChainValidationResultV1 {
  const facts = input.facts ?? [];
  const fertilizationAssessmentFact = latestByType(facts, "nitrogen_need_assessment_v1");
  const recFact = latestByTypes(facts, ["decision_recommendation_v1", "fertilization_recommendation_v1"]);
  const prescriptionFact = latestByTypes(facts, ["prescription_v1", "operation_prescription_v1", "decision_prescription_v1", "fertilization_prescription_v1"]);
  const approvalDecisionFact = latestByType(facts, "approval_decision_v1");
  const planFact = latestByType(facts, "operation_plan_v1");
  const taskFact = latestByType(facts, "ao_act_task_v0");
  const receiptFact = latestByTypes(facts, ["ao_act_receipt_v0", "ao_act_receipt_v1"]);
  const acceptanceFact = latestByTypes(facts, ["acceptance_result_v1", "fertilization_acceptance_v1"]);
  const stage1Fact = latestByTypes(facts, STAGE1_SENSING_SUMMARY_FACT_TYPES);

  const rec = input.rec ?? payload(recFact);
  const receipt = input.receipt ?? payload(receiptFact);
  const stage1_sensing_summary = payload(stage1Fact);
  const isHelper = hasHelperOrSimulatedFact(facts);
  const receiptNotAcceptance = receiptBlocksAcceptance(receipt, facts);

  const soilMoisture = finite(rec?.skill_trace?.inputs?.soil_moisture ?? rec?.diagnosis?.soil_moisture ?? rec?.soil_moisture);
  const threshold = finite(
    rec?.skill_trace?.outputs?.threshold
    ?? rec?.skill_trace?.outputs?.soil_moisture_threshold
    ?? rec?.skill_trace?.params?.threshold
    ?? rec?.diagnosis?.threshold
    ?? rec?.diagnosis?.soil_moisture_threshold
    ?? rec?.soil_moisture_threshold
  );
  const deficitDetected = bool(rec?.skill_trace?.outputs?.deficit_detected ?? rec?.diagnosis?.deficit_detected ?? rec?.diagnosis?.water_deficit);
  const confidenceBasis = upper(rec?.skill_trace?.outputs?.confidence?.basis ?? rec?.confidence_basis);
  const rawMetricContextPresent = soilMoisture != null || threshold != null || deficitDetected === true || confidenceBasis !== "";
  const stage1FormalTrigger = Boolean(stage1Fact && isFormalStage1SensingSummary(stage1_sensing_summary));

  const irrigation = isIrrigation(input);
  const fertilization = isFertilization(input);
  const fertilizationFormalAssessment = Boolean(
    fertilizationAssessmentFact
      || input.report?.fertilization?.assessment_id
      || rec?.assessment_id
      || input.prescriptionPayload?.assessment_id,
  );
  const fertilizationAcceptanceStatus = upper(payload(acceptanceFact)?.acceptance_status ?? input.report?.fertilization?.acceptance_status);
  const formalFertilizationAcceptance = fertilization && ["PASS", "FAIL"].includes(fertilizationAcceptanceStatus);

  const diagnosisHasCoreEvidence = irrigation
    ? stage1FormalTrigger
    : fertilization
      ? fertilizationFormalAssessment
      : Boolean(recFact || input.recommendation);
  const diagnosisStatus: OperationChainStatusV1 = diagnosisHasCoreEvidence ? "DONE" : (recFact || input.recommendation ? "NEEDS_EVIDENCE" : "MISSING");
  const diagnosisReason = diagnosisHasCoreEvidence
    ? (fertilization ? "正式施肥诊断事实已关联" : "Stage-1 sensing summary 已提供正式触发依据")
    : irrigation
      ? rawMetricContextPresent
        ? "存在原始 soil moisture/threshold/deficit 线索，但缺少 Stage-1 sensing summary 正式触发来源，不能作为正式灌溉建议依据"
        : "缺少 Stage-1 sensing summary 正式触发来源，不能作为正式灌溉建议依据"
      : fertilization
        ? "缺少 nitrogen_need_assessment_v1 正式施肥诊断事实"
        : "缺少正式诊断依据";

  const recommendationExists = Boolean(recFact || input.recommendation || input.report?.fertilization?.fertilization_recommendation_id);
  const recommendationStatus: OperationChainStatusV1 = !recommendationExists ? "MISSING" : diagnosisStatus === "DONE" ? "DONE" : "BLOCKED";

  const prescriptionExists = Boolean(prescriptionFact || input.prescription || input.report?.fertilization?.fertilization_prescription_id);
  const prescriptionStatus: OperationChainStatusV1 = !prescriptionExists ? "MISSING" : recommendationStatus === "DONE" ? "DONE" : "BLOCKED";

  const approvalDecision = upper(input.approvalDecision?.decision ?? input.approval?.status);
  const approvalApproved = Boolean((approvalDecisionFact || input.approval) && ["APPROVE", "APPROVED", "PASS"].includes(approvalDecision));
  const approvalExists = Boolean(input.approval || approvalDecisionFact || latestByType(facts, "approval_request_v1"));
  const approvalStatus: OperationChainStatusV1 = approvalApproved ? "DONE" : approvalExists ? "PENDING" : "MISSING";

  const planStatusText = upper(input.operationPlan?.status ?? payload(planFact)?.status);
  const operationPlanExists = Boolean(planFact || input.operationPlan);
  const operationPlanAuthorized = operationPlanExists && approvalApproved && ["APPROVED_FOR_EXECUTION", "READY", "READY_FOR_EXECUTION", "READY_TO_DISPATCH", "ACKED", "SUCCEEDED"].includes(planStatusText);
  const operationPlanStatus: OperationChainStatusV1 = !operationPlanExists ? "MISSING" : operationPlanAuthorized ? "DONE" : "BLOCKED";

  const taskExists = Boolean(taskFact || input.execution?.act_task_id);
  const executionStatus: OperationChainStatusV1 = !taskExists ? "MISSING" : operationPlanStatus === "DONE" ? "DONE" : "BLOCKED";

  const receiptExists = Boolean(receiptFact || input.execution?.receipt_id || input.receipt);
  const receiptHasWindow = hasExecutionWindow(receipt);
  const receiptStatus: OperationChainStatusV1 = !receiptExists
    ? "MISSING"
    : receiptNotAcceptance || isHelper
      ? "SIMULATED"
      : executionStatus !== "DONE"
        ? "BLOCKED"
        : receiptHasWindow
          ? "DONE"
          : "INVALID";

  const fertilizationZoneEvidence = fertilization && Boolean(
    Array.isArray(payload(acceptanceFact)?.zone_results) && payload(acceptanceFact).zone_results.length > 0,
  );
  const evidenceTrusted = Boolean(
    (input.evidence?.trusted && input.evidence?.evidence_status === "COMPLETE")
      || (formalFertilizationAcceptance && fertilizationZoneEvidence),
  );
  const evidenceStatus: OperationChainStatusV1 = !evidenceTrusted
    ? "MISSING"
    : receiptStatus === "DONE"
      ? "DONE"
      : receiptStatus === "SIMULATED"
        ? "SIMULATED"
        : "BLOCKED";

  const acceptanceExists = Boolean(acceptanceFact || input.acceptance || formalFertilizationAcceptance);
  const acceptancePayloadForFormalGate = input.acceptancePayload ?? payload(acceptanceFact) ?? input.acceptance ?? input.report?.acceptance;
  const acceptanceFormal = isFormalAcceptancePayload(acceptancePayloadForFormalGate) || formalFertilizationAcceptance;
  const acceptanceVerdict = upper(input.acceptance?.verdict ?? input.acceptancePayload?.verdict ?? payload(acceptanceFact)?.verdict ?? payload(acceptanceFact)?.acceptance_status ?? input.report?.acceptance?.verdict ?? input.report?.acceptance?.status);
  const acceptanceStatus: OperationChainStatusV1 = !acceptanceExists
    ? "MISSING"
    : evidenceStatus === "DONE" && acceptanceFormal && ["PASS", "FAIL", "FAILED", "REJECTED"].includes(acceptanceVerdict)
      ? "DONE"
      : receiptNotAcceptance || isHelper
        ? "SIMULATED"
        : "BLOCKED";

  const roiAvailable = Boolean(input.report?.roi_ledger?.summary?.total_items || (Array.isArray(input.report?.roi_ledger?.items) && input.report.roi_ledger.items.length) || input.report?.roi);
  const roiStatus: OperationChainStatusV1 = acceptanceStatus === "DONE" ? (roiAvailable ? "AVAILABLE" : "MISSING") : "BLOCKED";

  const memoryAvailable = Boolean(input.report?.field_memory || input.report?.field_memory?.field_response_memory?.length || input.report?.field_memory?.device_reliability_memory?.length || input.report?.field_memory?.skill_performance_memory?.length);
  const memoryStatus: OperationChainStatusV1 = memoryAvailable ? (acceptanceStatus === "DONE" ? "AVAILABLE" : "SIMULATED") : "MISSING";

  const status_chain: OperationChainItemV1[] = [
    node("diagnosis", "诊断", diagnosisStatus, diagnosisReason, fertilization ? (fertilizationAssessmentFact ? factType(fertilizationAssessmentFact) : "fertilization_report_projection_v1") : stage1Fact ? factType(stage1Fact) : recFact ? factType(recFact) : "operation_report_chain_v1"),
    node("recommendation", "建议", recommendationStatus, recommendationStatus === "DONE" ? "正式建议已关联" : recommendationExists ? "上游诊断依据未通过校验，建议不能作为正式依据" : "缺少正式建议记录", recFact ? factType(recFact) : "operation_report_chain_v1"),
    node("prescription", "处方", prescriptionStatus, prescriptionStatus === "DONE" ? "正式处方已关联" : prescriptionExists ? "上游建议未通过校验，处方不能作为正式处方" : "缺少正式处方事实，不能仅凭作业计划中的处方编号认定处方成立", prescriptionFact ? factType(prescriptionFact) : "operation_report_chain_v1"),
    node("approval", "审批", approvalStatus, approvalApproved ? "审批结果已通过" : approvalExists ? "审批请求存在，但审批结果尚未通过" : "缺少审批记录", approvalDecisionFact ? "approval_decision_v1" : approvalExists ? "approval_request_v1" : "operation_report_chain_v1"),
    node("operation_plan", "作业计划", operationPlanStatus, operationPlanStatus === "DONE" ? "作业计划已获得审批授权" : operationPlanExists ? "审批未通过，作业计划不能作为正式执行计划" : "缺少作业计划", planFact ? "operation_plan_v1" : "operation_report_chain_v1"),
    node("execution", "执行", executionStatus, executionStatus === "DONE" ? "执行任务已由正式计划派发" : taskExists ? "上游作业计划未授权，执行任务不能作为正式执行" : "缺少执行任务", taskFact ? "ao_act_task_v0" : "operation_report_chain_v1"),
    node("receipt", "回执", receiptStatus, receiptStatus === "DONE" ? "执行回执已记录且具备执行窗口" : receiptStatus === "SIMULATED" ? "该回执来自飞行台/模拟链路，不能作为验收通过依据" : receiptExists ? "回执缺少执行窗口或上游执行未成立" : "缺少执行回执", receiptFact ? factType(receiptFact) : "operation_report_chain_v1"),
    node("evidence", "证据", evidenceStatus, evidenceStatus === "DONE" ? (fertilization ? "施肥分区执行证据链完整" : "证据链完整") : evidenceStatus === "SIMULATED" ? "证据来自模拟链路，不能包装成正式验收证据" : "证据不足或上游回执未成立", fertilization && acceptanceFact ? factType(acceptanceFact) : "operation_report_chain_v1"),
    node("acceptance", "验收", acceptanceStatus, acceptanceStatus === "DONE" ? "正式验收结论已形成" : acceptanceStatus === "SIMULATED" ? "飞行台回执成功不等于验收通过，验收结论需降级" : acceptanceExists && !acceptanceFormal ? "验收记录缺少 formal_acceptance gate metadata，不能作为正式客户结论" : acceptanceExists ? "上游证据未成立，验收不能作为正式结论" : "缺少验收结论", acceptanceFact ? factType(acceptanceFact) : "operation_report_chain_v1"),
    node("roi", "价值", roiStatus, roiStatus === "AVAILABLE" ? "价值记录可作为学习输入" : roiStatus === "BLOCKED" ? "验收未正式成立，价值结论不能成立" : "缺少价值记录", "roi_ledger_v1"),
    node("field_memory", "田块记忆", memoryStatus, memoryStatus === "AVAILABLE" ? "田块记忆可作为学习输入" : memoryStatus === "SIMULATED" ? "田块记忆来自未正式验收链路，仅作排查线索" : "缺少田块记忆", "field_memory_v1"),
  ];

  const missing_links = missingFrom(status_chain);
  const chain_flags: string[] = [];
  if (fertilization) chain_flags.push("formal_fertilization_chain");
  if (isHelper) chain_flags.push("helper_or_simulated_facts_present");
  if (receiptNotAcceptance) chain_flags.push("receipt_success_is_not_acceptance_pass");
  if (!approvalApproved && approvalExists) chain_flags.push("approval_not_approved");
  if (irrigation && !stage1FormalTrigger && recommendationExists) chain_flags.push("missing_stage1_sensing_summary_formal_trigger");
  if (fertilization && !fertilizationFormalAssessment) chain_flags.push("missing_fertilization_assessment_fact");
  if (diagnosisStatus === "NEEDS_EVIDENCE") chain_flags.push("diagnosis_needs_core_evidence");
  if (!prescriptionExists && input.prescription) chain_flags.push("prescription_id_without_formal_prescription_fact");
  if (operationPlanExists && !operationPlanAuthorized) chain_flags.push("operation_plan_without_approved_decision");
  if (receiptStatus === "SIMULATED") chain_flags.push("simulated_receipt_not_acceptance_proof");
  if (acceptanceStatus === "SIMULATED") chain_flags.push("simulated_acceptance_not_customer_conclusion");
  if (acceptanceExists && !acceptanceFormal) chain_flags.push("acceptance_result_without_formal_acceptance_gate");

  const blocking_reasons = status_chain.filter((item) => ["BLOCKED", "INVALID", "SIMULATED", "NEEDS_EVIDENCE"].includes(item.status)).map((item) => `${item.label}: ${item.reason}`);
  const mandatoryPassed = status_chain.slice(0, 9).every((item) => item.status === "DONE");
  const chain_integrity: OperationChainValidationResultV1["chain_integrity"] = mandatoryPassed && !isHelper
    ? "COMPLETE"
    : isHelper || receiptNotAcceptance
      ? "SIMULATED_CHAIN"
      : blocking_reasons.length > 0
        ? "BLOCKED_BY_UPSTREAM"
        : "LEGACY_OR_MANUAL";

  return {
    chain_integrity,
    chain_flags,
    missing_links,
    legacy_warning: chain_integrity === "COMPLETE" ? null : "该作业链路未通过正式主链校验；下游记录仅作为审计线索，不作为客户经营结论。",
    status_chain,
    validation: {
      passed: chain_integrity === "COMPLETE",
      helper_or_simulated: isHelper,
      blocking_reasons,
    },
  };
}
