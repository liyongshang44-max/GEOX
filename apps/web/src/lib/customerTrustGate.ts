export type CustomerGuardedStatus = "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";

export type CustomerTrustContext = {
  chain_passed?: boolean;
  customer_visible_eligible?: boolean;
  needs_review?: boolean;
  is_simulated?: boolean;
  trust_level?: string | null;
  chain_status?: string | null;
  evidence_status?: string | null;
  formal_acceptance?: boolean;
  fallback_limited?: boolean;
  projection_source?: string | null;
  data_trust_status?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

export function customerTrustContextFromReportLike(value: any): CustomerTrustContext {
  const formal = value?.formal_scenario ?? {};
  const guarded = value?.guarded_projection ?? {};
  const projectionSource = upper(value?.projection_source ?? value?.projectionSource ?? guarded?.projection_source ?? guarded?.source);
  const dataTrustStatus = upper(value?.data_trust_status ?? value?.dataTrustStatus ?? guarded?.data_trust_status);
  const chainStatus = text(value?.chain_status ?? value?.chainStatus ?? value?.formal_chain_status ?? formal.formal_chain_status ?? guarded?.chain_status) || null;
  const guardedListItem = projectionSource === "GUARDED_REPORT" || dataTrustStatus === "FORMAL";
  return {
    chain_passed: value?.chain_validation?.passed === true || guarded?.passed === true || upper(chainStatus) === "PASSED" || guardedListItem,
    customer_visible_eligible: value?.customer_visible_eligible !== false && value?.customerVisibleEligible !== false && formal.customer_visible_eligible !== false && guarded?.customer_visible_eligible !== false,
    needs_review: value?.needs_review === true || value?.needsReview === true || formal.needs_review === true,
    is_simulated: value?.is_simulated === true || value?.isSimulated === true,
    trust_level: text(value?.trust_level ?? value?.trustLevel ?? guarded?.trust_level ?? formal.trust_level) || null,
    chain_status: chainStatus,
    evidence_status: text(value?.evidence_status ?? formal.evidence_status ?? value?.evidence?.evidence_status ?? value?.evidence?.status) || null,
    formal_acceptance: value?.formal_acceptance === true || value?.acceptance?.formal_acceptance === true || formal.formal_acceptance === true || guardedListItem,
    fallback_limited: value?.fallback_limited === true || guarded?.fallback_limited === true || projectionSource === "STATE_FALLBACK_LIMITED" || dataTrustStatus === "LIMITED",
    projection_source: projectionSource || null,
    data_trust_status: dataTrustStatus || null,
  };
}

export function isCustomerFormalChainPassed(value: any): boolean {
  const ctx = customerTrustContextFromReportLike(value);
  const trustLevel = upper(ctx.trust_level);
  const chainStatus = upper(ctx.chain_status);
  const evidenceStatus = upper(ctx.evidence_status);
  const projectionSource = upper(ctx.projection_source);
  const dataTrustStatus = upper(ctx.data_trust_status);
  const chainPassed = ctx.chain_passed === true || chainStatus === "PASSED" || projectionSource === "GUARDED_REPORT" || dataTrustStatus === "FORMAL";
  const visibleEligible = ctx.customer_visible_eligible !== false;
  const needsReview = ctx.needs_review === true;
  const simulated = ctx.is_simulated === true || chainStatus === "SIMULATED" || trustLevel === "SIMULATED_DEV_ONLY";
  const formalTrust = !trustLevel || trustLevel === "FORMAL_CHAIN_PASSED" || trustLevel === "FORMAL_ACCEPTED";
  const missingEvidence = evidenceStatus === "MISSING" || evidenceStatus === "TECHNICAL_ONLY";
  const fallbackLimited = ctx.fallback_limited === true || trustLevel === "LIMITED_FALLBACK" || projectionSource === "STATE_FALLBACK_LIMITED" || dataTrustStatus === "LIMITED";
  return chainPassed && visibleEligible && !needsReview && !simulated && formalTrust && !missingEvidence && !fallbackLimited;
}

export function customerGuardedStatus(value: any): CustomerGuardedStatus {
  if (isCustomerFormalChainPassed(value)) return "PASSED";
  const ctx = customerTrustContextFromReportLike(value);
  const trustLevel = upper(ctx.trust_level);
  const chainStatus = upper(ctx.chain_status);
  const evidenceStatus = upper(ctx.evidence_status);
  if (ctx.is_simulated === true || chainStatus === "SIMULATED" || trustLevel === "SIMULATED_DEV_ONLY") return "SIMULATED";
  if (chainStatus === "INSUFFICIENT_EVIDENCE" || trustLevel === "INSUFFICIENT_FORMAL_EVIDENCE" || evidenceStatus === "MISSING" || evidenceStatus === "TECHNICAL_ONLY") return "INSUFFICIENT_EVIDENCE";
  if (chainStatus === "LIMITED" || trustLevel === "LIMITED_FALLBACK" || ctx.fallback_limited === true) return "LIMITED";
  return "NEEDS_REVIEW";
}

export function customerGuardedStatusText(value: any): string {
  const status = customerGuardedStatus(value);
  if (status === "PASSED") return "正式完成";
  if (status === "SIMULATED") return "模拟记录";
  if (status === "INSUFFICIENT_EVIDENCE") return "证据不足";
  if (status === "LIMITED") return "有限记录";
  return "需复核";
}

export function customerGuardedAcceptanceText(value: any): string {
  if (isCustomerFormalChainPassed(value)) return "验收通过";
  const status = customerGuardedStatus(value);
  if (status === "SIMULATED") return "模拟记录";
  if (status === "INSUFFICIENT_EVIDENCE") return "证据不足";
  if (status === "LIMITED") return "有限记录";
  return "需复核";
}

export function customerGuardedEvidenceText(value: any): string {
  if (isCustomerFormalChainPassed(value)) return "证据已通过正式校验";
  const status = customerGuardedStatus(value);
  if (status === "SIMULATED") return "模拟证据不进入正式结论";
  if (status === "INSUFFICIENT_EVIDENCE") return "正式证据不足";
  if (status === "LIMITED") return "有限记录，待正式校验";
  return "证据待正式校验";
}

export function mapGuardedOperationStatusToCustomerLabel(value: unknown, trustContext: CustomerTrustContext | any): string {
  const ctx = trustContext && typeof trustContext === "object"
    ? { ...customerTrustContextFromReportLike(trustContext), ...(trustContext as CustomerTrustContext) }
    : null;
  if (!ctx) return "需复核";
  const guardedStatus = customerGuardedStatus(ctx);
  if (guardedStatus !== "PASSED") return customerGuardedStatusText(ctx);
  const raw = upper(value);
  if (["SUCCESS", "DONE", "COMPLETED", "APPROVED", "PASS", "PASSED", "VALID"].includes(raw)) return "正式完成";
  if (["FAILED", "REJECTED", "ERROR", "INVALID", "INVALID_EXECUTION"].includes(raw)) return "异常，需复核";
  if (["PENDING", "WAITING", "QUEUED", "RUNNING", "IN_PROGRESS", "PENDING_ACCEPTANCE"].includes(raw)) return "进行中";
  return "正式完成";
}

export function isTrustedCustomerValue(value: any): boolean {
  const trustLevel = upper(value?.trust_level ?? value?.trustLevel);
  return value?.customer_visible_value === true && trustLevel === "FORMAL_ACCEPTED";
}

export function isTrustedDashboardValueSummary(summary: any): boolean {
  const trustLevel = upper(summary?.trust_level ?? summary?.trustLevel);
  return summary?.has_customer_visible_value === true && (!trustLevel || trustLevel === "FORMAL_ACCEPTED" || trustLevel === "FORMAL_CHAIN_PASSED");
}

export function customerValueSummaryText(summary: any, total: number, formatter: (n: number) => string): string {
  if (isTrustedDashboardValueSummary(summary)) return total ? `已有 ${formatter(total)} 条正式可信价值记录。` : "暂无正式可信价值记录。";
  return total ? `已有 ${formatter(total)} 条价值线索；需通过正式验收、正式证据和链路校验后才可作为可信收益。` : "暂无可信价值记录；缺少正式链路校验时不形成收益结论。";
}

export function customerTrustScopeText(): string {
  return "客户页仅展示通过正式链路校验的完成、验收、价值和学习结论；未通过门禁的数据仅作为待复核线索。";
}