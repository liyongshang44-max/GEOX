// Purpose: compose the exact current MCFT-CAP-07 Runtime root and summary-only optional attachments.
// Boundary: pure composition over S2-resolved objects only; no database query, pointer reselection, route behavior, or write authority.

import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinCollectionAttachmentV1,
  FieldTwinLimitationV1,
  FieldTwinOptionalCollectionSummaryV1,
  FieldTwinRecordSetValidationV1,
  FieldTwinRootGraphStatusV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationResultV1,
  MinimalFieldTwinRuntimeReadModelV1,
} from "./contracts_v1.js";
import { FIELD_TWIN_READ_MODEL_VERSION_V1, FIELD_TWIN_SOURCE_PROFILE_VERSION_V1 } from "./contracts_v1.js";
import { buildAttachmentContentHashV1, buildResponseInstanceHashV1, buildRootGraphContentHashV1 } from "./hash_contracts_v1.js";
import {
  assertComposerObjectV1,
  canonicalObjectRefV1,
  composerFailV1,
  normalizeComposerLimitationsV1,
  type FieldTwinComposerObjectV1,
} from "./composer_contracts_v1.js";

export type CurrentRuntimeComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  root_graph_status: FieldTwinRootGraphStatusV1;
  active_lineage: FieldTwinComposerObjectV1 | null;
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
  checkpoint: FieldTwinComposerObjectV1 | null;
  runtime_tick: FieldTwinComposerObjectV1 | null;
  evidence_window: FieldTwinComposerObjectV1 | null;
  state_transition: FieldTwinComposerObjectV1 | null;
  assimilation_update: FieldTwinComposerObjectV1 | null;
  posterior_state: FieldTwinComposerObjectV1 | null;
  terminal_record_set_health: FieldTwinComposerObjectV1 | null;
  runtime_config: FieldTwinComposerObjectV1 | null;
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  current_tick_forecast_result: FieldTwinComposerObjectV1 | null;
  latest_successful_forecast: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  scenario_source_forecast: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_scenario_attachment: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  latest_scenario_in_scope: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_human_decision: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_approved_plan: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  action_feedback_summary: FieldTwinOptionalCollectionSummaryV1;
  forecast_residual_summary: FieldTwinOptionalCollectionSummaryV1;
  calibration_candidate_summary: FieldTwinOptionalCollectionSummaryV1;
  shadow_evaluation_summary: FieldTwinOptionalCollectionSummaryV1;
  model_activation_summary: FieldTwinOptionalCollectionSummaryV1;
  limitations: readonly FieldTwinLimitationV1[];
  validation_summary: readonly FieldTwinSourceValidationResultV1[];
};

const MANDATORY_OBJECT_KEYS = [
  "active_lineage",
  "checkpoint",
  "runtime_tick",
  "evidence_window",
  "state_transition",
  "assimilation_update",
  "posterior_state",
  "terminal_record_set_health",
  "runtime_config",
] as const;

function assertAttachmentContractV1(attachment: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>, name: string): void {
  if (attachment.attachment_status === "ATTACHED_EXACT") {
    if (!attachment.item || attachment.reason_code !== null) composerFailV1("MCFT_RUNTIME_ATTACHMENT_INVALID", name);
    return;
  }
  if (attachment.item !== null || !attachment.reason_code) composerFailV1("MCFT_RUNTIME_ATTACHMENT_INVALID", name);
}

function assertSummaryOnlyV1(summary: FieldTwinOptionalCollectionSummaryV1, expectedEndpoint: string): void {
  if (summary.collection_endpoint !== expectedEndpoint) composerFailV1("MCFT_RUNTIME_COLLECTION_SUMMARY_INVALID", expectedEndpoint);
  if (summary.count_status === "NOT_COMPUTED") {
    if (summary.total_count !== null) composerFailV1("MCFT_RUNTIME_COLLECTION_CARDINALITY_INVALID", summary.collection_kind);
  } else if (summary.count_status === "EXACT_VALIDATED_PROJECTION") {
    if (summary.total_count === null || summary.total_count < 0 || summary.has_items !== (summary.total_count > 0)) {
      composerFailV1("MCFT_RUNTIME_COLLECTION_CARDINALITY_INVALID", summary.collection_kind);
    }
  } else {
    composerFailV1("MCFT_RUNTIME_COLLECTION_CARDINALITY_INVALID", summary.collection_kind);
  }
  if (summary.has_items && (!summary.latest_item_ref || !summary.latest_item_hash || summary.attachment_status !== "ATTACHED_EXACT" || summary.reason_code !== null)) {
    composerFailV1("MCFT_RUNTIME_COLLECTION_SUMMARY_INVALID", summary.collection_kind);
  }
  if (!summary.has_items && (summary.latest_item_ref !== null || summary.latest_item_hash !== null || !summary.reason_code || summary.attachment_status !== "ABSENT_OPTIONAL_DOMAIN")) {
    composerFailV1("MCFT_RUNTIME_COLLECTION_SUMMARY_INVALID", summary.collection_kind);
  }
}

