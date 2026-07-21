// Purpose: build and persist one deterministic CAP-05 Decision -> Approved Plan -> Action Feedback chain for the CAP-07 local demo.
// Boundary: development-only caller-owned transaction; pure production builders plus append-only facts and rebuildable projections, with no approval, dispatch, State mutation, model activation, or production authority.

import type { PoolClient } from "pg";
import {
  buildCap05ActionFeedbackV1,
  buildCap05DecisionV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  validateCap05ApprovalPlanDecisionBindingV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import {
  buildCap05ActionFeedbackProjectionRowsV1,
  buildCap05ApprovedPlanBindingProjectionRowV1,
  buildCap05DecisionProjectionRowV1,
} from "../../apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.js";
import { factId, type DemoBundle, type JsonRecord } from "./three_surface_local_demo_contract_v1.js";

const SOURCE = "scripts/dev_seed/seed_three_surface_local_demo_v1";
const DECIDED_AT = "2026-06-01T00:20:00.000Z";
const ASSERTED_AT = "2026-06-01T00:22:00.000Z";
const PLAN_AVAILABLE_AT = "2026-06-01T00:24:00.000Z";
const EXECUTION_START = "2026-06-01T00:25:00.000Z";
const EXECUTION_END = "2026-06-01T00:35:00.000Z";
const EXECUTION_AVAILABLE_AT = "2026-06-01T00:36:00.000Z";

export type LocalDemoActionLifecycleV1 = {
  decision: Cap05DecisionEnvelopeV1;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1;
  approved_plan: Cap05ApprovedPlanEvidenceV1;
  execution_receipt: JsonRecord;
  action_feedback: Cap05ActionFeedbackEnvelopeV1;
};

function replayEvidenceHashV1<T extends JsonRecord>(record: T): T {
  record.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(record);
  return record;
}

function evidenceFactIdV1(sourceRecordId: string): string {
  return `local_demo_mcft_cap07_evidence_${sourceRecordId}`;
}

function exactScenarioAmountV1(option: JsonRecord): string {
  const value = String(option.requested_irrigation_mm ?? option.irrigation_amount_mm ?? "").trim();
  if (!/^\d+\.\d{6}$/.test(value)) throw new Error(`LOCAL_DEMO_SCENARIO_AMOUNT_INVALID:${value}`);
  return value;
}

export function normalizeLocalDemoScenarioForActionLifecycleV1(bundle: DemoBundle): void {
  const rawOptions = bundle.scenario.payload.options;
  if (!Array.isArray(rawOptions) || rawOptions.length !== 3) throw new Error("LOCAL_DEMO_SCENARIO_OPTIONS_INVALID");
  const options = rawOptions.map((raw) => {
    const option = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as JsonRecord : {};
    return { ...option, requested_irrigation_mm: exactScenarioAmountV1(option) };
  });
  bundle.scenario.payload = { ...bundle.scenario.payload, options };
  bundle.scenario.determinism_hash = computeMemberDeterminismHashV1(bundle.scenario);
}

export function buildLocalDemoActionLifecycleV1(bundle: DemoBundle): LocalDemoActionLifecycleV1 {
  const scenario = bundle.scenario as unknown as Cap04ScenarioSetEnvelopeV1;
  const selectedOptionId = "IRRIGATE_NOW_15MM" as const;
  const decisionRequestRef = "local-demo-decision-request-v1";
  const decisionRequestHash = semanticHashV1({
    schema_version: "local_demo_decision_request_v1",
    scope: bundle.scope,
    scenario_set_ref: scenario.object_id,
    scenario_set_hash: scenario.determinism_hash,
    selected_option_id: selectedOptionId,
    actor_ref: "local-demo-human-operator-v1",
  });
  const decision = buildCap05DecisionV1({
    scope: bundle.scope,
    scenario_set: scenario,
    selected_option_id: selectedOptionId,
    decision_request_evidence_ref: decisionRequestRef,
    decision_request_evidence_hash: decisionRequestHash,
    actor_ref: "local-demo-human-operator-v1",
    decided_at: DECIDED_AT,
    context_lineage_ref: String(bundle.scenario.lineage_id),
    context_revision_ref: String(bundle.scenario.revision_id),
    created_at: DECIDED_AT,
  });

  const assertionPayload = {
    approval_semantics: "EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION" as const,
    approval_status: "APPROVED" as const,
    approver_class: "HUMAN" as const,
    approver_ref: "local-demo-human-operator-v1",
    decision_request_ref: decision.payload.decision_request_evidence_ref,
    decision_request_hash: decision.payload.decision_request_evidence_hash,
    selected_option_ref: decision.payload.selected_option_ref,
    selected_option_hash: decision.payload.selected_option_hash,
    geox_approval_request_created: false as const,
    geox_approval_authority_exercised: false as const,
  };
  const approvalAssertion = replayEvidenceHashV1({
    ...bundle.scope,
    dataset_id: "mcft_cap07_local_demo_action_lifecycle_v1",
    source_record_id: "local-demo-approval-assertion-v1",
    source_record_hash: "",
    record_type: "approval_assertion_evidence_v1" as const,
    evidence_identity_key: "mcft_cap07_local_demo:approval_assertion:v1",
    idempotency_key: "mcft_cap07_local_demo:approval_assertion:v1",
    ingress_adapter_id: "canonical_replay_evidence_ingress_v1" as const,
    ingress_adapter_version: 1 as const,
    origin_source_id: "mcft_cap07_local_demo_action_source_v1",
    origin_source_kind: "CONTROLLED_REPLAY_DATASET" as const,
    source_version: "1",
    available_to_runtime_at: ASSERTED_AT,
    binding_id: "mcft_cap07_local_demo_plan_binding_v1",
    quality: { status: "PASS" as const },
    epistemic_class: "ASSERTED" as const,
    limitations: ["CONTROLLED_LOCAL_DEMO_ONLY", "NO_GEOX_APPROVAL_AUTHORITY"],
    source_payload: structuredClone(assertionPayload),
    canonical_payload: structuredClone(assertionPayload),
    action_lifecycle_class: "APPROVAL_ASSERTION" as const,
    role_time: {
      asserted_at: ASSERTED_AT,
      approved_at: ASSERTED_AT,
      ingested_at: ASSERTED_AT,
      available_to_runtime_at: ASSERTED_AT,
    },
  } as unknown as Cap05ApprovalAssertionEvidenceV1 & JsonRecord) as unknown as Cap05ApprovalAssertionEvidenceV1;

  const planPayload = {
    plan_status: "APPROVED" as const,
    active_for_decision: true,
    approval_assertion_ref: approvalAssertion.source_record_id,
    approval_assertion_hash: approvalAssertion.source_record_hash,
    decision_request_ref: decision.payload.decision_request_evidence_ref,
    decision_request_hash: decision.payload.decision_request_evidence_hash,
    selected_option_ref: decision.payload.selected_option_ref,
    selected_option_hash: decision.payload.selected_option_hash,
    scenario_amount_mm: "15.000000",
    approved_amount_mm: "14.000000",
    amount_difference_mm: "-1.000000",
    amount_difference_reason_codes: ["CONTROLLED_LOCAL_DEMO_LIMIT"],
    target_scope: { ...bundle.scope },
  };
  const approvedPlan = replayEvidenceHashV1({
    ...bundle.scope,
    dataset_id: "mcft_cap07_local_demo_action_lifecycle_v1",
    source_record_id: "local-demo-approved-plan-v1",
    source_record_hash: "",
    record_type: "approved_irrigation_plan_snapshot_v1" as const,
    evidence_identity_key: "mcft_cap07_local_demo:approved_plan:v1",
    idempotency_key: "mcft_cap07_local_demo:approved_plan:v1",
    ingress_adapter_id: "canonical_replay_evidence_ingress_v1" as const,
    ingress_adapter_version: 1 as const,
    origin_source_id: "mcft_cap07_local_demo_action_source_v1",
    origin_source_kind: "CONTROLLED_REPLAY_DATASET" as const,
    source_version: "1",
    available_to_runtime_at: PLAN_AVAILABLE_AT,
    binding_id: "mcft_cap07_local_demo_plan_binding_v1",
    quality: { status: "PASS" as const },
    epistemic_class: "ASSERTED" as const,
    limitations: ["CONTROLLED_LOCAL_DEMO_ONLY", "NO_GEOX_APPROVAL_AUTHORITY", "NO_DISPATCH_CREATED"],
    source_payload: structuredClone(planPayload),
    canonical_payload: structuredClone(planPayload),
    action_lifecycle_class: "APPROVED_PLAN" as const,
    role_time: {
      created_at: ASSERTED_AT,
      approved_at: ASSERTED_AT,
      ingested_at: PLAN_AVAILABLE_AT,
      available_to_runtime_at: PLAN_AVAILABLE_AT,
      plan_effective_from: EXECUTION_START,
      plan_effective_to: "2026-06-01T01:00:00.000Z",
    },
  } as unknown as Cap05ApprovedPlanEvidenceV1 & JsonRecord) as unknown as Cap05ApprovedPlanEvidenceV1;
  validateCap05ApprovalPlanDecisionBindingV1({
    decision,
    approval_assertion: approvalAssertion,
    approved_plan: approvedPlan,
    as_of: PLAN_AVAILABLE_AT,
  });

  const receiptPayload = {
    event_id: "local-demo-irrigation-execution-v1",
    approved_plan_ref: approvedPlan.source_record_id,
    approved_plan_hash: approvedPlan.source_record_hash,
    execution_status: "EXECUTED",
    actual_amount_mm: "14.000000",
    spatial_coverage_fraction: "0.950000",
    execution_start: EXECUTION_START,
    execution_end: EXECUTION_END,
    target_scope: { ...bundle.scope },
  };
  const executionReceipt = replayEvidenceHashV1({
    ...bundle.scope,
    dataset_id: "mcft_cap07_local_demo_action_lifecycle_v1",
    source_record_id: "local-demo-irrigation-execution-receipt-v1",
    source_record_hash: "",
    record_type: "irrigation_execution_receipt_evidence_v1",
    evidence_identity_key: "mcft_cap07_local_demo:execution_receipt:v1",
    idempotency_key: "mcft_cap07_local_demo:execution_receipt:v1",
    ingress_adapter_id: "canonical_replay_evidence_ingress_v1",
    ingress_adapter_version: 1,
    origin_source_id: "mcft_cap07_local_demo_action_source_v1",
    origin_source_kind: "CONTROLLED_REPLAY_DATASET",
    source_version: "1",
    available_to_runtime_at: EXECUTION_AVAILABLE_AT,
    binding_id: "mcft_cap07_local_demo_action_binding_v1",
    quality: { status: "PASS" },
    epistemic_class: "ASSERTED",
    limitations: ["CONTROLLED_LOCAL_DEMO_ONLY", "NOT_LIVE_EXECUTION_EVIDENCE"],
    source_payload: structuredClone(receiptPayload),
    canonical_payload: structuredClone(receiptPayload),
    action_lifecycle_class: "EXECUTION_RECEIPT",
    role_time: {
      execution_start: EXECUTION_START,
      execution_end: EXECUTION_END,
      ingested_at: EXECUTION_AVAILABLE_AT,
      available_to_runtime_at: EXECUTION_AVAILABLE_AT,
    },
  });

  const actionFeedback = buildCap05ActionFeedbackV1({
    scope: bundle.scope,
    decision_ref: decision.object_id,
    decision_hash: decision.determinism_hash,
    approved_plan_evidence_ref: approvedPlan.source_record_id,
    approved_plan_evidence_hash: approvedPlan.source_record_hash,
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: String(executionReceipt.source_record_id),
    as_executed_ref: null,
    acceptance_ref: null,
    task_ref: null,
    dispatch_disposition: "NOT_OBSERVED",
    event_id: "local-demo-irrigation-execution-v1",
    source_record_id: "local-demo-action-feedback-source-v1",
    binding_id: "mcft_cap07_local_demo_action_binding_v1",
    origin_source_id: "mcft_cap07_local_demo_action_source_v1",
    execution_status: "EXECUTED",
    validation_status: "VALIDATED_WITH_LIMITATIONS",
    source_quality: "PASS",
    eligible_for_state_input: false,
    actual_amount_mm: "14.000000",
    spatial_coverage_fraction: "0.950000",
    execution_start: EXECUTION_START,
    execution_end: EXECUTION_END,
    ingested_at: EXECUTION_AVAILABLE_AT,
    available_to_runtime_at: EXECUTION_AVAILABLE_AT,
    runtime_config_ref: bundle.runtime_config.object_id,
    runtime_config_hash: bundle.runtime_config.determinism_hash,
    context_lineage_ref: String(bundle.scenario.lineage_id),
    context_revision_ref: String(bundle.scenario.revision_id),
    created_at: EXECUTION_AVAILABLE_AT,
  });

  return {
    decision,
    approval_assertion: approvalAssertion,
    approved_plan: approvedPlan,
    execution_receipt: executionReceipt,
    action_feedback: actionFeedback,
  };
}

async function assertRelationsV1(client: PoolClient): Promise<void> {
  const relations = [
    "facts",
    "twin_object_idempotency_index_v1",
    "twin_decision_record_projection_v1",
    "twin_approved_plan_binding_projection_v1",
    "twin_action_feedback_projection_v1",
    "twin_action_feedback_evidence_index_v1",
  ];
  const result = await client.query<{ relation_name: string; exists: boolean }>(
    `SELECT relation_name, pg_catalog.to_regclass('public.' || relation_name) IS NOT NULL AS exists
       FROM unnest($1::text[]) AS relation_name`,
    [relations],
  );
  const missing = result.rows.filter((row) => !row.exists).map((row) => row.relation_name);
  if (missing.length) throw new Error(`LOCAL_DEMO_ACTION_SCHEMA_MISSING:${missing.join(",")}`);
}

async function insertFactV1(client: PoolClient, input: {
  fact_id: string;
  occurred_at: string;
  source: string;
  type: string;
  payload: JsonRecord;
}): Promise<void> {
  const record = { type: input.type, payload: input.payload };
  const existing = await client.query<{ record_json: unknown }>("SELECT record_json FROM public.facts WHERE fact_id=$1", [input.fact_id]);
  if (existing.rowCount) {
    if (semanticHashV1(existing.rows[0]?.record_json) !== semanticHashV1(record)) throw new Error(`LOCAL_DEMO_ACTION_FACT_CONFLICT:${input.fact_id}`);
    return;
  }
  await client.query(
    "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)",
    [input.fact_id, input.occurred_at, input.source, JSON.stringify(record)],
  );
}

async function ensureObjectIdentityV1(client: PoolClient, object: Cap05DecisionEnvelopeV1 | Cap05ActionFeedbackEnvelopeV1): Promise<void> {
  const identityKind = object.object_type === "twin_decision_record_v1" ? "G_DECISION_RECORD" : "H_ACTION_FEEDBACK";
  const existing = await client.query<{ identity_kind: string; record_set_id: string; determinism_hash: string }>(
    "SELECT identity_kind,record_set_id,determinism_hash FROM public.twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
    [object.idempotency_key],
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (existing.rowCount !== 1 || row.identity_kind !== identityKind || row.record_set_id !== object.object_id || row.determinism_hash !== object.determinism_hash) {
      throw new Error(`LOCAL_DEMO_ACTION_IDEMPOTENCY_CONFLICT:${object.idempotency_key}`);
    }
    return;
  }
  await client.query(
    `INSERT INTO public.twin_object_idempotency_index_v1(
       identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes
     ) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
    [
      identityKind,
      object.idempotency_key,
      object.object_id,
      object.determinism_hash,
      JSON.stringify({ object_type: object.object_type, object_id: object.object_id, scope: bundleScopeV1(object), logical_time: object.logical_time, as_of: object.as_of }),
      JSON.stringify({ [object.object_type]: object.object_id }),
      JSON.stringify({ [object.object_id]: object.determinism_hash }),
    ],
  );
}

function bundleScopeV1(object: Cap05DecisionEnvelopeV1 | Cap05ActionFeedbackEnvelopeV1): JsonRecord {
  return {
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
  };
}

export async function persistLocalDemoActionLifecycleV1(
  client: PoolClient,
  lifecycle: LocalDemoActionLifecycleV1,
): Promise<void> {
  await assertRelationsV1(client);
  await insertFactV1(client, {
    fact_id: factId(lifecycle.decision.object_id),
    occurred_at: lifecycle.decision.logical_time,
    source: SOURCE,
    type: lifecycle.decision.object_type,
    payload: lifecycle.decision as unknown as JsonRecord,
  });
  for (const evidence of [lifecycle.approval_assertion, lifecycle.approved_plan, lifecycle.execution_receipt]) {
    await insertFactV1(client, {
      fact_id: evidenceFactIdV1(String(evidence.source_record_id)),
      occurred_at: String(evidence.available_to_runtime_at),
      source: "mcft_cap05_replay_evidence_v1",
      type: String(evidence.record_type),
      payload: evidence as unknown as JsonRecord,
    });
  }
  await insertFactV1(client, {
    fact_id: factId(lifecycle.action_feedback.object_id),
    occurred_at: lifecycle.action_feedback.logical_time,
    source: SOURCE,
    type: lifecycle.action_feedback.object_type,
    payload: lifecycle.action_feedback as unknown as JsonRecord,
  });
  await ensureObjectIdentityV1(client, lifecycle.decision);
  await ensureObjectIdentityV1(client, lifecycle.action_feedback);

  const decisionRow = buildCap05DecisionProjectionRowV1(lifecycle.decision, factId(lifecycle.decision.object_id));
  await client.query(
    `INSERT INTO public.twin_decision_record_projection_v1(
       decision_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
       scenario_set_ref,scenario_set_hash,selected_option_ref,selected_option_hash,selected_option_id,
       decision_request_evidence_ref,decision_request_evidence_hash,actor_ref,determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
     ON CONFLICT (decision_object_id) DO UPDATE SET
       determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      decisionRow.decision_object_id, decisionRow.tenant_id, decisionRow.project_id, decisionRow.group_id,
      decisionRow.field_id, decisionRow.season_id, decisionRow.zone_id, decisionRow.logical_time, decisionRow.as_of,
      decisionRow.scenario_set_ref, decisionRow.scenario_set_hash, decisionRow.selected_option_ref,
      decisionRow.selected_option_hash, decisionRow.selected_option_id, decisionRow.decision_request_evidence_ref,
      decisionRow.decision_request_evidence_hash, decisionRow.actor_ref, decisionRow.determinism_hash,
      JSON.stringify(decisionRow.canonical_payload), decisionRow.source_fact_id,
    ],
  );

  const planFactId = evidenceFactIdV1(lifecycle.approved_plan.source_record_id);
  const planRow = buildCap05ApprovedPlanBindingProjectionRowV1(lifecycle.approved_plan, planFactId);
  await client.query(
    `INSERT INTO public.twin_approved_plan_binding_projection_v1(
       approved_plan_evidence_ref,approved_plan_evidence_hash,tenant_id,project_id,group_id,field_id,season_id,zone_id,
       binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,
       selected_option_ref,selected_option_hash,scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,
       active_for_decision,canonical_evidence,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz,$20,$21::jsonb,$22)
     ON CONFLICT (approved_plan_evidence_ref) DO UPDATE SET
       approved_plan_evidence_hash=EXCLUDED.approved_plan_evidence_hash,active_for_decision=EXCLUDED.active_for_decision,
       canonical_evidence=EXCLUDED.canonical_evidence,source_fact_id=EXCLUDED.source_fact_id`,
    [
      planRow.approved_plan_evidence_ref, planRow.approved_plan_evidence_hash, planRow.tenant_id, planRow.project_id,
      planRow.group_id, planRow.field_id, planRow.season_id, planRow.zone_id, planRow.binding_id,
      planRow.approval_assertion_ref, planRow.approval_assertion_hash, planRow.decision_request_ref,
      planRow.decision_request_hash, planRow.selected_option_ref, planRow.selected_option_hash,
      planRow.scenario_amount_mm, planRow.approved_amount_mm, planRow.plan_effective_from, planRow.plan_effective_to,
      planRow.active_for_decision, JSON.stringify(planRow.canonical_evidence), planRow.source_fact_id,
    ],
  );

  const actionFactId = factId(lifecycle.action_feedback.object_id);
  const actionRows = buildCap05ActionFeedbackProjectionRowsV1(lifecycle.action_feedback, actionFactId);
  const actionRow = actionRows.feedback;
  await client.query(
    `INSERT INTO public.twin_action_feedback_projection_v1(
       action_feedback_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time,as_of,
       decision_ref,decision_hash,approved_plan_evidence_ref,approved_plan_evidence_hash,dispatch_disposition,event_id,
       source_record_id,binding_id,origin_source_id,execution_status,validation_status,source_quality,eligible_for_state_input,
       actual_amount_mm,spatial_coverage_fraction,target_scope_equivalent_irrigation_mm,execution_start,execution_end,
       available_to_runtime_at,determinism_hash,canonical_payload,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::timestamptz,$27::timestamptz,$28::timestamptz,$29,$30::jsonb,$31)
     ON CONFLICT (action_feedback_object_id) DO UPDATE SET
       determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      actionRow.action_feedback_object_id, actionRow.tenant_id, actionRow.project_id, actionRow.group_id,
      actionRow.field_id, actionRow.season_id, actionRow.zone_id, actionRow.logical_time, actionRow.as_of,
      actionRow.decision_ref, actionRow.decision_hash, actionRow.approved_plan_evidence_ref,
      actionRow.approved_plan_evidence_hash, actionRow.dispatch_disposition, actionRow.event_id,
      actionRow.source_record_id, actionRow.binding_id, actionRow.origin_source_id, actionRow.execution_status,
      actionRow.validation_status, actionRow.source_quality, actionRow.eligible_for_state_input,
      actionRow.actual_amount_mm, actionRow.spatial_coverage_fraction, actionRow.target_scope_equivalent_irrigation_mm,
      actionRow.execution_start, actionRow.execution_end, actionRow.available_to_runtime_at,
      actionRow.determinism_hash, JSON.stringify(actionRow.canonical_payload), actionRow.source_fact_id,
    ],
  );
  await client.query("DELETE FROM public.twin_action_feedback_evidence_index_v1 WHERE action_feedback_object_id=$1", [lifecycle.action_feedback.object_id]);
  for (const evidence of actionRows.evidence) {
    await client.query(
      `INSERT INTO public.twin_action_feedback_evidence_index_v1(
         action_feedback_object_id,evidence_kind,evidence_ref,evidence_hash,source_fact_id
       ) VALUES($1,$2,$3,$4,$5)`,
      [evidence.action_feedback_object_id, evidence.evidence_kind, evidence.evidence_ref, evidence.evidence_hash, evidence.source_fact_id],
    );
  }
}

export function localDemoActionLifecycleManifestV1(lifecycle: LocalDemoActionLifecycleV1): JsonRecord {
  return {
    decision: { object_ref: lifecycle.decision.object_id, object_hash: lifecycle.decision.determinism_hash },
    approval_assertion: { source_record_ref: lifecycle.approval_assertion.source_record_id, source_record_hash: lifecycle.approval_assertion.source_record_hash },
    approved_plan: { source_record_ref: lifecycle.approved_plan.source_record_id, source_record_hash: lifecycle.approved_plan.source_record_hash },
    execution_receipt: { source_record_ref: lifecycle.execution_receipt.source_record_id, source_record_hash: lifecycle.execution_receipt.source_record_hash },
    action_feedback: { object_ref: lifecycle.action_feedback.object_id, object_hash: lifecycle.action_feedback.determinism_hash },
  };
}
