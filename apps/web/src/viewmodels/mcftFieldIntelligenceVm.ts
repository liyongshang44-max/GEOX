import type {
  McftAttachmentV1,
  McftCanonicalRefV1,
  McftCollectionSummaryV1,
  McftRuntimeReadModelV1,
} from "../api/mcftFieldTwinRuntime";

export type FieldIntelligenceRefSlotV1 = {
  key: string;
  label: string;
  value: McftCanonicalRefV1 | null;
};

export type FieldIntelligenceAttachmentSlotV1 = {
  key: string;
  label: string;
  value: McftAttachmentV1;
};

export type FieldIntelligenceCollectionSlotV1 = {
  key: string;
  label: string;
  value: McftCollectionSummaryV1;
};

export type FieldIntelligenceOverviewVmV1 = {
  schema_version: "foui_field_intelligence_overview_vm_v1";
  field_id: string;
  season_id: string;
  zone_id: string;
  response_started_at: string;
  root_graph_status: string;
  root_ref_count: number;
  root_ref_expected: number;
  limitation_count: number;
  validation_count: number;
  root_refs: FieldIntelligenceRefSlotV1[];
  current_attachments: FieldIntelligenceAttachmentSlotV1[];
  collection_summaries: FieldIntelligenceCollectionSlotV1[];
  limitations: Array<Record<string, unknown>>;
  validation_summary: Array<Record<string, unknown>>;
  content_identity: {
    root_graph_content_hash: string;
    attachment_content_hash: string;
    response_instance_hash: string;
  };
  canonical_source: McftRuntimeReadModelV1;
};

const ROOT_SLOTS: Array<[keyof McftRuntimeReadModelV1, string]> = [
  ["active_lineage", "Active lineage"],
  ["checkpoint", "Checkpoint"],
  ["runtime_tick", "Runtime tick"],
  ["evidence_window", "Evidence window"],
  ["state_transition", "State transition"],
  ["assimilation_update", "Assimilation update"],
  ["posterior_state", "Posterior state"],
  ["terminal_record_set_health", "Terminal record-set health"],
  ["runtime_config", "Runtime config"],
  ["current_tick_forecast_result", "Current tick forecast"],
];

const ATTACHMENT_SLOTS: Array<[keyof McftRuntimeReadModelV1, string]> = [
  ["latest_successful_forecast", "Latest successful forecast"],
  ["scenario_source_forecast", "Scenario source forecast"],
  ["current_scenario_attachment", "Current scenario"],
  ["latest_scenario_in_scope", "Latest scenario in scope"],
  ["current_human_decision", "Current human decision"],
  ["current_approved_plan", "Current approved plan"],
];

const COLLECTION_SLOTS: Array<[keyof McftRuntimeReadModelV1, string]> = [
  ["action_feedback_summary", "Action feedback"],
  ["forecast_residual_summary", "Forecast residual"],
  ["calibration_candidate_summary", "Calibration candidate"],
  ["shadow_evaluation_summary", "Shadow evaluation"],
  ["model_activation_summary", "Model activation"],
];

export function buildFieldIntelligenceOverviewVmV1(runtime: McftRuntimeReadModelV1): FieldIntelligenceOverviewVmV1 {
  const root_refs = ROOT_SLOTS.map(([key, label]) => ({
    key: String(key),
    label,
    value: runtime[key] as McftCanonicalRefV1 | null,
  }));
  const current_attachments = ATTACHMENT_SLOTS.map(([key, label]) => ({
    key: String(key),
    label,
    value: runtime[key] as McftAttachmentV1,
  }));
  const collection_summaries = COLLECTION_SLOTS.map(([key, label]) => ({
    key: String(key),
    label,
    value: runtime[key] as McftCollectionSummaryV1,
  }));

  return {
    schema_version: "foui_field_intelligence_overview_vm_v1",
    field_id: runtime.request_scope.field_id,
    season_id: runtime.request_scope.season_id,
    zone_id: runtime.request_scope.zone_id,
    response_started_at: runtime.response_started_at,
    root_graph_status: runtime.root_graph_status,
    root_ref_count: root_refs.filter((item) => Boolean(item.value)).length,
    root_ref_expected: root_refs.length,
    limitation_count: runtime.limitations.length,
    validation_count: runtime.validation_summary.length,
    root_refs,
    current_attachments,
    collection_summaries,
    limitations: runtime.limitations,
    validation_summary: runtime.validation_summary,
    content_identity: {
      root_graph_content_hash: runtime.root_graph_content_hash,
      attachment_content_hash: runtime.attachment_content_hash,
      response_instance_hash: runtime.response_instance_hash,
    },
    canonical_source: runtime,
  };
}
