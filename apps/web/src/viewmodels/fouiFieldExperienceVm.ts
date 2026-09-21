import type {
  McftCollectionItemV1,
  McftCollectionPageV1,
  McftRuntimeReadModelV1,
} from "../api/mcftFieldTwinRuntime";

export type FieldExperienceFactV2 = {
  key: string;
  label: string;
  value: string;
};

export type FieldExperienceDatasetModeV2 = "EAGER" | "PRODUCT_ON_DEMAND" | "TECHNICAL_ON_DEMAND";
export type FieldExperienceDatasetStatusV2 = "LOADED" | "AVAILABLE" | "EMPTY" | "NOT_ESTABLISHED" | "UNCHECKED";

export type FieldExperienceDatasetV2 = {
  key: string;
  label: string;
  mode: FieldExperienceDatasetModeV2;
  status: FieldExperienceDatasetStatusV2;
  count: number | null;
  reason_code: string | null;
  canonical_endpoint: string;
};

const TECHNICAL_KEYS = new Set([
  "object_ref",
  "object_type",
  "object_hash",
  "source_fact_ref",
  "logical_time",
  "attachment_status",
  "schema_version",
  "response_instance_hash",
  "response_started_at",
]);

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function humanizeFieldKeyV2(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function findExactCollectionItemV2(
  page: McftCollectionPageV1,
  objectRef: string | null | undefined,
): McftCollectionItemV1 | null {
  const ref = String(objectRef || "").trim();
  if (!ref) return null;
  return page.items.find((item) => item.object_ref === ref) ?? null;
}

export function extractScalarFactsV2(
  item: Record<string, unknown> | null | undefined,
  limit = 8,
): FieldExperienceFactV2[] {
  if (!item) return [];
  const facts: FieldExperienceFactV2[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (TECHNICAL_KEYS.has(key)) continue;
    const scalar = text(value);
    if (!scalar) continue;
    facts.push({ key, label: humanizeFieldKeyV2(key), value: scalar });
    if (facts.length >= limit) break;
  }
  return facts;
}

function summaryStatus(
  value: { has_items: boolean; attachment_status: string; reason_code: string | null } | null | undefined,
): FieldExperienceDatasetStatusV2 {
  if (!value) return "UNCHECKED";
  if (value.has_items) return "AVAILABLE";
  if (String(value.attachment_status || "").includes("ABSENT")) return "NOT_ESTABLISHED";
  return "EMPTY";
}

function attachmentStatus(
  value: { attachment_status: string; item: unknown } | null | undefined,
): FieldExperienceDatasetStatusV2 {
  if (!value) return "UNCHECKED";
  if (value.item) return "AVAILABLE";
  if (String(value.attachment_status || "").includes("ABSENT")) return "NOT_ESTABLISHED";
  return "EMPTY";
}

export function buildFieldDataUtilizationV2(
  runtime: McftRuntimeReadModelV1,
  states: McftCollectionPageV1,
  forecasts: McftCollectionPageV1,
): FieldExperienceDatasetV2[] {
  const scenarioStatus =
    attachmentStatus(runtime.current_scenario_attachment) === "AVAILABLE" ||
    attachmentStatus(runtime.latest_scenario_in_scope) === "AVAILABLE"
      ? "AVAILABLE"
      : attachmentStatus(runtime.current_scenario_attachment);

  const actionStatus =
    attachmentStatus(runtime.current_human_decision) === "AVAILABLE" ||
    attachmentStatus(runtime.current_approved_plan) === "AVAILABLE" ||
    summaryStatus(runtime.action_feedback_summary) === "AVAILABLE"
      ? "AVAILABLE"
      : summaryStatus(runtime.action_feedback_summary);

  return [
    {
      key: "runtime",
      label: "Runtime root",
      mode: "EAGER",
      status: "LOADED",
      count: null,
      reason_code: null,
      canonical_endpoint: "/runtime",
    },
    {
      key: "states",
      label: "State collection",
      mode: "EAGER",
      status: "LOADED",
      count: states.items.length,
      reason_code: null,
      canonical_endpoint: "/runtime/states",
    },
    {
      key: "forecasts",
      label: "Forecast collection",
      mode: "EAGER",
      status: "LOADED",
      count: forecasts.items.length,
      reason_code: runtime.latest_successful_forecast.reason_code,
      canonical_endpoint: "/runtime/forecasts",
    },
    {
      key: "scenarios",
      label: "Scenario collection",
      mode: "PRODUCT_ON_DEMAND",
      status: scenarioStatus,
      count: null,
      reason_code: runtime.current_scenario_attachment.reason_code ?? runtime.latest_scenario_in_scope.reason_code,
      canonical_endpoint: "/runtime/scenarios",
    },
    {
      key: "action-lifecycle",
      label: "Action lifecycle",
      mode: "PRODUCT_ON_DEMAND",
      status: actionStatus,
      count: runtime.action_feedback_summary.total_count,
      reason_code: runtime.action_feedback_summary.reason_code,
      canonical_endpoint: "/runtime/action-lifecycle",
    },
    {
      key: "residuals",
      label: "Forecast residual",
      mode: "PRODUCT_ON_DEMAND",
      status: summaryStatus(runtime.forecast_residual_summary),
      count: runtime.forecast_residual_summary.total_count,
      reason_code: runtime.forecast_residual_summary.reason_code,
      canonical_endpoint: "/runtime/residuals",
    },
    {
      key: "timeline",
      label: "Timeline",
      mode: "PRODUCT_ON_DEMAND",
      status: "UNCHECKED",
      count: null,
      reason_code: null,
      canonical_endpoint: "/runtime/timeline",
    },
    {
      key: "trace",
      label: "Trace graph",
      mode: "PRODUCT_ON_DEMAND",
      status: "UNCHECKED",
      count: null,
      reason_code: null,
      canonical_endpoint: "/runtime/trace",
    },
    {
      key: "health",
      label: "Runtime health",
      mode: "PRODUCT_ON_DEMAND",
      status: "UNCHECKED",
      count: null,
      reason_code: null,
      canonical_endpoint: "/runtime/health",
    },
    {
      key: "calibration",
      label: "Calibration candidate",
      mode: "TECHNICAL_ON_DEMAND",
      status: summaryStatus(runtime.calibration_candidate_summary),
      count: runtime.calibration_candidate_summary.total_count,
      reason_code: runtime.calibration_candidate_summary.reason_code,
      canonical_endpoint: "/runtime/model-governance?collection_kind=CALIBRATION_CANDIDATE",
    },
    {
      key: "shadow-evaluation",
      label: "Shadow evaluation",
      mode: "TECHNICAL_ON_DEMAND",
      status: summaryStatus(runtime.shadow_evaluation_summary),
      count: runtime.shadow_evaluation_summary.total_count,
      reason_code: runtime.shadow_evaluation_summary.reason_code,
      canonical_endpoint: "/runtime/model-governance?collection_kind=SHADOW_EVALUATION",
    },
    {
      key: "model-activation",
      label: "Model activation",
      mode: "TECHNICAL_ON_DEMAND",
      status: summaryStatus(runtime.model_activation_summary),
      count: runtime.model_activation_summary.total_count,
      reason_code: runtime.model_activation_summary.reason_code,
      canonical_endpoint: "/runtime/model-governance?collection_kind=MODEL_ACTIVATION",
    },
  ];
}
