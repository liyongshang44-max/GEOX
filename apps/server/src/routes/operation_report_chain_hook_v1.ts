import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { enrichOperationReportChainV1 } from "../projections/operation_report_chain_v1.js";

function isOperationReportPath(url: string | undefined): boolean {
  const path = String(url ?? "").split("?")[0];
  return /^\/api\/v1\/reports\/operation\/[^/]+$/.test(path);
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

export function registerOperationReportChainHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isOperationReportPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    const report = parsed?.operation_report_v1;
    if (!report || typeof report !== "object") return payload;
    const enriched = await enrichOperationReportChainV1({ pool, report });
    const compatible = mergeReportCompatibility(report, enriched);
    return JSON.stringify({ ...parsed, operation_report_v1: compatible });
  });
}
