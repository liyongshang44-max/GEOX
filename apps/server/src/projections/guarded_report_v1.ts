type GuardTrustLevelV1 = "FORMAL_CHAIN_PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_FORMAL_EVIDENCE" | "SIMULATED_DEV_ONLY" | "LIMITED_FALLBACK";

type GuardStatusV1 = "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";
type CustomerFormalChainStatusV1 = "PASSED" | "NEEDS_REVIEW" | "BLOCKED";
type CustomerFormalEvidenceStatusV1 = "FORMAL_EVIDENCE_PASSED" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "BLOCKED";

function upper(value: unknown): string { return String(value ?? "").trim().toUpperCase(); }
function clone<T>(value: T): T { if (value == null || typeof value !== "object") return value; return JSON.parse(JSON.stringify(value)); }
function chainPassed(report: any): boolean { return report?.chain_validation?.passed === true && report?.chain_validation?.helper_or_simulated !== true && upper(report?.chain_integrity) === "COMPLETE"; }
function isSimulated(report: any): boolean { const flags = Array.isArray(report?.chain_flags) ? report.chain_flags.map(upper) : []; const integrity = upper(report?.chain_integrity); const raw = JSON.stringify(report ?? "").toLowerCase(); return report?.chain_validation?.helper_or_simulated === true || integrity === "SIMULATED_CHAIN" || flags.some((flag: string) => flag.includes("SIMULATED") || flag.includes("HELPER")) || raw.includes("flight-table") || raw.includes("flight_table") || raw.includes("simulated_dev_only"); }
function blockingReasons(report: any): string[] { const reasons = [...(Array.isArray(report?.chain_validation?.blocking_reasons) ? report.chain_validation.blocking_reasons : []), ...(Array.isArray(report?.missing_links) ? report.missing_links.map((x: unknown) => `missing:${x}`) : [])].map((x) => String(x ?? "").trim()).filter(Boolean); return Array.from(new Set(reasons)); }
function trustLevelFor(report: any): GuardTrustLevelV1 { if (chainPassed(report)) return "FORMAL_CHAIN_PASSED"; if (isSimulated(report)) return "SIMULATED_DEV_ONLY"; const reasons = blockingReasons(report).join("|").toUpperCase(); if (reasons.includes("EVIDENCE") || reasons.includes("FORMAL")) return "INSUFFICIENT_FORMAL_EVIDENCE"; if (!report?.chain_validation) return "LIMITED_FALLBACK"; return "NEEDS_REVIEW"; }
function guardStatusFor(trust: GuardTrustLevelV1): GuardStatusV1 { if (trust === "FORMAL_CHAIN_PASSED") return "PASSED"; if (trust === "SIMULATED_DEV_ONLY") return "SIMULATED"; if (trust === "INSUFFICIENT_FORMAL_EVIDENCE") return "INSUFFICIENT_EVIDENCE"; if (trust === "LIMITED_FALLBACK") return "LIMITED"; return "NEEDS_REVIEW"; }

function formalAcceptanceId(item: any): string | null {
  const value = String(item?.formal_acceptance_id ?? "").trim();
  return value ? value : null;
}

export function isFormalCustomerValueItem(item: any): boolean {
  return item?.customer_visible_value === true
    && item?.trust_level === "FORMAL_ACCEPTED"
    && item?.source_lane === "FORMAL_ACCEPTANCE"
    && formalAcceptanceId(item) != null
    && item?.formal_evidence_passed === true
    && item?.chain_validation_passed === true;
}

function collectRoiItems(roi: any): any[] {
  const items: any[] = [];
  if (Array.isArray(roi?.items)) items.push(...roi.items);
  for (const key of ["water_saved", "labor_saved", "early_warning_lead_time", "first_pass_acceptance_rate", "low_confidence_items"]) {
    if (Array.isArray(roi?.[key])) items.push(...roi[key]);
  }
  return items;
}

