import { apiRequest, withQuery } from "./client";
import type {
  FieldPortfolioItemV1 as FieldPortfolioItemV1Projection,
  FieldPortfolioListResponseV1 as FieldPortfolioListResponseV1Projection,
} from "../../../server/src/projections/field_portfolio_v1";

export type FieldPortfolioItemV1 = FieldPortfolioItemV1Projection;
export type FieldPortfolioSummaryV1 = FieldPortfolioListResponseV1Projection["summary"];

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

  query?: string;
  risk_level?: "HIGH" | "MEDIUM" | "LOW";
  has_open_alerts?: boolean;
  has_pending_acceptance?: boolean;
  tags?: string[];
  sort?: "business_priority" | "updated_desc" | "cost_desc";
  page?: number;
  page_size?: number;
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
  };
}

export async function fetchFieldPortfolio(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioItemV1[]> {
  const res = await apiRequest<FieldPortfolioListResponse>(withQuery("/api/v1/fields/portfolio", toPortfolioQuery(params)));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchFieldPortfolioSummary(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioSummaryV1> {
  const res = await apiRequest<FieldPortfolioSummaryResponse>(withQuery("/api/v1/fields/portfolio/summary", toPortfolioQuery(params)));
  return (res.summary && typeof res.summary === "object")
    ? res.summary
    : {
      total_fields: 0,
      by_risk: { low: 0, medium: 0, high: 0 },
      total_open_alerts: 0,
      total_pending_acceptance: 0,
      total_invalid_execution: 0,
      total_estimated_cost: 0,
      total_actual_cost: 0,
      offline_fields: 0,
    };
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
