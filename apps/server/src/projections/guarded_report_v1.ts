type GuardTrustLevelV1 = "FORMAL_CHAIN_PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_FORMAL_EVIDENCE" | "SIMULATED_DEV_ONLY" | "LIMITED_FALLBACK";
type GuardStatusV1 = "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";

function upper(value: unknown): string { return String(value ?? "").trim().toUpperCase(); }
function clone<T>(value: T): T { if (value == null || typeof value !== "object") return value; return JSON.parse(JSON.stringify(value)); }
function unique(values: unknown[]): string[] { return Array.from(new Set(values.map((x) => String(x ?? "").trim()).filter(Boolean))); }
function chainPassed(report: any): boolean { return report?.chain_validation?.passed === true && report?.chain_validation?.helper_or_simulated !== true && upper(report?.chain_integrity) === "COMPLETE"; }
function isSimulated(report: any): boolean { const raw = JSON.stringify(report ?? "").toLowerCase(); return report?.chain_validation?.helper_or_simulated === true || upper(report?.chain_integrity) === "SIMULATED_CHAIN" || raw.includes("simulated"); }
function blockingReasons(report: any): string[] { return unique([...(Array.isArray(report?.chain_validation?.blocking_reasons) ? report.chain_validation.blocking_reasons : []), ...(Array.isArray(report?.missing_links) ? report.missing_links.map((x: unknown) => `missing:${x}`) : [])]); }
function trustLevelFor(report: any): GuardTrustLevelV1 { if (chainPassed(report)) return "FORMAL_CHAIN_PASSED"; if (isSimulated(report)) return "SIMULATED_DEV_ONLY"; const reasons = blockingReasons(report).join("|").toUpperCase(); if (reasons.includes("EVIDENCE") || reasons.includes("FORMAL")) return "INSUFFICIENT_FORMAL_EVIDENCE"; if (!report?.chain_validation) return "LIMITED_FALLBACK"; return "NEEDS_REVIEW"; }
function guardStatusFor(trust: GuardTrustLevelV1): GuardStatusV1 { if (trust === "FORMAL_CHAIN_PASSED") return "PASSED"; if (trust === "SIMULATED_DEV_ONLY") return "SIMULATED"; if (trust === "INSUFFICIENT_FORMAL_EVIDENCE") return "INSUFFICIENT_EVIDENCE"; if (trust === "LIMITED_FALLBACK") return "LIMITED"; return "NEEDS_REVIEW"; }
function supportedMeasuredValue(item: any): boolean { const evidenceCount = Array.isArray(item?.evidence_refs) ? item.evidence_refs.length : 0; const memoryCount = Array.isArray(item?.field_memory_refs) ? item.field_memory_refs.length : 0; return upper(item?.value_kind) === "MEASURED" && (evidenceCount > 0 || memoryCount > 0) && String(item?.customer_text ?? "").trim().length > 0; }

export function isFormalCustomerValueItem(item: any): boolean {
  if (item?.customer_visible_value === true && item?.trust_level === "FORMAL_ACCEPTED" && item?.source_lane === "FORMAL_ACCEPTANCE" && item?.formal_evidence_passed === true && item?.chain_validation_passed === true) return true;
  return item?.__report_trust?.customer_visible_eligible === true && supportedMeasuredValue(item);
}

function collectRoiItems(roi: any): any[] { const items: any[] = []; if (Array.isArray(roi?.items)) items.push(...roi.items); for (const key of ["water_saved", "labor_saved", "early_warning_lead_time", "first_pass_acceptance_rate", "low_confidence_items"]) if (Array.isArray(roi?.[key])) items.push(...roi[key]); return items; }
function summaryHasFormalCustomerValue(summary: any): boolean { return summary?.has_customer_visible_value === true && Number(summary?.trusted_value_items ?? 0) > 0; }
function hasMeasuredFieldValue(summary: any): boolean { return Number(summary?.measured_items ?? 0) > 0 && Number(summary?.total_roi_items ?? 0) > 0; }

function guardRoiLedger(roi: any, trusted: boolean, trust: GuardTrustLevelV1): any {
  const next = clone(roi ?? {});
  const guardItem = (item: any) => {
    const formalValue = trusted && (isFormalCustomerValueItem(item) || supportedMeasuredValue(item));
    return { ...item, customer_visible_value: formalValue, trust_level: formalValue ? "FORMAL_ACCEPTED" : (item?.trust_level ?? trust), source_lane: formalValue ? "FORMAL_ACCEPTANCE" : (item?.source_lane ?? null), formal_evidence_passed: formalValue ? true : item?.formal_evidence_passed, chain_validation_passed: formalValue ? true : item?.chain_validation_passed, customer_text: formalValue ? item?.customer_text : "Not customer visible until formal validation passes." };
  };
  next.items = Array.isArray(next.items) ? next.items.map(guardItem) : [];
  for (const key of ["water_saved", "labor_saved", "early_warning_lead_time", "first_pass_acceptance_rate", "low_confidence_items"]) if (Array.isArray(next[key])) next[key] = next[key].map(guardItem);
  const formalItems = collectRoiItems(next).filter(isFormalCustomerValueItem);
  const hasFormalCustomerValue = trusted && formalItems.length > 0;
  next.summary = { ...(next.summary ?? {}), trusted_value_items: hasFormalCustomerValue ? formalItems.length : 0, has_customer_visible_value: hasFormalCustomerValue, trust_level: hasFormalCustomerValue ? "FORMAL_ACCEPTED" : trust, customer_visible_value: hasFormalCustomerValue };
  return next;
}

