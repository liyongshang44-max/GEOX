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

export function registerOperationReportChainHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isOperationReportPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    const report = parsed?.operation_report_v1;
    if (!report || typeof report !== "object") return payload;
    const enriched = await enrichOperationReportChainV1({ pool, report });
    return JSON.stringify({ ...parsed, operation_report_v1: enriched });
  });
}
