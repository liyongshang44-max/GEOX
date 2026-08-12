// Purpose: consume the MCFT-CAP-07 S4 canonical GET-only Runtime namespace from the Operator UI.
// Boundary: exact six-key scope, read-only requests, no legacy truth fallback, no write-capable dependency.

import { readTenantContext } from "../auth/authStorage";
import { apiRequestWithPolicy, withQuery } from "./client";

export type McftFieldTwinScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type McftCanonicalRefV1 = {
  object_ref: string;
  object_type: string;
  object_hash: string;
  source_fact_ref: string | null;
};

export type McftAttachmentV1<T = McftCanonicalRefV1> = {
  attachment_status: "ATTACHED_EXACT" | "ABSENT_OPTIONAL_DOMAIN" | string;
  reason_code: string | null;
  item: T | null;
};

export type McftCollectionSummaryV1 = {
  collection_kind: string;
  attachment_status: string;
  reason_code: string | null;
  has_items: boolean;
  count_status: "NOT_COMPUTED" | "EXACT_VALIDATED_PROJECTION" | string;
  total_count: number | null;
  latest_item_ref: string | null;
  latest_item_hash: string | null;
  collection_endpoint: string;
};

export type McftCollectionItemV1 = {
  object_ref: string;
  object_type: string;
  object_hash: string;
  logical_time: string;
  attachment_status: string;
  [key: string]: unknown;
};

export type McftCollectionPageV1 = {
  schema_version: "field_twin_collection_page_v1";
  collection_kind: string;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: string;
  items: McftCollectionItemV1[];
  page_limit: number;
  has_more: boolean;
  next_cursor: string | null;
  collection_items_content_hash: string;
  collection_page_content_hash: string;
  response_started_at: string;
  response_instance_hash: string;
  [key: string]: unknown;
};

export type McftRuntimeReadModelV1 = {
  schema_version: "minimal_field_twin_runtime_read_model_v1";
  request_scope: McftFieldTwinScopeV1;
  response_started_at: string;
  root_graph_status: string;
  active_lineage: McftCanonicalRefV1 | null;
  checkpoint: McftCanonicalRefV1 | null;
  runtime_tick: McftCanonicalRefV1 | null;
  evidence_window: McftCanonicalRefV1 | null;
  state_transition: McftCanonicalRefV1 | null;
  assimilation_update: McftCanonicalRefV1 | null;
  posterior_state: McftCanonicalRefV1 | null;
  terminal_record_set_health: McftCanonicalRefV1 | null;
  runtime_config: McftCanonicalRefV1 | null;
  current_tick_forecast_result: McftCanonicalRefV1 | null;
  latest_successful_forecast: McftAttachmentV1;
  scenario_source_forecast: McftAttachmentV1;
  current_scenario_attachment: McftAttachmentV1;
  latest_scenario_in_scope: McftAttachmentV1;
  current_human_decision: McftAttachmentV1;
  current_approved_plan: McftAttachmentV1;
  action_feedback_summary: McftCollectionSummaryV1;
  forecast_residual_summary: McftCollectionSummaryV1;
  calibration_candidate_summary: McftCollectionSummaryV1;
  shadow_evaluation_summary: McftCollectionSummaryV1;
  model_activation_summary: McftCollectionSummaryV1;
  limitations: Array<Record<string, unknown>>;
  validation_summary: Array<Record<string, unknown>>;
  root_graph_content_hash: string;
  attachment_content_hash: string;
  response_instance_hash: string;
  [key: string]: unknown;
};

export type McftTraceGraphV1 = {
  schema_version: "field_twin_trace_graph_v1";
  request_scope: McftFieldTwinScopeV1;
  response_started_at: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  trace_graph_content_hash: string;
  response_instance_hash: string;
  [key: string]: unknown;
};

