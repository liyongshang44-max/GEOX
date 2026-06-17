import type { Pool } from "pg";
import { enrichOperationReportValueChainRoiV1 } from "../domain/roi/value_chain_roi_v1.js";
import { applyGuardedOperationReportV1 } from "./guarded_report_v1.js";
import { enrichOperationReportChainV1 } from "./operation_report_chain_v1.js";

function mergeReportCompatibility(baseReport: any, enrichedReport: any): any {
  const chainApproval = enrichedReport?.approval;
  const chainExecution = enrichedReport?.execution;
  const chainEvidence = enrichedReport?.evidence;
  const chainAcceptance = enrichedReport?.acceptance;
  return {
    ...enrichedReport,
    approval: chainApproval ? {
      ...(baseReport.approval ?? {}),
      ...chainApproval,
      actor_id: baseReport.approval?.actor_id ?? chainApproval.approver?.actor_id ?? null,
      actor_name: baseReport.approval?.actor_name ?? chainApproval.approver?.name ?? null,
      generated_at: baseReport.approval?.generated_at ?? null,
      approved_at: baseReport.approval?.approved_at ?? chainApproval.approved_at ?? null,
      note: baseReport.approval?.note ?? chainApproval.decision_note ?? null,
    } : (baseReport.approval ?? null),
    execution: chainExecution ? { ...(baseReport.execution ?? {}), ...chainExecution } : (baseReport.execution ?? null),
    evidence: { ...(baseReport.evidence ?? {}), ...(chainEvidence ?? {}) },
    acceptance: chainAcceptance ? { ...(baseReport.acceptance ?? {}), ...chainAcceptance } : (baseReport.acceptance ?? null),
    irrigation_decision_report_v1: enrichedReport?.irrigation_decision_report_v1 ?? baseReport?.irrigation_decision_report_v1 ?? null,
  };
}

function missingGuardedOperationReportFields(report: any): string[] {
  const missing: string[] = [];
  if (report?.guarded_projection?.enabled !== true) missing.push("guarded_projection.enabled");
  if (!report?.chain_validation) missing.push("chain_validation");
  if (!Array.isArray(report?.status_chain)) missing.push("status_chain");
  if (typeof report?.customer_visible_eligible !== "boolean") missing.push("customer_visible_eligible");
  if (!Array.isArray(report?.blocking_reasons)) missing.push("blocking_reasons");
  if (typeof report?.fallback_limited !== "boolean") missing.push("fallback_limited");
  return missing;
}

export function ensureGuardedOperationReportContractV1(report: any): any {
  if (!report || typeof report !== "object") return report;
  if (report?.guarded_projection?.enabled !== true) return report;
  const missing = missingGuardedOperationReportFields(report);
  if (missing.length === 0) return report;
  return {
    ...report,
    guarded_projection: {
      ...(report.guarded_projection ?? {}),
      enabled: true,
      contract_warning: "GUARDED_REPORT_CONTRACT_FIELDS_MISSING",
      missing_fields: missing,
    },
    guard_contract_warning: {
      code: "GUARDED_REPORT_CONTRACT_FIELDS_MISSING",
      missing_fields: missing,
    },
  };
}

export async function buildGuardedOperationReportV1(params: { pool: Pool; report: any }): Promise<any> {
  const report = params.report ?? {};
  if (report?.guarded_projection?.enabled === true) return ensureGuardedOperationReportContractV1(report);

  const chainEnriched = await enrichOperationReportChainV1({ pool: params.pool, report });
  const compatible = mergeReportCompatibility(report, chainEnriched);
  const withValueChainRoi = enrichOperationReportValueChainRoiV1(compatible);
  const guarded = applyGuardedOperationReportV1(withValueChainRoi);
  return ensureGuardedOperationReportContractV1(guarded);
}
