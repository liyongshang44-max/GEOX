import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { enrichOperationReportChainV1 } from "../projections/operation_report_chain_v1.js";
import { enrichOperationReportValueChainRoiV1 } from "../domain/roi/value_chain_roi_v1.js";
import {
  applyGuardedDashboardAggregateV1,
  applyGuardedFieldReportV1,
  applyGuardedOperationReportV1,
} from "../projections/guarded_report_v1.js";

function pathOf(url: string | undefined): string {
  return String(url ?? "").split("?")[0];
}

function isOperationReportPath(url: string | undefined): boolean {
  return /^\/api\/v1\/reports\/operation\/[^/]+$/.test(pathOf(url));
}

function isDashboardAggregatePath(url: string | undefined): boolean {
  return pathOf(url) === "/api/v1/reports/customer-dashboard/aggregate";
}

function isFieldPortfolioPath(url: string | undefined): boolean {
  return pathOf(url) === "/api/v1/reports/customer-dashboard/field-portfolio-summary";
}

function isFieldReportPath(url: string | undefined): boolean {
  return /^\/api\/v1\/reports\/field\/[^/]+$/.test(pathOf(url));
}

function isGuardedReportPath(url: string | undefined): boolean {
  return isOperationReportPath(url) || isDashboardAggregatePath(url) || isFieldPortfolioPath(url) || isFieldReportPath(url);
}

function parsePayload(payload: unknown): any | null {
  if (Buffer.isBuffer(payload)) {
    try { return JSON.parse(payload.toString("utf8")); } catch { return null; }
  }
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return null; }
  }
  if (payload && typeof payload === "object") return payload;
  return null;
}

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
    execution: chainExecution ? {
      ...(baseReport.execution ?? {}),
      ...chainExecution,
    } : (baseReport.execution ?? null),
    evidence: {
      ...(baseReport.evidence ?? {}),
      ...(chainEvidence ?? {}),
    },
    acceptance: chainAcceptance ? {
      ...(baseReport.acceptance ?? {}),
      ...chainAcceptance,
    } : (baseReport.acceptance ?? null),
  };
}

async function guardOperationReportResponse(pool: Pool, parsed: any): Promise<any> {
  const report = parsed?.operation_report_v1;
  if (!report || typeof report !== "object") return parsed;
  const enriched = await enrichOperationReportChainV1({ pool, report });
  const compatible = mergeReportCompatibility(report, enriched);
  const withValueChainRoi = enrichOperationReportValueChainRoiV1(compatible);
  const guarded = applyGuardedOperationReportV1(withValueChainRoi);
  return { ...parsed, operation_report_v1: guarded };
}

function guardDashboardAggregateResponse(parsed: any): any {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (parsed.aggregate) return { ...parsed, aggregate: applyGuardedDashboardAggregateV1(parsed.aggregate) };
  if (parsed.summary) return { ...parsed, summary: applyGuardedDashboardAggregateV1(parsed.summary) };
  return parsed;
}

function guardFieldReportResponse(parsed: any): any {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (parsed.field_report_v1) return { ...parsed, field_report_v1: applyGuardedFieldReportV1(parsed.field_report_v1) };
  return parsed;
}

export function registerOperationReportChainHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isGuardedReportPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    if (!parsed || typeof parsed !== "object") return payload;

    if (isOperationReportPath(req.url)) {
      return JSON.stringify(await guardOperationReportResponse(pool, parsed));
    }
    if (isDashboardAggregatePath(req.url) || isFieldPortfolioPath(req.url)) {
      return JSON.stringify(guardDashboardAggregateResponse(parsed));
    }
    if (isFieldReportPath(req.url)) {
      return JSON.stringify(guardFieldReportResponse(parsed));
    }
    return payload;
  });
}
