import type { FastifyInstance } from "fastify";
import { enrichPayloadRecommendationsValueHypothesisV1, enrichOperationReportValueChainRoiV1 } from "../domain/roi/value_chain_roi_v1.js";

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

function pathOnly(url: string | undefined): string {
  return String(url ?? "").split("?")[0];
}

function isDecisionRecommendationPath(url: string | undefined): boolean {
  const path = pathOnly(url);
  return path.startsWith("/api/v1/recommendations");
}

function isOperationReportPath(url: string | undefined): boolean {
  return /^\/api\/v1\/reports\/operation\/[^/]+$/.test(pathOnly(url));
}

export function registerValueChainRoiResponseHooksV1(app: FastifyInstance): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400) return payload;
    const parsed = parsePayload(payload);
    if (!parsed || typeof parsed !== "object") return payload;

    if (isDecisionRecommendationPath(req.url)) {
      return JSON.stringify(enrichPayloadRecommendationsValueHypothesisV1(parsed));
    }

    if (isOperationReportPath(req.url) && parsed.operation_report_v1 && typeof parsed.operation_report_v1 === "object") {
      return JSON.stringify({ ...parsed, operation_report_v1: enrichOperationReportValueChainRoiV1(parsed.operation_report_v1) });
    }

    return payload;
  });
}
