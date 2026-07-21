// Purpose: compose exact action-lifecycle and model-governance read models without exposing unbounded collections.
// Boundary: pure composition over S2-validated objects and summaries; no activation inference, cross-database stitching, dispatch, approval, recommendation, or persistence.

import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinCollectionAttachmentV1,
  FieldTwinCollectionItemV1,
  FieldTwinEvidenceRefV1,
  FieldTwinLimitationV1,
  FieldTwinOptionalCollectionSummaryV1,
  FieldTwinScopeV1,
  FieldTwinTraceEdgeV1,
} from "./contracts_v1.js";
import { buildResponseInstanceHashV1 } from "./hash_contracts_v1.js";
import { sortTraceEdgesV1 } from "./ordering_v1.js";
import {
  composerFailV1,
  normalizeComposerEvidenceRefsV1,
  normalizeComposerLimitationsV1,
  semanticComposerHashV1,
  type FieldTwinActionLifecycleReadModelV1,
  type FieldTwinModelGovernanceActivationRelationV1,
  type FieldTwinModelGovernanceCandidateV1,
  type FieldTwinModelGovernanceReadModelV1,
} from "./composer_contracts_v1.js";

function assertAttachmentV1(attachment: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>, name: string): void {
  if (attachment.attachment_status === "ATTACHED_EXACT") {
    if (!attachment.item || attachment.reason_code !== null) composerFailV1("MCFT_ACTION_ATTACHMENT_INVALID", name);
  } else if (attachment.item !== null || !attachment.reason_code) {
    composerFailV1("MCFT_ACTION_ATTACHMENT_INVALID", name);
  }
}

function assertSummaryV1(summary: FieldTwinOptionalCollectionSummaryV1, kind: string): void {
  if (summary.count_status === "NOT_COMPUTED") {
    if (summary.total_count !== null) composerFailV1("MCFT_COLLECTION_CARDINALITY_INVALID", kind);
  } else if (summary.count_status === "EXACT_VALIDATED_PROJECTION") {
    if (summary.total_count === null || summary.total_count < 0 || summary.has_items !== (summary.total_count > 0)) composerFailV1("MCFT_COLLECTION_CARDINALITY_INVALID", kind);
  } else {
    composerFailV1("MCFT_COLLECTION_CARDINALITY_INVALID", kind);
  }
  if (summary.has_items && (!summary.latest_item_ref || !summary.latest_item_hash || summary.attachment_status !== "ATTACHED_EXACT" || summary.reason_code !== null)) composerFailV1("MCFT_COLLECTION_SUMMARY_INVALID", kind);
  if (!summary.has_items && (summary.latest_item_ref !== null || summary.latest_item_hash !== null || summary.attachment_status !== "ABSENT_OPTIONAL_DOMAIN" || !summary.reason_code)) composerFailV1("MCFT_COLLECTION_SUMMARY_INVALID", kind);
}

export type ActionLifecycleComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  current_human_decision: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_approved_plan: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  action_feedback_summary: FieldTwinOptionalCollectionSummaryV1;
  exact_edges: readonly FieldTwinTraceEdgeV1[];
  limitations: readonly FieldTwinLimitationV1[];
};