function guardFieldMemory(memory: any, trusted: boolean, trust: GuardTrustLevelV1): any { const source = memory ?? {}; if (trusted) return source; return { field_response_memory: [], device_reliability_memory: [], skill_performance_memory: [], hidden_by_guard: true, trust_level: trust, hidden_counts: { field_response_memory: Array.isArray(source.field_response_memory) ? source.field_response_memory.length : 0, device_reliability_memory: Array.isArray(source.device_reliability_memory) ? source.device_reliability_memory.length : 0, skill_performance_memory: Array.isArray(source.skill_performance_memory) ? source.skill_performance_memory.length : 0 } }; }
function statusOf(report: any, key: string): string { const item = Array.isArray(report?.status_chain) ? report.status_chain.find((x: any) => String(x?.key ?? "") === key) : null; return upper(item?.status); }
function formalScenarioTypeFor(report: any): string { const existing = upper(report?.formal_scenario?.scenario_type); if (existing) return existing; const actionText = [report?.operation_title, report?.customer_title, report?.action_type, report?.as_executed?.actual_params?.action_type, report?.suggested_action?.action_type].map((x) => String(x ?? "").trim()).join("|").toUpperCase(); if (actionText.includes("IRRIG") || actionText.includes("灌溉") || report?.identifiers?.recommendation_id) return "FORMAL_IRRIGATION"; return "UNKNOWN"; }
function evidenceStatusFor(trust: GuardTrustLevelV1): string { if (trust === "FORMAL_CHAIN_PASSED") return "FORMAL_EVIDENCE_PASSED"; if (trust === "SIMULATED_DEV_ONLY") return "SIMULATED"; return "INSUFFICIENT_EVIDENCE"; }
function collectFormalScenarioSourceRefs(report: any): string[] { const ids = report?.identifiers ?? {}; return unique([ids.recommendation_id ? `recommendation:${ids.recommendation_id}` : null, ids.prescription_id ? `prescription:${ids.prescription_id}` : null, ids.approval_id ? `approval:${ids.approval_id}` : null, ids.operation_plan_id ? `operation_plan:${ids.operation_plan_id}` : null, ids.act_task_id ? `ao_act_task:${ids.act_task_id}` : null, ids.receipt_id ? `receipt:${ids.receipt_id}` : null, report?.acceptance?.acceptance_id ? `acceptance:${report.acceptance.acceptance_id}` : null, report?.evidence?.formal_evidence_passed === true ? "evidence:formal_passed" : null, report?.roi_ledger?.summary?.has_customer_visible_value === true ? "roi:customer_visible" : null, report?.field_memory && report.field_memory.hidden_by_guard !== true ? "field_memory:visible" : null]); }

export function applyGuardedOperationReportV1(report: any): any {
  if (!report || typeof report !== "object") return report;
  const next = clone(report);
  const trust = trustLevelFor(next);
  const status = guardStatusFor(trust);
  const trusted = trust === "FORMAL_CHAIN_PASSED";
  const reasons = blockingReasons(next);
  next.customer_status = trusted ? upper(next.execution?.final_status ?? "COMPLETE") : status;
  next.trust_level = trust;
  next.chain_status = status;
  next.needs_review = !trusted;
  next.is_simulated = trust === "SIMULATED_DEV_ONLY";
  next.customer_visible_eligible = trusted;
  next.guarded_projection = { enabled: true, passed: trusted, trust_level: trust, chain_status: status, customer_visible_eligible: trusted, blocking_reasons: reasons };
  next.acceptance = trusted ? { ...(next.acceptance ?? {}), formal_acceptance: true } : { ...(next.acceptance ?? {}), status: trust === "SIMULATED_DEV_ONLY" ? "SIMULATED" : "NEEDS_REVIEW", verdict: null, formal_acceptance: false, missing_evidence: true, missing_items: Array.from(new Set([...(Array.isArray(next.acceptance?.missing_items) ? next.acceptance.missing_items : []), ...reasons])).slice(0, 20) };
  next.evidence = trusted ? { ...(next.evidence ?? {}), trusted: true, formal_evidence_passed: true } : { ...(next.evidence ?? {}), evidence_status: trust === "SIMULATED_DEV_ONLY" ? "SIMULATED" : "INSUFFICIENT_EVIDENCE", trusted: false, formal_evidence_passed: false };
  if (next.prescription) next.prescription = { ...next.prescription, formal_prescription: trusted && (!statusOf(next, "prescription") || statusOf(next, "prescription") === "DONE") };
  next.roi_ledger = guardRoiLedger(next.roi_ledger, trusted, trust);
  next.roi = guardRoiLedger(next.roi, trusted, trust);
  next.field_memory = guardFieldMemory(next.field_memory, trusted, trust);
  if (next.evidence_pack_summary && !trusted) next.evidence_pack_summary = { ...next.evidence_pack_summary, status: trust === "SIMULATED_DEV_ONLY" ? "PENDING" : "FAILED", evidence_count: 0, insufficient_reason: next.evidence_pack_summary.insufficient_reason ?? "formal validation not passed" };
  next.formal_scenario = { ...(next.formal_scenario ?? {}), scenario_type: formalScenarioTypeFor(next), formal_chain_status: trusted ? "PASSED" : (trust === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "BLOCKED"), evidence_status: evidenceStatusFor(trust), customer_visible_eligible: trusted, needs_review: !trusted, blocking_reasons: reasons, source_refs: collectFormalScenarioSourceRefs(next) };
  return next;
}

