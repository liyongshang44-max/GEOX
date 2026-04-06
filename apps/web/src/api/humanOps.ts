import { apiRequest, withQuery } from "./client";

export type HumanOpsFilters = {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  from_ts_ms?: number;
  to_ts_ms?: number;
};

export type HumanOpsKpiResponse = {
  ok?: boolean;
  filters?: HumanOpsFilters;
  kpi?: {
    on_time_rate: number | null;
    avg_accept_duration_ms: number | null;
    avg_submit_duration_ms: number | null;
    first_pass_rate: number | null;
    total_assignments: number;
    submitted_count: number;
  };
  trend?: Array<{
    date_bucket: string;
    total_assignments: number;
    submitted_count: number;
    on_time_rate: number | null;
    first_pass_rate: number | null;
  }>;
};

export type HumanOpsRankingResponse = {
  ok?: boolean;
  items?: Array<{
    rank: number;
    dimension: "executor" | "team";
    dimension_id: string;
    total_assignments: number;
    submitted_count: number;
    on_time_rate: number | null;
    first_pass_rate: number | null;
    avg_accept_duration_ms: number | null;
    avg_submit_duration_ms: number | null;
  }>;
};

export type HumanOpsExceptionResponse = {
  ok?: boolean;
  items?: Array<{
    exception_code: string;
    count: number;
    sample_task_id: string;
  }>;
};

export async function fetchHumanOpsKpi(params?: HumanOpsFilters): Promise<HumanOpsKpiResponse> {
  return apiRequest<HumanOpsKpiResponse>(withQuery("/api/v1/human-ops/kpi", params));
}

export async function fetchHumanOpsRanking(params?: HumanOpsFilters & { dimension?: "executor" | "team"; limit?: number }): Promise<HumanOpsRankingResponse> {
  return apiRequest<HumanOpsRankingResponse>(withQuery("/api/v1/human-ops/executor-ranking", params));
}

export async function fetchHumanOpsExceptionAnalysis(params?: HumanOpsFilters & { limit?: number }): Promise<HumanOpsExceptionResponse> {
  return apiRequest<HumanOpsExceptionResponse>(withQuery("/api/v1/human-ops/exception-analysis", params));
}