export class ActionLifecycleComposerV1 {
  compose(input: ActionLifecycleComposerInputV1): FieldTwinActionLifecycleReadModelV1 {
    assertAttachmentV1(input.current_human_decision, "current_human_decision");
    assertAttachmentV1(input.current_approved_plan, "current_approved_plan");
    assertSummaryV1(input.action_feedback_summary, "ACTION_FEEDBACK");
    if (input.action_feedback_summary.collection_endpoint !== "/action-lifecycle") composerFailV1("MCFT_ACTION_COLLECTION_ENDPOINT_INVALID");
    if (input.current_approved_plan.item && !input.current_human_decision.item) composerFailV1("MCFT_ACTION_PLAN_WITHOUT_DECISION");
    if (input.action_feedback_summary.has_items && !input.current_approved_plan.item) composerFailV1("MCFT_ACTION_FEEDBACK_WITHOUT_PLAN");

    const allowed = new Set(["SCENARIO_SELECTED_BY_DECISION", "DECISION_BOUND_TO_PLAN", "PLAN_EXECUTED_BY_FEEDBACK"]);
    const refs = new Set<string>();
    if (input.current_human_decision.item) refs.add(input.current_human_decision.item.object_ref);
    if (input.current_approved_plan.item) refs.add(input.current_approved_plan.item.object_ref);
    if (input.action_feedback_summary.latest_item_ref) refs.add(input.action_feedback_summary.latest_item_ref);
    const keys = new Set<string>();
    const exactEdges = input.exact_edges.map((edge) => {
      if (!allowed.has(edge.edge_kind)) composerFailV1("MCFT_ACTION_EDGE_KIND_INVALID", edge.edge_kind);
      if (!refs.has(edge.from_ref) || !refs.has(edge.to_ref)) composerFailV1("MCFT_ACTION_EDGE_ENDPOINT_UNRESOLVED", `${edge.from_ref}->${edge.to_ref}`);
      if (edge.evidence_refs.length === 0) composerFailV1("MCFT_ACTION_EDGE_EVIDENCE_REQUIRED", edge.edge_kind);
      const key = `${edge.edge_kind}|${edge.from_ref}|${edge.to_ref}`;
      if (keys.has(key)) composerFailV1("MCFT_ACTION_EDGE_DUPLICATE", key);
      keys.add(key);
      return Object.freeze({ ...edge, evidence_refs: normalizeComposerEvidenceRefsV1(edge.evidence_refs) });
    });
    const edges = Object.freeze(sortTraceEdgesV1(exactEdges));
    const limitations = normalizeComposerLimitationsV1(input.limitations);
    const contentHash = semanticComposerHashV1({
      current_human_decision: input.current_human_decision,
      current_approved_plan: input.current_approved_plan,
      action_feedback_summary: input.action_feedback_summary,
      exact_edges: edges,
      limitations,
    });
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: "action-lifecycle",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: null,
      request_cursor_boundary: null,
      canonical_visibility_snapshot_hash: null,
      endpoint_content_hashes: { action_lifecycle_content_hash: contentHash },
      next_cursor_envelope_digest: null,
    });
    return Object.freeze({
      schema_version: "field_twin_action_lifecycle_read_model_v1",
      request_scope: Object.freeze({ ...input.request_scope }),
      current_human_decision: input.current_human_decision,
      current_approved_plan: input.current_approved_plan,
      action_feedback_summary: input.action_feedback_summary,
      exact_edges: edges,
      limitations,
      action_lifecycle_content_hash: contentHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}

export type ModelGovernanceComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  database_profile: "PROFILE_A_RUNTIME" | "PROFILE_B_CALIBRATION";
  calibration_candidates: readonly FieldTwinModelGovernanceCandidateV1[];
  shadow_evaluations: readonly FieldTwinCollectionItemV1[];
  model_activations: readonly FieldTwinCollectionItemV1[];
  calibration_candidate_summary: FieldTwinOptionalCollectionSummaryV1;
  shadow_evaluation_summary: FieldTwinOptionalCollectionSummaryV1;
  model_activation_summary: FieldTwinOptionalCollectionSummaryV1;
  attached_activation_relation: FieldTwinModelGovernanceActivationRelationV1 | null;
  exact_available_refs: readonly string[];
  limitations: readonly FieldTwinLimitationV1[];
};

function assertItemsExactV1(items: readonly FieldTwinCollectionItemV1[], kind: string): void {
  const refs = new Set<string>();
  for (const item of items) {
    if (!item.object_ref || !item.object_hash.startsWith("sha256:") || item.attachment_status !== "ATTACHED_EXACT") composerFailV1("MCFT_MODEL_GOVERNANCE_ITEM_INVALID", kind);
    if (refs.has(item.object_ref)) composerFailV1("MCFT_MODEL_GOVERNANCE_DUPLICATE_ITEM", item.object_ref);
    refs.add(item.object_ref);
  }
}