export type McftTimelinePageV1 = {
  schema_version: "field_twin_timeline_page_v1";
  fixed_root_ref: string;
  fixed_root_graph_content_hash: string;
  items: Array<Record<string, unknown>>;
  page_limit: number;
  has_more: boolean;
  next_cursor: string | null;
  timeline_items_content_hash: string;
  timeline_page_content_hash: string;
  response_started_at: string;
  response_instance_hash: string;
  [key: string]: unknown;
};

export type McftRuntimeHealthV1 = {
  schema_version: "field_twin_runtime_health_read_model_v1";
  request_scope: McftFieldTwinScopeV1;
  response_started_at: string;
  terminal_record_set_health: McftCanonicalRefV1 | null;
  latest_operational_runtime_health: McftCanonicalRefV1 | null;
  health_relationship: "SAME_OBJECT" | "LATEST_OPERATIONAL_IS_LATER" | "TERMINAL_ONLY" | "OPERATIONAL_ONLY" | "BOTH_ABSENT";
  health_role_resolutions?: Array<Record<string, unknown>>;
  health_pointer_validation_summary?: Array<Record<string, unknown>>;
  health_content_hash: string;
  response_instance_hash: string;
  [key: string]: unknown;
};

export type McftSchedulerSummaryV1 = {
  scheduler_status: "WAITING" | "RUNNING" | "COMPLETED" | "NOT_ESTABLISHED";
  latest_completed_slot: string | null;
  latest_tick_ref: string | null;
  latest_tick_status: "COMPLETED" | "DEGRADED" | "FAILED" | null;
  latest_tick_started_at: null;
  latest_tick_completed_at: string | null;
  next_target_slot: string | null;
  next_target_at: string | null;
  scheduler_lag_ms: number | null;
};

export type McftEvidenceAvailabilityV1 = {
  eligibility_boundary: { slot_id: string; logical_time: string } | null;
  latest_evidence_observed_at: string | null;
  latest_evidence_ingested_at: string | null;
  evidence_age_ms: number | null;
  freshness_status: "FRESH" | "STALE" | "MISSING" | "UNKNOWN";
  freshness_threshold_ms: number;
  coverage_ratio: number | null;
  maximum_gap_ms: number | null;
  future_excluded_count: number | null;
  late_evidence_count: number | null;
  out_of_order_count: number | null;
};

export type McftRuntimeDegradationStatusV1 = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
export type McftDegradationReasonCodeV1 =
  | "CHECKPOINT_NOT_ESTABLISHED"
  | "EVIDENCE_BOUNDARY_NOT_ESTABLISHED"
  | "EVIDENCE_STALE"
  | "EVIDENCE_MISSING"
  | "SCHEDULER_LAG";
export type McftOperationalStatusV1 = {
  runtime_degradation_status: McftRuntimeDegradationStatusV1;
  degradation_reason_codes: McftDegradationReasonCodeV1[];
  forecast_status: "COMPLETED" | "BLOCKED" | null;
  scenario_source_eligible: boolean | null;
};
export type McftOperationalSlotStateV1 = "CLAIMED" | "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED" | "NOT_MATERIALIZED";
export type McftOperationalSlotEntryV1 = {
  slot_id: string;
  logical_time: string;
  state: McftOperationalSlotStateV1;
  tick_ref: string | null;
  health_ref: string | null;
  terminal_at: string | null;
};
export type McftOperationalSlotWindowV1 = {
  schedule_start_logical_time: string;
  interval_seconds: 3600;
  entries: McftOperationalSlotEntryV1[];
};

export type McftOperationalSummaryV1 = {
  schema_version: "pfe14_mcft09_operational_summary_v1";
  request_scope: McftFieldTwinScopeV1;
  response_started_at: string;
  scheduler_summary: McftSchedulerSummaryV1;
  evidence_availability: McftEvidenceAvailabilityV1;
  operational_status: McftOperationalStatusV1;
  slot_window: McftOperationalSlotWindowV1 | null;
  limitations: string[];
  validation_summary: string[];
  operational_content_hash: string;
  response_instance_hash: string;
};

