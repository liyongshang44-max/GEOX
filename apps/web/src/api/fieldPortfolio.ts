import { apiRequest, withQuery } from "./client";
import type { ProgramPortfolioItemV1 as FieldPortfolioItemV1Projection } from "../../../server/src/projections/program_portfolio_v1";

export type FieldPortfolioItemV1 = FieldPortfolioItemV1Projection;

export type FetchFieldPortfolioParams = {
  field_id?: string;
  season_id?: string;
  status?: string;
  next_action_priority?: "LOW" | "MEDIUM" | "HIGH";
  limit?: number;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
};

export type FieldPortfolioSummaryV1 = Record<string, unknown>;

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

export async function fetchFieldPortfolio(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioItemV1[]> {
  const res = await apiRequest<FieldPortfolioListResponse>(withQuery("/api/v1/field-portfolio", params));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchFieldPortfolioSummary(params: FetchFieldPortfolioParams = {}): Promise<FieldPortfolioSummaryV1> {
  const res = await apiRequest<FieldPortfolioSummaryResponse>(withQuery("/api/v1/field-portfolio/summary", params));
  return (res.summary && typeof res.summary === "object") ? res.summary : {};
}

export async function fetchFieldTags(fieldId: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/field-portfolio/${encodeURIComponent(fieldId)}/tags`));
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export async function addFieldTag(fieldId: string, tag: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/field-portfolio/${encodeURIComponent(fieldId)}/tags`), {
    method: "POST",
    body: JSON.stringify({ tag }),
  });
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export async function removeFieldTag(fieldId: string, tag: string): Promise<string[]> {
  const res = await apiRequest<FieldTagsResponse>(withQuery(`/api/v1/field-portfolio/${encodeURIComponent(fieldId)}/tags`), {
    method: "DELETE",
    body: JSON.stringify({ tag }),
  });
  return Array.isArray(res.tags) ? res.tags.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}