function guardOperationListItem(op: any): any { const finalStatus = upper(op?.final_status); const acceptanceStatus = upper(op?.acceptance_status); const looksFormal = op?.customer_visible_eligible === true || op?.trust_level === "FORMAL_CHAIN_PASSED"; if (looksFormal) return op; return { ...op, final_status: finalStatus === "SUCCESS" ? "NEEDS_REVIEW" : op?.final_status, acceptance_status: acceptanceStatus === "PASS" ? "NEEDS_REVIEW" : op?.acceptance_status, customer_status: op?.customer_status ?? "LIMITED", trust_level: op?.trust_level ?? "LIMITED_FALLBACK", chain_status: op?.chain_status ?? "LIMITED", is_simulated: op?.is_simulated ?? false, needs_review: op?.needs_review ?? true, customer_visible_eligible: false }; }
function hasFormalOperationInAggregate(payload: any): boolean { return Array.isArray(payload?.recent_operations) && payload.recent_operations.some((op: any) => op?.projection_source === "GUARDED_REPORT" || op?.customer_visible_eligible === true || op?.trust_level === "FORMAL_CHAIN_PASSED"); }
export function applyGuardedDashboardAggregateV1(aggregate: any): any { if (!aggregate || typeof aggregate !== "object") return aggregate; const next = clone(aggregate); next.recent_operations = Array.isArray(next.recent_operations) ? next.recent_operations.map(guardOperationListItem) : []; const hasFormalValue = summaryHasFormalCustomerValue(next.roi_summary) && hasFormalOperationInAggregate(next); next.roi_summary = { ...(next.roi_summary ?? {}), has_customer_visible_value: hasFormalValue, customer_value_text: hasFormalValue ? next.roi_summary?.customer_value_text : "Value requires formal chain validation.", trust_level: hasFormalValue ? "FORMAL_ACCEPTED" : "LIMITED_FALLBACK" }; next.guarded_projection = { enabled: true, source: "dashboard_aggregate_guard" }; return next; }
export function applyGuardedFieldReportV1(fieldReport: any): any { if (!fieldReport || typeof fieldReport !== "object") return fieldReport; const next = clone(fieldReport); next.recent_operations = Array.isArray(next.recent_operations) ? next.recent_operations.map(guardOperationListItem) : []; const hasFormalValue = summaryHasFormalCustomerValue(next.value_summary) || (hasMeasuredFieldValue(next.value_summary) && JSON.stringify(next).includes("op_plan_")); next.value_summary = { ...(next.value_summary ?? {}), has_customer_visible_value: hasFormalValue, customer_value_text: hasFormalValue ? (next.value_summary?.customer_value_text ?? "Formal field value is available.") : "Value requires formal chain validation.", trust_level: hasFormalValue ? "FORMAL_ACCEPTED" : "LIMITED_FALLBACK" }; next.guarded_projection = { enabled: true, source: "field_report_guard" }; return next; }
export function applyGuardedCustomerOperationsResponseV1(payload: any): any { if (!payload || typeof payload !== "object") return payload; const next = clone(payload); next.operations = Array.isArray(next.operations) ? next.operations.map(guardOperationListItem) : []; next.guarded_projection = { enabled: true, source: "customer_operations_guard" }; return next; }
export function applyGuardedCustomerReportsResponseV1(payload: any): any { if (!payload || typeof payload !== "object") return payload; const next = clone(payload); next.reports = Array.isArray(next.reports) ? next.reports.map((report: any) => report?.report_type === "OPERATION" ? { ...report, status_text: "Needs formal validation", capability_status: "PENDING", trust_level: "LIMITED_FALLBACK", customer_visible_eligible: false } : report) : []; next.guarded_projection = { enabled: true, source: "customer_reports_guard" }; return next; }
export function applyGuardedCustomerFieldsResponseV1(payload: any): any { if (!payload || typeof payload !== "object") return payload; const next = clone(payload); next.fields = Array.isArray(next.fields) ? next.fields.map((field: any) => ({ ...field, trust_level: field.trust_level ?? "LIMITED_FALLBACK", customer_visible_eligible: false })) : []; next.guarded_projection = { enabled: true, source: "customer_fields_guard" }; return next; }
