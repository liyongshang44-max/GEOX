import { apiRequest, withQuery } from "./client";
import type {
  FieldPortfolioItemV1 as FieldPortfolioItemV1Projection,
  FieldPortfolioRiskLevel,
  ProjectFieldPortfolioListV1Args,
} from "../../../server/src/projections/field_portfolio_v1";

export type FieldPortfolioItemV1 = FieldPortfolioItemV1Projection;

export type FieldPortfolioSummaryV1 = {
  total_fields: number;
  by_risk: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  total_open_alerts: number;
  total_pending_acceptance: number;
  total_invalid_execution: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  offline_fields: number;
};

export type FetchFieldPortfolioParams = {
  tags?: string[];
  risk_levels?: FieldPortfolioRiskLevel[];
  has_open_alerts?: boolean;
  has_pending_acceptance?: boolean;
  query?: string;
  sort_by?: ProjectFieldPortfolioListV1Args["sort_by"];
  sort_order?: ProjectFieldPortfolioListV1Args["sort_order"];
  page?: number;
  page_size?: number;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  field_ids?: string[];
  window_ms?: number;
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

const EMPTY_FIELD_PORTFOLIO_SUMMARY: FieldPortfolioSummaryV1 = {
  total_fields: 0,
  by_risk: {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  },
  total_open_alerts: 0,
  total_pending_acceptance: 0,
  total_invalid_execution: 0,
  total_estimated_cost: 0,
  total_actual_cost: 0,
  offline_fields: 0,
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
