// Purpose: invoke S3 ActionLifecycle and ModelGovernance composers over the exact items returned by one S4 PostgreSQL page transaction.
// Boundary: same-snapshot read validation only; no persistence, approval, dispatch, recommendation, activation exercise, or cross-database stitching.

import {
  ActionLifecycleComposerV1,
  ModelGovernanceComposerV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinCollectionAttachmentV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinOptionalCollectionSummaryV1,
  type FieldTwinTraceEdgeV1,
} from "../domain/field_twin_read_model/index.js";
import type { FieldTwinModelGovernanceActivationRelationV1 } from "../domain/field_twin_read_model/composer_contracts_v1.js";
import {
  MCFT_COLLECTION_SOURCE_SPECS_V1,
} from "../repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.js";
import {
  PostgresFieldTwinProjectionReadRepositoryV1,
} from "../repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "../repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}

function attachment(item: FieldTwinCanonicalObjectRefV1 | null, reason: string): FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> {
  return item
    ? { attachment_status: "ATTACHED_EXACT", reason_code: null, item }
    : { attachment_status: "ABSENT_OPTIONAL_DOMAIN", reason_code: reason, item: null };
}

function summary(kind: FieldTwinCollectionKindV1, latest: FieldTwinCollectionItemV1 | null): FieldTwinOptionalCollectionSummaryV1 {
  return {
    collection_kind: kind,
    attachment_status: latest ? "ATTACHED_EXACT" : "ABSENT_OPTIONAL_DOMAIN",
    reason_code: latest ? null : "NO_VISIBLE_ITEMS_IN_SCOPE",
    has_items: latest !== null,
    count_status: "NOT_COMPUTED",
    total_count: null,
    latest_item_ref: latest?.object_ref ?? null,
    latest_item_hash: latest?.object_hash ?? null,
    collection_endpoint: MCFT_COLLECTION_SOURCE_SPECS_V1[kind].endpoint_suffix,
  };
}

export class McftFieldTwinDomainPageValidatorV1 {
  private readonly actionComposer = new ActionLifecycleComposerV1();
  private readonly governanceComposer = new ModelGovernanceComposerV1();

  constructor(private readonly repository: PostgresFieldTwinProjectionReadRepositoryV1) {}

  async validate(
    context: PostgresFieldTwinSnapshotContextV1,
    kind: FieldTwinCollectionKindV1,
    returnedItems: readonly FieldTwinCollectionItemV1[],
  ): Promise<void> {
    if (kind === "ACTION_FEEDBACK") {
      await this.validateActionLifecycle(context, returnedItems);
      return;
    }
    if (["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"].includes(kind)) {
      await this.validateModelGovernance(context);
    }
  }