function summaryHasFormalCustomerValue(summary: any): boolean {
  return summary?.has_customer_visible_value === true && Number(summary?.trusted_value_items ?? 0) > 0;
}

function guardRoiLedger(roi: any, trusted: boolean, trust: GuardTrustLevelV1): any {
  const next = clone(roi ?? {});
  const guardItem = (item: any) => {
    const sourceFormalAcceptanceId = formalAcceptanceId(item);
    const formalValue = trusted && isFormalCustomerValueItem(item);
    return {
      ...item,
      formal_acceptance_id: formalValue ? sourceFormalAcceptanceId : null,
      source_lane: formalValue ? "FORMAL_ACCEPTANCE" : item?.source_lane,
      formal_evidence_passed: formalValue,
      chain_validation_passed: formalValue,
      customer_visible_value: formalValue,
      trust_level: formalValue ? "FORMAL_ACCEPTED" : (item?.trust_level ?? trust),
      customer_text: formalValue ? item?.customer_text : "该价值记录未通过正式链路校验，仅作为内部线索。",
    };
  };
  next.items = Array.isArray(next.items) ? next.items.map(guardItem) : [];
  for (const key of ["water_saved", "labor_saved", "early_warning_lead_time", "first_pass_acceptance_rate", "low_confidence_items"]) if (Array.isArray(next[key])) next[key] = next[key].map(guardItem);
  const formalItems = collectRoiItems(next).filter(isFormalCustomerValueItem);
  const hasFormalCustomerValue = trusted && formalItems.length > 0;
  next.summary = {
    ...(next.summary ?? {}),
    trusted_value_items: hasFormalCustomerValue ? formalItems.length : 0,
    has_customer_visible_value: hasFormalCustomerValue,
    trust_level: hasFormalCustomerValue ? "FORMAL_ACCEPTED" : trust,
    customer_visible_value: hasFormalCustomerValue,
  };
  return next;
}

function guardFieldMemory(memory: any, trusted: boolean, trust: GuardTrustLevelV1): any {
  const source = memory ?? {};
  if (trusted) return source;
  return { field_response_memory: [], device_reliability_memory: [], skill_performance_memory: [], hidden_by_guard: true, trust_level: trust, hidden_counts: { field_response_memory: Array.isArray(source.field_response_memory) ? source.field_response_memory.length : 0, device_reliability_memory: Array.isArray(source.device_reliability_memory) ? source.device_reliability_memory.length : 0, skill_performance_memory: Array.isArray(source.skill_performance_memory) ? source.skill_performance_memory.length : 0 } };
}

function statusOf(report: any, key: string): string { const item = Array.isArray(report?.status_chain) ? report.status_chain.find((x: any) => String(x?.key ?? "") === key) : null; return upper(item?.status); }
function unique(values: unknown[]): string[] { return Array.from(new Set(values.map((x) => String(x ?? "").trim()).filter(Boolean))); }

function formalScenarioTypeFor(report: any): string {
  const existing = upper(report?.formal_scenario?.scenario_type);
  if (["FORMAL_IRRIGATION", "DEVICE_ANOMALY", "FORMAL_VARIABLE_OPERATION", "FORMAL_SAMPLING", "FORMAL_FERTILIZATION", "FORMAL_PEST_DISEASE_INSPECTION"].includes(existing)) return existing;
  if (report?.pest_disease_inspection) return "FORMAL_PEST_DISEASE_INSPECTION";
  if (report?.fertilization) return "FORMAL_FERTILIZATION";
  if (report?.sampling?.sample_id || report?.sampling?.plan_id) return "FORMAL_SAMPLING";
  if (Array.isArray(report?.zone_matrix) && report.zone_matrix.length > 0) return "FORMAL_VARIABLE_OPERATION";
  const failSafe = upper(report?.fail_safe?.status);
  const manualTakeover = upper(report?.manual_takeover?.status);
  if ((failSafe && failSafe !== "NONE") || (manualTakeover && manualTakeover !== "NONE")) return "DEVICE_ANOMALY";
  const actionText = [
    report?.operation_title,
    report?.customer_title,
    report?.action_type,
    report?.as_executed?.actual_params?.action_type,
    report?.suggested_action?.action_type,
  ].map((x) => String(x ?? "").trim()).join("|").toUpperCase();
  if (actionText.includes("IRRIG") || actionText.includes("灌溉")) return "FORMAL_IRRIGATION";
  if (report?.identifiers?.recommendation_id || report?.identifiers?.prescription_id || report?.identifiers?.act_task_id) return "FORMAL_IRRIGATION";
  return "UNKNOWN";
}