export type McftApiErrorV1 = {
  schema_version: string;
  status: number;
  error_code: string;
  failed_profiles: string[];
  diagnostics: string[];
  request_id: string;
  url: string;
};

export type McftScopeResolutionV1 =
  | { ok: true; scope: McftFieldTwinScopeV1 }
  | { ok: false; missing_keys: Array<keyof McftFieldTwinScopeV1> };

export type McftCanonicalTabKey =
  | "overview"
  | "state"
  | "forecast"
  | "scenario"
  | "action-lifecycle"
  | "residual"
  | "calibration"
  | "evidence-trace"
  | "health";

export type McftTabBundleV1 = {
  tab: McftCanonicalTabKey;
  runtime?: McftRuntimeReadModelV1;
  collection?: McftCollectionPageV1;
  governance?: {
    calibration_candidate: McftCollectionPageV1;
    shadow_evaluation: McftCollectionPageV1;
    model_activation: McftCollectionPageV1;
  };
  trace?: McftTraceGraphV1;
  timeline?: McftTimelinePageV1;
  health?: McftRuntimeHealthV1;
};

const MCFT_ALLOWED_ERROR_STATUSES = [400, 403, 404, 409, 503];

function exactValue(searchParams: URLSearchParams, key: string, fallback = ""): string {
  return String(searchParams.get(key) || fallback || "").trim();
}

export function resolveMcftRuntimeScope(fieldId: string, searchParams: URLSearchParams): McftScopeResolutionV1 {
  const tenant = readTenantContext();
  const scope: McftFieldTwinScopeV1 = {
    tenant_id: exactValue(searchParams, "tenant_id", tenant?.tenant_id),
    project_id: exactValue(searchParams, "project_id", tenant?.project_id),
    group_id: exactValue(searchParams, "group_id", tenant?.group_id),
    field_id: String(fieldId || "").trim(),
    season_id: exactValue(searchParams, "season_id"),
    zone_id: exactValue(searchParams, "zone_id"),
  };
  const keys = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
  const missing_keys = keys.filter((key) => !scope[key]);
  return missing_keys.length ? { ok: false, missing_keys: [...missing_keys] } : { ok: true, scope };
}

function parseMcftError(status: number, bodyText: string, url: string): McftApiErrorV1 {
  try {
    const parsed = JSON.parse(bodyText) as Partial<McftApiErrorV1> & { code?: string; error?: string };
    return {
      schema_version: String(parsed.schema_version || "mcft_field_twin_api_error_v1"),
      status,
      error_code: String(parsed.error_code || parsed.code || parsed.error || `HTTP_${status}`),
      failed_profiles: Array.isArray(parsed.failed_profiles) ? parsed.failed_profiles.map(String) : [],
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics.map(String) : bodyText ? [bodyText.slice(0, 500)] : [],
      request_id: String(parsed.request_id || "NOT_PROVIDED"),
      url,
    };
  } catch {
    return {
      schema_version: "mcft_field_twin_api_error_v1",
      status,
      error_code: `HTTP_${status}`,
      failed_profiles: [],
      diagnostics: bodyText ? [bodyText.slice(0, 500)] : [],
      request_id: "NOT_PROVIDED",
      url,
    };
  }
}

function runtimePath(scope: McftFieldTwinScopeV1, suffix = ""): string {
  return `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime${suffix}`;
}

async function getMcft<T>(scope: McftFieldTwinScopeV1, suffix = "", extra?: Record<string, unknown>): Promise<T> {
  const path = withQuery(runtimePath(scope, suffix), {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
    ...extra,
  });
  const result = await apiRequestWithPolicy<T>(path, { method: "GET" }, {
    allowedStatuses: MCFT_ALLOWED_ERROR_STATUSES,
    dedupe: true,
    silent: true,
    timeoutMs: 15000,
  });
  if (result.ok) return result.data;
  throw parseMcftError(result.status, result.bodyText, result.url);
}