export class CurrentRuntimeComposerV1 {
  compose(input: CurrentRuntimeComposerInputV1): MinimalFieldTwinRuntimeReadModelV1 {
    for (const key of MANDATORY_OBJECT_KEYS) {
      const object = input[key];
      if (input.root_graph_status === "COMPLETE_EXACT_GRAPH" && !object) composerFailV1("MCFT_RUNTIME_MANDATORY_ROOT_MISSING", key);
      if (object) assertComposerObjectV1(object, input.request_scope, "MCFT_RUNTIME_MANDATORY_ROOT_INVALID");
    }

    if (input.root_graph_status === "COMPLETE_EXACT_GRAPH") {
      if (!input.record_set_validation || input.record_set_validation.validation_status !== "PASS") {
        composerFailV1("MCFT_RUNTIME_RECORD_SET_VALIDATION_REQUIRED");
      }
      if (!input.active_lineage_authority_validation || input.active_lineage_authority_validation.validation_status !== "PASS") {
        composerFailV1("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID");
      }
    }

    if (input.current_tick_forecast_result) assertComposerObjectV1(input.current_tick_forecast_result, input.request_scope, "MCFT_CURRENT_TICK_FORECAST_INVALID");
    for (const [name, attachment] of [
      ["latest_successful_forecast", input.latest_successful_forecast],
      ["scenario_source_forecast", input.scenario_source_forecast],
      ["current_scenario_attachment", input.current_scenario_attachment],
      ["latest_scenario_in_scope", input.latest_scenario_in_scope],
      ["current_human_decision", input.current_human_decision],
      ["current_approved_plan", input.current_approved_plan],
    ] as const) assertAttachmentContractV1(attachment, name);

    if (input.current_tick_forecast_result && input.latest_successful_forecast.item &&
        input.current_tick_forecast_result.object_ref === input.latest_successful_forecast.item.object_ref &&
        input.current_tick_forecast_result.object_hash !== input.latest_successful_forecast.item.object_hash) {
      composerFailV1("MCFT_FORECAST_POINTER_HASH_DIVERGENCE", "CURRENT_VS_LATEST_SUCCESS");
    }
    if (input.scenario_source_forecast.item && input.latest_scenario_in_scope.item === null) {
      composerFailV1("MCFT_SCENARIO_FORECAST_POINTER_INVALID", "SOURCE_WITHOUT_LATEST_SCENARIO");
    }
    if (input.current_scenario_attachment.item && (!input.scenario_source_forecast.item || !input.current_tick_forecast_result || input.scenario_source_forecast.item.object_ref !== input.current_tick_forecast_result.object_ref || input.scenario_source_forecast.item.object_hash !== input.current_tick_forecast_result.object_hash)) {
      composerFailV1("MCFT_SCENARIO_FORECAST_POINTER_INVALID", "CURRENT_SCENARIO_SOURCE_NOT_CURRENT_TICK_FORECAST");
    }

    assertSummaryOnlyV1(input.action_feedback_summary, "/action-lifecycle");
    assertSummaryOnlyV1(input.forecast_residual_summary, "/residuals");
    assertSummaryOnlyV1(input.calibration_candidate_summary, "/model-governance");
    assertSummaryOnlyV1(input.shadow_evaluation_summary, "/model-governance");
    assertSummaryOnlyV1(input.model_activation_summary, "/model-governance");

    const mandatoryObjects = MANDATORY_OBJECT_KEYS
      .map((key) => input[key])
      .filter((value): value is FieldTwinComposerObjectV1 => value !== null)
      .map(canonicalObjectRefV1);
    if (input.current_tick_forecast_result) mandatoryObjects.push(canonicalObjectRefV1(input.current_tick_forecast_result));

    const limitations = normalizeComposerLimitationsV1(input.limitations);
    const rootGraphContentHash = buildRootGraphContentHashV1({
      read_model_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
      scope: input.request_scope,
      root_graph_status: input.root_graph_status,
      mandatory_objects: mandatoryObjects,
      record_set_validation: input.record_set_validation,
      terminal_record_set_health: input.terminal_record_set_health ? canonicalObjectRefV1(input.terminal_record_set_health) : null,
      current_tick_forecast_result: input.current_tick_forecast_result ? canonicalObjectRefV1(input.current_tick_forecast_result) : null,
      active_lineage_authority_validation: input.active_lineage_authority_validation,
      source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
    });
    const attachmentContentHash = buildAttachmentContentHashV1({
      latest_successful_forecast: input.latest_successful_forecast,
      scenario_source_forecast: input.scenario_source_forecast,
      current_scenario_attachment: input.current_scenario_attachment,
      latest_scenario_in_scope: input.latest_scenario_in_scope,
      optional_domain_summaries: [
        input.action_feedback_summary,
        input.forecast_residual_summary,
        input.calibration_candidate_summary,
        input.shadow_evaluation_summary,
        input.model_activation_summary,
      ],
      limitations,
    });
    const responseInstanceHash = buildResponseInstanceHashV1({
      endpoint_id: "runtime",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: null,
      request_cursor_boundary: null,
      canonical_visibility_snapshot_hash: null,
      endpoint_content_hashes: {
        root_graph_content_hash: rootGraphContentHash,
        attachment_content_hash: attachmentContentHash,
      },
      next_cursor_envelope_digest: null,
    });

    return Object.freeze({
      schema_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
      root_graph_content_hash: rootGraphContentHash,
      attachment_content_hash: attachmentContentHash,
      response_instance_hash: responseInstanceHash,
      request_scope: Object.freeze({ ...input.request_scope }),
      source_profile_id: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
      response_started_at: input.response_started_at,
      root_graph_status: input.root_graph_status,
      active_lineage: input.active_lineage ? canonicalObjectRefV1(input.active_lineage) : null,
      active_lineage_authority_validation: input.active_lineage_authority_validation,
      checkpoint: input.checkpoint ? canonicalObjectRefV1(input.checkpoint) : null,
      runtime_tick: input.runtime_tick ? canonicalObjectRefV1(input.runtime_tick) : null,
      evidence_window: input.evidence_window ? canonicalObjectRefV1(input.evidence_window) : null,
      state_transition: input.state_transition ? canonicalObjectRefV1(input.state_transition) : null,
      assimilation_update: input.assimilation_update ? canonicalObjectRefV1(input.assimilation_update) : null,
      posterior_state: input.posterior_state ? canonicalObjectRefV1(input.posterior_state) : null,
      terminal_record_set_health: input.terminal_record_set_health ? canonicalObjectRefV1(input.terminal_record_set_health) : null,
      runtime_config: input.runtime_config ? canonicalObjectRefV1(input.runtime_config) : null,
      record_set_validation: input.record_set_validation,
      current_tick_forecast_result: input.current_tick_forecast_result ? canonicalObjectRefV1(input.current_tick_forecast_result) : null,
      latest_successful_forecast: input.latest_successful_forecast,
      scenario_source_forecast: input.scenario_source_forecast,
      current_scenario_attachment: input.current_scenario_attachment,
      latest_scenario_in_scope: input.latest_scenario_in_scope,
      current_human_decision: input.current_human_decision,
      current_approved_plan: input.current_approved_plan,
      action_feedback_summary: input.action_feedback_summary,
      forecast_residual_summary: input.forecast_residual_summary,
      calibration_candidate_summary: input.calibration_candidate_summary,
      shadow_evaluation_summary: input.shadow_evaluation_summary,
      model_activation_summary: input.model_activation_summary,
      limitations,
      validation_summary: Object.freeze([...input.validation_summary]),
    });
  }
}