function formalChainStatusFor(trust: GuardTrustLevelV1, guardStatus: GuardStatusV1): CustomerFormalChainStatusV1 {
  if (trust === "FORMAL_CHAIN_PASSED" || guardStatus === "PASSED") return "PASSED";
  if (trust === "NEEDS_REVIEW" || guardStatus === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  return "BLOCKED";
}

function formalEvidenceStatusFor(trust: GuardTrustLevelV1, guardStatus: GuardStatusV1): CustomerFormalEvidenceStatusV1 {
  if (trust === "FORMAL_CHAIN_PASSED" || guardStatus === "PASSED") return "FORMAL_EVIDENCE_PASSED";
  if (trust === "SIMULATED_DEV_ONLY" || guardStatus === "SIMULATED") return "SIMULATED";
  if (trust === "INSUFFICIENT_FORMAL_EVIDENCE" || guardStatus === "INSUFFICIENT_EVIDENCE" || trust === "NEEDS_REVIEW") return "INSUFFICIENT_EVIDENCE";
  return "BLOCKED";
}

function collectFormalScenarioSourceRefs(report: any): string[] {
  const ids = report?.identifiers ?? {};
  const refs = [
    ids.recommendation_id ? `recommendation:${ids.recommendation_id}` : null,
    ids.prescription_id ? `prescription:${ids.prescription_id}` : null,
    ids.approval_id ? `approval:${ids.approval_id}` : null,
    ids.operation_plan_id ? `operation_plan:${ids.operation_plan_id}` : null,
    ids.act_task_id ? `ao_act_task:${ids.act_task_id}` : null,
    ids.receipt_id ? `receipt:${ids.receipt_id}` : null,
    report?.acceptance?.acceptance_id ? `acceptance:${report.acceptance.acceptance_id}` : null,
    report?.acceptance?.formal_acceptance === true ? "acceptance:formal" : null,
    report?.evidence?.formal_evidence_passed === true ? "evidence:formal_passed" : null,
    report?.roi_ledger?.summary?.has_customer_visible_value === true ? "roi:customer_visible" : null,
    report?.field_memory && report.field_memory.hidden_by_guard !== true ? "field_memory:visible" : null,
    ...(Array.isArray(report?.status_chain) ? report.status_chain.map((x: any) => String(x?.key ?? "").trim() ? `status_chain:${String(x.key).trim()}:${String(x?.status ?? "").trim()}` : null) : []),
    ...(Array.isArray(report?.formal_scenario?.source_refs) ? report.formal_scenario.source_refs : []),
  ];
  return unique(refs);
}

function reconcileFormalScenarioProjectionV1(report: any, trust: GuardTrustLevelV1, guardStatus: GuardStatusV1, trusted: boolean, reasons: string[]): any {
  const existing = report?.formal_scenario && typeof report.formal_scenario === "object" ? report.formal_scenario : {};
  const formal_chain_status = formalChainStatusFor(trust, guardStatus);
  const evidence_status = formalEvidenceStatusFor(trust, guardStatus);
  const blocking_reasons = unique([...(Array.isArray(existing.blocking_reasons) ? existing.blocking_reasons : []), ...reasons]);
  return {
    ...existing,
    scenario_type: formalScenarioTypeFor(report),
    formal_chain_status,
    evidence_status,
    customer_visible_eligible: trusted,
    needs_review: trusted ? Boolean(existing.needs_review ?? false) : true,
    blocking_reasons,
    source_refs: collectFormalScenarioSourceRefs(report),
  };
}

export function applyGuardedOperationReportV1(report: any): any {
  if (!report || typeof report !== "object") return report;
  const next = clone(report);
  const trust = trustLevelFor(next);
  const guardStatus = guardStatusFor(trust);
  const trusted = trust === "FORMAL_CHAIN_PASSED";
  const reasons = blockingReasons(next);
  next.customer_status = trusted ? upper(next.execution?.final_status ?? "COMPLETE") : guardStatus;
  next.trust_level = trust;
  next.chain_status = guardStatus;
  next.needs_review = !trusted;
  next.is_simulated = trust === "SIMULATED_DEV_ONLY";
  next.customer_visible_eligible = trusted;
  next.guarded_projection = { enabled: true, passed: trusted, trust_level: trust, chain_status: guardStatus, customer_visible_eligible: trusted, blocking_reasons: reasons };
  if (!trusted) {
    next.execution = { ...(next.execution ?? {}), final_status: trust === "SIMULATED_DEV_ONLY" ? "SIMULATED_DEV_ONLY" : "NEEDS_REVIEW", customer_status: guardStatus, guarded: true };
    next.acceptance = { ...(next.acceptance ?? {}), status: trust === "SIMULATED_DEV_ONLY" ? "SIMULATED" : trust === "INSUFFICIENT_FORMAL_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "NEEDS_REVIEW", verdict: null, formal_acceptance: false, missing_evidence: true, missing_items: Array.from(new Set([...(Array.isArray(next.acceptance?.missing_items) ? next.acceptance.missing_items : []), ...reasons])).slice(0, 20) };
    next.evidence = { ...(next.evidence ?? {}), evidence_status: trust === "SIMULATED_DEV_ONLY" ? "SIMULATED" : "INSUFFICIENT_EVIDENCE", trusted: false, formal_evidence_passed: false };
  } else {
    next.acceptance = { ...(next.acceptance ?? {}), formal_acceptance: true };
    next.evidence = { ...(next.evidence ?? {}), trusted: true, formal_evidence_passed: true };
  }
  if (next.prescription && statusOf(next, "prescription") && statusOf(next, "prescription") !== "DONE") next.prescription = { ...next.prescription, status: statusOf(next, "prescription"), formal_prescription: false };
  else if (next.prescription) next.prescription = { ...next.prescription, formal_prescription: trusted };
  next.roi_ledger = guardRoiLedger(next.roi_ledger, trusted, trust);
  next.roi = guardRoiLedger(next.roi, trusted, trust);
  next.field_memory = guardFieldMemory(next.field_memory, trusted, trust);
  if (next.evidence_pack_summary && !trusted) next.evidence_pack_summary = { ...next.evidence_pack_summary, status: trust === "SIMULATED_DEV_ONLY" ? "PENDING" : "FAILED", evidence_count: 0, insufficient_reason: next.evidence_pack_summary.insufficient_reason ?? "该证据包未通过正式链路校验，不能作为客户正式结论。" };
  next.formal_scenario = reconcileFormalScenarioProjectionV1(next, trust, guardStatus, trusted, reasons);
  return next;
}

function guardOperationListItem(op: any): any {
  const finalStatus = upper(op?.final_status);
  const acceptanceStatus = upper(op?.acceptance_status);
  const looksFormal = op?.customer_visible_eligible === true || op?.trust_level === "FORMAL_CHAIN_PASSED";
  if (looksFormal) return op;
  return {
    ...op,
    final_status: finalStatus === "SUCCESS" ? "NEEDS_REVIEW" : op?.final_status,
    acceptance_status: acceptanceStatus === "PASS" ? "NEEDS_REVIEW" : op?.acceptance_status,
    customer_status: op?.customer_status ?? "LIMITED",
    trust_level: op?.trust_level ?? "LIMITED_FALLBACK",
    chain_status: op?.chain_status ?? "LIMITED",
    is_simulated: op?.is_simulated ?? false,
    needs_review: op?.needs_review ?? true,
    customer_visible_eligible: false,
  };
}

function hasFormalOperationInAggregate(payload: any): boolean {
  return Array.isArray(payload?.recent_operations) && payload.recent_operations.some((op: any) =>
    op?.projection_source === "GUARDED_REPORT"
    && op?.customer_visible_eligible === true
    && op?.fallback_limited !== true
    && (op?.trust_level == null || op?.trust_level === "FORMAL_CHAIN_PASSED")
  );
}

function hasFormalFieldMemoryInAggregate(payload: any): boolean {
  return Number(payload?.learning_summary?.formal_field_response_memory_count ?? 0) > 0
    || Number(payload?.learning_summary?.formal_memory_count ?? 0) > 0;
}

export function applyGuardedDashboardAggregateV1(aggregate: any): any {
  if (!aggregate || typeof aggregate !== "object") return aggregate;
  const next = clone(aggregate);
  next.recent_operations = Array.isArray(next.recent_operations) ? next.recent_operations.map(guardOperationListItem) : [];
  const hasFormalValue = summaryHasFormalCustomerValue(next.roi_summary) && hasFormalOperationInAggregate(next);
  next.roi_summary = {
    ...(next.roi_summary ?? {}),
    has_customer_visible_value: hasFormalValue,
    customer_value_text: hasFormalValue ? next.roi_summary?.customer_value_text : "价值记录需通过正式链路校验后才可作为客户可信收益。",
    trust_level: hasFormalValue ? "FORMAL_ACCEPTED" : "LIMITED_FALLBACK",
  };
  next.guarded_projection = { enabled: true, source: "dashboard_aggregate_guard", note: "Dashboard summary only exposes formal customer value when ROI and guarded operation chain are both formal." };
  return next;
}

export function applyGuardedFieldReportV1(fieldReport: any): any {
  if (!fieldReport || typeof fieldReport !== "object") return fieldReport;
  const next = clone(fieldReport);
  next.recent_operations = Array.isArray(next.recent_operations) ? next.recent_operations.map(guardOperationListItem) : [];
  const hasFormalValue = summaryHasFormalCustomerValue(next.value_summary) && hasFormalOperationInAggregate(next) && hasFormalFieldMemoryInAggregate(next);
  next.value_summary = {
    ...(next.value_summary ?? {}),
    has_customer_visible_value: hasFormalValue,
    customer_value_text: hasFormalValue ? next.value_summary?.customer_value_text : "该地块价值记录需通过正式链路校验后才可作为可信收益。",
    trust_level: hasFormalValue ? "FORMAL_ACCEPTED" : "LIMITED_FALLBACK",
  };
  next.guarded_projection = { enabled: true, source: "field_report_guard" };
  return next;
}

export function applyGuardedCustomerOperationsResponseV1(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const next = clone(payload);
  next.operations = Array.isArray(next.operations) ? next.operations.map(guardOperationListItem) : [];
  next.guarded_projection = { enabled: true, source: "customer_operations_guard", note: "Customer operations from state fallback are limited unless backed by guarded reports." };
  return next;
}

export function applyGuardedCustomerReportsResponseV1(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const next = clone(payload);
  next.reports = Array.isArray(next.reports) ? next.reports.map((report: any) => report?.report_type === "OPERATION" ? { ...report, status_text: "需正式链路校验", capability_status: "PENDING", trust_level: "LIMITED_FALLBACK", customer_visible_eligible: false } : report) : [];
  next.guarded_projection = { enabled: true, source: "customer_reports_guard" };
  return next;
}

export function applyGuardedCustomerFieldsResponseV1(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const next = clone(payload);
  next.fields = Array.isArray(next.fields) ? next.fields.map((field: any) => ({ ...field, trust_level: field.trust_level ?? "LIMITED_FALLBACK", customer_visible_eligible: false })) : [];
  next.guarded_projection = { enabled: true, source: "customer_fields_guard" };
  return next;
}
