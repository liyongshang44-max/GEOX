export type CustomerGuardedStatus = "PASSED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "SIMULATED" | "LIMITED";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

export function isCustomerFormalChainPassed(value: any): boolean {
  const formal = value?.formal_scenario ?? {};
  const trustLevel = upper(value?.trust_level ?? value?.trustLevel ?? value?.guarded_projection?.trust_level ?? formal.trust_level);
  const chainStatus = upper(value?.chain_status ?? value?.chainStatus ?? value?.formal_chain_status ?? formal.formal_chain_status ?? value?.guarded_projection?.chain_status);
  const evidenceStatus = upper(value?.evidence_status ?? formal.evidence_status);
  const chainPassed = value?.chain_validation?.passed === true || value?.guarded_projection?.passed === true || chainStatus === "PASSED";
  const visibleEligible = value?.customer_visible_eligible !== false && value?.customerVisibleEligible !== false && formal.customer_visible_eligible !== false;
  const needsReview = value?.needs_review === true || value?.needsReview === true || formal.needs_review === true;
  const simulated = value?.is_simulated === true || value?.isSimulated === true || chainStatus === "SIMULATED" || trustLevel === "SIMULATED_DEV_ONLY";
  const formalTrust = !trustLevel || trustLevel === "FORMAL_CHAIN_PASSED" || trustLevel === "FORMAL_ACCEPTED";
  const missingEvidence = evidenceStatus === "MISSING" || evidenceStatus === "TECHNICAL_ONLY";
  return chainPassed && visibleEligible && !needsReview && !simulated && formalTrust && !missingEvidence;
}

export function customerGuardedStatus(value: any): CustomerGuardedStatus {
  if (isCustomerFormalChainPassed(value)) return "PASSED";
  const formal = value?.formal_scenario ?? {};
  const trustLevel = upper(value?.trust_level ?? value?.trustLevel ?? value?.guarded_projection?.trust_level ?? formal.trust_level);
  const chainStatus = upper(value?.chain_status ?? value?.chainStatus ?? value?.formal_chain_status ?? formal.formal_chain_status ?? value?.guarded_projection?.chain_status);
  const evidenceStatus = upper(value?.evidence_status ?? formal.evidence_status);
  if (value?.is_simulated === true || value?.isSimulated === true || chainStatus === "SIMULATED" || trustLevel === "SIMULATED_DEV_ONLY") return "SIMULATED";
  if (chainStatus === "INSUFFICIENT_EVIDENCE" || trustLevel === "INSUFFICIENT_FORMAL_EVIDENCE" || evidenceStatus === "MISSING" || evidenceStatus === "TECHNICAL_ONLY") return "INSUFFICIENT_EVIDENCE";
  if (chainStatus === "LIMITED" || trustLevel === "LIMITED_FALLBACK") return "LIMITED";
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