  private async validateActionLifecycle(
    context: PostgresFieldTwinSnapshotContextV1,
    items: readonly FieldTwinCollectionItemV1[],
  ): Promise<void> {
    const latest = items[0] ?? null;
    if (!latest) {
      this.actionComposer.compose({
        request_scope: context.scope,
        response_started_at: context.response_started_at,
        current_human_decision: attachment(null, "NO_HUMAN_DECISION_FOR_ACTION_FEEDBACK_PAGE"),
        current_approved_plan: attachment(null, "NO_APPROVED_PLAN_FOR_ACTION_FEEDBACK_PAGE"),
        action_feedback_summary: summary("ACTION_FEEDBACK", null),
        exact_edges: [],
        limitations: [],
      });
      return;
    }

    const feedback = await this.repository.readValidatedObjectByRef(context, latest.object_ref, "twin_action_feedback_v1");
    if (feedback.item.object_hash !== latest.object_hash) fail("MCFT_ACTION_FEEDBACK_PAGE_HASH_DIVERGENCE");
    const payload = asRecord(feedback.payload.payload, "MCFT_ACTION_FEEDBACK_PAYLOAD_INVALID");
    const decisionRef = exactText(payload.decision_ref, "MCFT_ACTION_FEEDBACK_DECISION_REF_INVALID");
    const decisionHash = exactText(payload.decision_hash, "MCFT_ACTION_FEEDBACK_DECISION_HASH_INVALID");
    const planRef = exactText(payload.approved_plan_evidence_ref, "MCFT_ACTION_FEEDBACK_PLAN_REF_INVALID");
    const planHash = exactText(payload.approved_plan_evidence_hash, "MCFT_ACTION_FEEDBACK_PLAN_HASH_INVALID");
    const decision = await this.repository.readValidatedObjectByRef(context, decisionRef, "twin_decision_record_v1");
    if (decision.object.object_hash !== decisionHash) fail("MCFT_ACTION_FEEDBACK_DECISION_HASH_DIVERGENCE");
    const plan = await this.repository.readApprovedPlanForDecision(context, decision);
    if (!plan || plan.object_ref !== planRef || plan.object_hash !== planHash) fail("MCFT_ACTION_FEEDBACK_PLAN_BINDING_INVALID");

    const decisionAttachment = attachment({
      object_ref: decision.object.object_ref,
      object_type: decision.object.object_type,
      object_hash: decision.object.object_hash,
      source_fact_ref: decision.object.source_fact_ref,
    }, "NO_DECISION");
    const planAttachment = attachment({
      object_ref: plan.object_ref,
      object_type: plan.object_type,
      object_hash: plan.object_hash,
      source_fact_ref: plan.source_fact_ref,
    }, "NO_PLAN");
    const edges: FieldTwinTraceEdgeV1[] = [
      {
        edge_kind: "DECISION_BOUND_TO_PLAN",
        from_ref: decisionRef,
        to_ref: planRef,
        evidence_refs: [{ ref_type: "FACT", ref_value: plan.source_fact_ref }],
      },
      {
        edge_kind: "PLAN_EXECUTED_BY_FEEDBACK",
        from_ref: planRef,
        to_ref: latest.object_ref,
        evidence_refs: [{ ref_type: "FACT", ref_value: feedback.object.source_fact_ref ?? latest.object_ref }],
      },
    ];
    this.actionComposer.compose({
      request_scope: context.scope,
      response_started_at: context.response_started_at,
      current_human_decision: decisionAttachment,
      current_approved_plan: planAttachment,
      action_feedback_summary: summary("ACTION_FEEDBACK", latest),
      exact_edges: edges,
      limitations: [],
    });
  }

  private async validateModelGovernance(context: PostgresFieldTwinSnapshotContextV1): Promise<void> {
    const candidates = await this.repository.readCollectionItems(context, MCFT_COLLECTION_SOURCE_SPECS_V1.CALIBRATION_CANDIDATE, 201, null);
    const evaluations = await this.repository.readCollectionItems(context, MCFT_COLLECTION_SOURCE_SPECS_V1.SHADOW_EVALUATION, 201, null);
    const activations = await this.repository.readCollectionItems(context, MCFT_COLLECTION_SOURCE_SPECS_V1.MODEL_ACTIVATION, 201, null);
    const available = [...candidates, ...evaluations, ...activations].map((item) => item.object_ref);
    let relation: FieldTwinModelGovernanceActivationRelationV1 | null = null;
    if (activations[0]) {
      const activation = await this.repository.readValidatedObjectByRef(context, activations[0].object_ref, "twin_model_activation_v1");
      const payload = asRecord(activation.payload.payload, "MCFT_MODEL_ACTIVATION_CHAIN_INCOMPLETE");
      for (const key of ["candidate_ref", "evaluation_ref", "activated_runtime_config_ref", "active_lineage_ref", "active_revision_ref"]) {
        const ref = typeof payload[key] === "string" ? String(payload[key]) : "";
        if (ref && !available.includes(ref)) {
          await this.repository.readValidatedObjectByRef(context, ref);
          available.push(ref);
        }
      }
      relation = this.repository.buildActivationRelation(activation, available);
    }
    this.governanceComposer.compose({
      request_scope: context.scope,
      response_started_at: context.response_started_at,
      database_profile: "PROFILE_A_RUNTIME",
      calibration_candidates: candidates.map((item) => this.repository.toGovernanceCandidate(item)),
      shadow_evaluations: evaluations,
      model_activations: activations,
      calibration_candidate_summary: summary("CALIBRATION_CANDIDATE", candidates[0] ?? null),
      shadow_evaluation_summary: summary("SHADOW_EVALUATION", evaluations[0] ?? null),
      model_activation_summary: summary("MODEL_ACTIVATION", activations[0] ?? null),
      attached_activation_relation: relation,
      exact_available_refs: available,
      limitations: [],
    });
  }
}
