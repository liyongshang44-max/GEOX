import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildGuardedOperationReportV1 } from "../projections/guarded_operation_report_projector_v1.js";
import {
  applyGuardedCustomerFieldsResponseV1,
  applyGuardedCustomerOperationsResponseV1,
  applyGuardedCustomerReportsResponseV1,
  applyGuardedDashboardAggregateV1,
  applyGuardedFieldReportV1,
} from "../projections/guarded_report_v1.js";

function pathOf(url: string | undefined): string { return String(url ?? "").split("?")[0]; }
function isOperationReportPath(url: string | undefined): boolean { return /^\/api\/v1\/reports\/operation\/[^/]+$/.test(pathOf(url)); }
function isDashboardAggregatePath(url: string | undefined): boolean { return pathOf(url) === "/api/v1/reports/customer-dashboard/aggregate"; }
function isFieldPortfolioPath(url: string | undefined): boolean { return pathOf(url) === "/api/v1/reports/customer-dashboard/field-portfolio-summary"; }
function isFieldReportPath(url: string | undefined): boolean { return /^\/api\/v1\/reports\/field\/[^/]+$/.test(pathOf(url)); }
function isCustomerOperationsPath(url: string | undefined): boolean { return pathOf(url) === "/api/v1/customer/operations"; }
function isCustomerReportsPath(url: string | undefined): boolean { return pathOf(url) === "/api/v1/customer/reports"; }
function isCustomerFieldsPath(url: string | undefined): boolean { return pathOf(url) === "/api/v1/customer/fields"; }
function isGuardedReportPath(url: string | undefined): boolean {
  return isOperationReportPath(url)
    || isDashboardAggregatePath(url)
    || isFieldPortfolioPath(url)
    || isFieldReportPath(url)
    || isCustomerOperationsPath(url)
    || isCustomerReportsPath(url)
    || isCustomerFieldsPath(url);
}

function parsePayload(payload: unknown): any | null {
  if (Buffer.isBuffer(payload)) { try { return JSON.parse(payload.toString("utf8")); } catch { return null; } }
  if (typeof payload === "string") { try { return JSON.parse(payload); } catch { return null; } }
  if (payload && typeof payload === "object") return payload;
  return null;
}

async function guardOperationReportResponse(pool: Pool, parsed: any): Promise<any> {
  const report = parsed?.operation_report_v1;
  if (!report || typeof report !== "object") return parsed;
  const guarded = await buildGuardedOperationReportV1({ pool, report });
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

function guardCustomerResponse(url: string | undefined, parsed: any): any {
  if (isCustomerOperationsPath(url)) return applyGuardedCustomerOperationsResponseV1(parsed);
  if (isCustomerReportsPath(url)) return applyGuardedCustomerReportsResponseV1(parsed);
  if (isCustomerFieldsPath(url)) return applyGuardedCustomerFieldsResponseV1(parsed);
  return parsed;
}

export function registerOperationReportChainHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isGuardedReportPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    if (!parsed || typeof parsed !== "object") return payload;
    if (isOperationReportPath(req.url)) return JSON.stringify(await guardOperationReportResponse(pool, parsed));
    if (isDashboardAggregatePath(req.url) || isFieldPortfolioPath(req.url)) return JSON.stringify(guardDashboardAggregateResponse(parsed));
    if (isFieldReportPath(req.url)) return JSON.stringify(guardFieldReportResponse(parsed));
    if (isCustomerOperationsPath(req.url) || isCustomerReportsPath(req.url) || isCustomerFieldsPath(req.url)) return JSON.stringify(guardCustomerResponse(req.url, parsed));
    return payload;
  });
}
