import { apiRequest, withQuery } from "./client";
import type { ProgramPortfolioItemV1 as FieldPortfolioItemV1Projection } from "../../../server/src/projections/program_portfolio_v1";
import type { FieldPortfolioSummaryV1 as FieldPortfolioSummaryV1Projection } from "../../../server/src/projections/report_dashboard_v1";

export type FieldPortfolioItemV1 = FieldPortfolioItemV1Projection;
export type FieldPortfolioSummaryV1 = FieldPortfolioSummaryV1Projection;

export type FetchFieldPortfolioParams = {
  tags?: string[];
  risk_levels?: Array<"LOW" | "MEDIUM" | "HIGH">;
  has_open_alerts?: boolean;
  has_pending_acceptance?: boolean;
  query?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  fieldIds?: string[];
  timeRange?: "7d" | "30d" | "season";
};

type FieldPortfolioListResponse = {
  ok?: boolean;
  count?: number;
  items?: FieldPortfolioItemV1[];
};

type FieldPortfolioSummaryResponse = {
  ok?: boolean;
  summary?: FieldPortfolioSummaryV1;
};

type FieldTagsResponse = {
  ok?: boolean;
  field_id?: string;
  tags?: string[];
};

function toPortfolioQuery(params: FetchFieldPortfolioParams): Record<string, unknown> {
  const fieldIds = Array.isArray(params.fieldIds) ? params.fieldIds.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  return {
    "tags[]": params.tags,
    "risk_levels[]": params.risk_levels,
    has_open_alerts: params.has_open_alerts,
    has_pending_acceptance: params.has_pending_acceptance,
    query: params.query,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
    page: params.page,
    page_size: params.page_size,
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    group_id: params.group_id,
    "field_ids[]": fieldIds.length ? fieldIds : undefined,
    time_range: params.timeRange,
  };
}

export async function fetchFieldPortfolio(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioItemV1[]> {
  const res = await apiRequest<FieldPortfolioListResponse>(withQuery("/api/v1/fields/portfolio", toPortfolioQuery(params)));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchFieldPortfolioSummary(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioSummaryV1> {
  const query: Record<string, string | number | boolean | string[]> = { ...params };
  const fieldIds = Array.isArray(params.fieldIds) ? params.fieldIds.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  delete query.fieldIds;
  if (fieldIds.length) query["field_ids[]"] = fieldIds;
  if (params.timeRange) query.time_range = params.timeRange;
  delete query.timeRange;
  const res = await apiRequest<FieldPortfolioSummaryResponse>(withQuery("/api/v1/fields/portfolio/summary", query));
  return (res.summary && typeof res.summary === "object") ? res.summary : ({} as FieldPortfolioSummaryV1);
}

export async function fetchFieldTags(fieldId: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/fields/${encodeURIComponent(fieldId)}/tags`));
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export async function addFieldTag(fieldId: string, tag: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/fields/${encodeURIComponent(fieldId)}/tags`), {
    method: "POST",
    body: JSON.stringify({ tag }),
  });
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export async function removeFieldTag(fieldId: string, tag: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/fields/${encodeURIComponent(fieldId)}/tags/${encodeURIComponent(tag)}`), {
    method: "DELETE",
  });
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}