export class ModelGovernanceComposerV1 {
  compose(input: ModelGovernanceComposerInputV1): FieldTwinModelGovernanceReadModelV1 {
    assertItemsExactV1(input.calibration_candidates, "CALIBRATION_CANDIDATE");
    assertItemsExactV1(input.shadow_evaluations, "SHADOW_EVALUATION");
    assertItemsExactV1(input.model_activations, "MODEL_ACTIVATION");
    for (const candidate of input.calibration_candidates) {
      if (candidate.activation_status !== "NOT_ACTIVE" || candidate.eligible_for_state_input !== false || candidate.eligible_for_runtime_config_use !== false) {
        composerFailV1("MCFT_CALIBRATION_CANDIDATE_SAFETY_CONTRACT_INVALID", candidate.object_ref);
      }
    }
    assertSummaryV1(input.calibration_candidate_summary, "CALIBRATION_CANDIDATE");
    assertSummaryV1(input.shadow_evaluation_summary, "SHADOW_EVALUATION");
    assertSummaryV1(input.model_activation_summary, "MODEL_ACTIVATION");
    for (const summary of [input.calibration_candidate_summary, input.shadow_evaluation_summary, input.model_activation_summary]) {
      if (summary.collection_endpoint !== "/model-governance") composerFailV1("MCFT_MODEL_GOVERNANCE_ENDPOINT_INVALID", summary.collection_kind);
    }
    for (const [summary, items] of [
      [input.calibration_candidate_summary, input.calibration_candidates],
      [input.shadow_evaluation_summary, input.shadow_evaluations],
      [input.model_activation_summary, input.model_activations],
    ] as const) {
      if (summary.count_status === "EXACT_VALIDATED_PROJECTION" && summary.total_count !== items.length) composerFailV1("MCFT_MODEL_GOVERNANCE_CARDINALITY_MISMATCH");
    }

    const relation = input.attached_activation_relation;
    if (relation) {
      if (input.database_profile !== "PROFILE_A_RUNTIME") composerFailV1("MCFT_MODEL_GOVERNANCE_CROSS_DATABASE_STITCH_FORBIDDEN");
      const available = new Set(input.exact_available_refs);
      for (const ref of [relation.activation.object_ref, relation.candidate_ref, relation.evaluation_ref, relation.activated_runtime_config_ref, relation.active_lineage_ref]) {
        if (!available.has(ref)) composerFailV1("MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE", ref);
      }
      if (relation.active_revision_ref && !available.has(relation.active_revision_ref)) composerFailV1("MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE", relation.active_revision_ref);
      if (!input.model_activations.some((item) => item.object_ref === relation.activation.object_ref && item.object_hash === relation.activation.object_hash)) {
        composerFailV1("MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE", "ACTIVATION_OBJECT");
      }
      if (relation.relation_evidence_refs.length === 0) composerFailV1("MCFT_MODEL_ACTIVATION_CHAIN_EVIDENCE_REQUIRED");
    } else if (input.model_activations.length > 0) {
      composerFailV1("MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE", "RELATION_REQUIRED");
    }
    if (input.shadow_evaluations.length > 0 && input.model_activations.length === 0 && relation !== null) {
      composerFailV1("MCFT_SHADOW_EVALUATION_ACTIVATION_INFERENCE_FORBIDDEN");
    }

    const limitations = normalizeComposerLimitationsV1(input.limitations);
    const normalizedRelation = relation ? Object.freeze({ ...relation, relation_evidence_refs: normalizeComposerEvidenceRefsV1(relation.relation_evidence_refs) }) : null;
    const contentHash = semanticComposerHashV1({
      database_profile: input.database_profile,
      calibration_candidate_summary: input.calibration_candidate_summary,
      shadow_evaluation_summary: input.shadow_evaluation_summary,
      model_activation_summary: input.model_activation_summary,
      attached_activation_relation: normalizedRelation,
      limitations,
    });
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: "model-governance",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: null,
      request_cursor_boundary: null,
      canonical_visibility_snapshot_hash: null,
      endpoint_content_hashes: { model_governance_content_hash: contentHash },
      next_cursor_envelope_digest: null,
    });
    return Object.freeze({
      schema_version: "field_twin_model_governance_read_model_v1",
      request_scope: Object.freeze({ ...input.request_scope }),
      calibration_candidate_summary: input.calibration_candidate_summary,
      shadow_evaluation_summary: input.shadow_evaluation_summary,
      model_activation_summary: input.model_activation_summary,
      attached_activation_relation: normalizedRelation,
      limitations,
      model_governance_content_hash: contentHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}