export function isMcftApiError(value: unknown): value is McftApiErrorV1 {
  return Boolean(value && typeof value === "object" && "error_code" in value && "status" in value);
}

export const readMcftRuntime = (scope: McftFieldTwinScopeV1) => getMcft<McftRuntimeReadModelV1>(scope);
export const readMcftOperationalSummary = (scope: McftFieldTwinScopeV1) => getMcft<McftOperationalSummaryV1>(scope, "/operational-summary");
export const readMcftStates = (scope: McftFieldTwinScopeV1) => getMcft<McftCollectionPageV1>(scope, "/states", { limit: 50 });
export const readMcftForecasts = (scope: McftFieldTwinScopeV1) => getMcft<McftCollectionPageV1>(scope, "/forecasts", { limit: 50 });
export const readMcftScenarios = (scope: McftFieldTwinScopeV1) => getMcft<McftCollectionPageV1>(scope, "/scenarios", { limit: 50 });
export const readMcftActionLifecycle = (scope: McftFieldTwinScopeV1) => getMcft<McftCollectionPageV1>(scope, "/action-lifecycle", { limit: 50 });
export const readMcftResiduals = (scope: McftFieldTwinScopeV1) => getMcft<McftCollectionPageV1>(scope, "/residuals", { limit: 50 });
export const readMcftTrace = (scope: McftFieldTwinScopeV1) => getMcft<McftTraceGraphV1>(scope, "/trace");
export const readMcftTimeline = (scope: McftFieldTwinScopeV1) => getMcft<McftTimelinePageV1>(scope, "/timeline", { limit: 50 });
export const readMcftHealth = (scope: McftFieldTwinScopeV1) => getMcft<McftRuntimeHealthV1>(scope, "/health");
export const readMcftModelGovernance = (scope: McftFieldTwinScopeV1, collection_kind: "CALIBRATION_CANDIDATE" | "SHADOW_EVALUATION" | "MODEL_ACTIVATION") =>
  getMcft<McftCollectionPageV1>(scope, "/model-governance", { collection_kind, limit: 50 });

export async function loadMcftCanonicalTab(scope: McftFieldTwinScopeV1, tab: McftCanonicalTabKey): Promise<McftTabBundleV1> {
  if (tab === "overview") return { tab, runtime: await readMcftRuntime(scope) };
  if (tab === "state") {
    const [runtime, collection] = await Promise.all([readMcftRuntime(scope), readMcftStates(scope)]);
    return { tab, runtime, collection };
  }
  if (tab === "forecast") {
    const [runtime, collection] = await Promise.all([readMcftRuntime(scope), readMcftForecasts(scope)]);
    return { tab, runtime, collection };
  }
  if (tab === "scenario") {
    const [runtime, collection] = await Promise.all([readMcftRuntime(scope), readMcftScenarios(scope)]);
    return { tab, runtime, collection };
  }
  if (tab === "action-lifecycle") {
    const [runtime, collection] = await Promise.all([readMcftRuntime(scope), readMcftActionLifecycle(scope)]);
    return { tab, runtime, collection };
  }
  if (tab === "residual") {
    const [runtime, collection] = await Promise.all([readMcftRuntime(scope), readMcftResiduals(scope)]);
    return { tab, runtime, collection };
  }
  if (tab === "calibration") {
    const [calibration_candidate, shadow_evaluation, model_activation] = await Promise.all([
      readMcftModelGovernance(scope, "CALIBRATION_CANDIDATE"),
      readMcftModelGovernance(scope, "SHADOW_EVALUATION"),
      readMcftModelGovernance(scope, "MODEL_ACTIVATION"),
    ]);
    return { tab, governance: { calibration_candidate, shadow_evaluation, model_activation } };
  }
  if (tab === "evidence-trace") {
    const [trace, timeline] = await Promise.all([readMcftTrace(scope), readMcftTimeline(scope)]);
    return { tab, trace, timeline };
  }
  return { tab, health: await readMcftHealth(scope) };
}
