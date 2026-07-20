// Purpose: prove MCFT-CAP-07 S3 deterministic read-only composers, keyset pagination, exact graph relations, and governance boundaries.
// Boundary: synthetic in-memory evidence only; no database, route, network, persistence, mutation, or canonical writing.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionLifecycleComposerV1,
  BoundedCollectionPageComposerV1,
  CurrentRuntimeComposerV1,
  FIELD_TWIN_TIMELINE_EVENT_KINDS_V1,
  FIELD_TWIN_TIMELINE_EVENT_RANKS_V1,
  FieldTwinTimelineComposerV1,
  FieldTwinTraceGraphComposerV1,
  ModelGovernanceComposerV1,
  RuntimeHealthComposerV1,
  buildCanonicalVisibilitySnapshotV1,
  buildEmptyCollectionFilterHashV1,
  buildExactCollectionSummaryV1,
  buildScopeHashV1,
  buildTimelineFilterHashV1,
  canonicalUtcInstantV1,
  canonicalizeTimelineFilterV1,
  semanticComposerHashV1,
  verifyFieldTwinCursorV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinCollectionAttachmentV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinComposerObjectV1,
  type FieldTwinEvidenceRefV1,
  type FieldTwinModelGovernanceCandidateV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type FieldTwinTimelineEventV1,
  type FieldTwinTraceEdgeV1,
  type FieldTwinTraceNodeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAP = "docs/digital_twin/mcft/cap_07";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S3_COMPOSERS_RESULT.json");
const checks: Array<{ name: string; status: "PASS" }> = [];
function check(name: string, action: () => void): void { action(); checks.push({ name, status: "PASS" }); }
function expectCode(name: string, code: string, action: () => unknown): void {
  check(name, () => assert.throws(action, (error: unknown) => {
    const candidate = error as { code?: unknown; message?: unknown };
    return candidate?.code === code || String(candidate?.message || "").split(":", 1)[0] === code;
  }));
}
const loadJson = (relative: string): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")) as Record<string, unknown>;
const hash = (value: unknown): SemanticHashTextV1 => semanticComposerHashV1(value);
const at = (minutes: number) => canonicalUtcInstantV1(new Date(Date.parse("2026-07-20T00:00:00.000Z") + minutes * 60_000).toISOString());
const t0 = at(0); const t1 = at(60); const t2 = at(120); const t3 = at(180);
const scope: FieldTwinScopeV1 = Object.freeze({ tenant_id: "tenant-a", project_id: "project-a", group_id: "group-a", field_id: "field-a", season_id: "season-a", zone_id: "zone-a" });
const evidence = (type: string, value: string): FieldTwinEvidenceRefV1 => ({ ref_type: type, ref_value: value });
const visibility = buildCanonicalVisibilitySnapshotV1({ database_visibility_epoch_id: "epoch-s3", pg_snapshot_token: "10:100:20,30", snapshot_xmin: "10", snapshot_xmax: "100", snapshot_xip_values_for_hash: ["30", "20"] });
const signing = { key_id: "key-v1", key: "0123456789abcdef0123456789abcdef", ttl_seconds: 900 } as const;

function object(ref: string, type: string, logicalTime = t1, inputScope = scope): FieldTwinComposerObjectV1 {
  return Object.freeze({ object_ref: ref, object_type: type, object_hash: hash({ ref, type, logicalTime }), source_fact_ref: `fact-${ref}`, scope: inputScope, lineage_id: "lineage-a", revision_id: "revision-a", logical_time: logicalTime, source_refs: [evidence("FACT", `fact-${ref}`)], evidence_refs: [evidence("FACT", `fact-${ref}`)], validation_profile: "CANONICAL_TWIN_FACT_DIRECT", validation_status: "PASS", attachment_status: "ATTACHED_EXACT" });
}
function canonicalRef(value: FieldTwinComposerObjectV1): FieldTwinCanonicalObjectRefV1 { return { object_ref: value.object_ref, object_type: value.object_type, object_hash: value.object_hash, source_fact_ref: value.source_fact_ref }; }
function attached(value: FieldTwinComposerObjectV1): FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> { return { attachment_status: "ATTACHED_EXACT", reason_code: null, item: canonicalRef(value) }; }
const absent = (): FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1> => ({ attachment_status: "ABSENT_OPTIONAL_DOMAIN", reason_code: "NO_VISIBLE_ITEM_IN_SCOPE", item: null });
function collectionItem(ref: string, logicalTime = t1): FieldTwinCollectionItemV1 { return { object_ref: ref, object_type: "collection_item_v1", object_hash: hash({ ref, logicalTime }), logical_time: logicalTime, attachment_status: "ATTACHED_EXACT" }; }
function timelineEvent(kind: FieldTwinTimelineEventV1["event_kind"], logicalTime: ReturnType<typeof canonicalUtcInstantV1>, ref: string): FieldTwinTimelineEventV1 {
  const health = kind === "RUNTIME_HEALTH";
  return { event_id: `event-${ref}`, event_kind: kind, event_rank: FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[kind], object_ref: ref, object_type: kind.toLowerCase(), object_hash: hash({ kind, logicalTime, ref }), scope, lineage_id: "lineage-a", revision_id: "revision-a", logical_time: logicalTime, as_of: null, observed_at: null, available_to_runtime_at: null, created_at: null, transaction_family: health ? "A_STATE_TICK_COMMIT" : null, health_role: health ? "TERMINAL_RECORD_SET_MEMBER" : null, health_resolution_basis: health ? "EXACT_RECORD_SET_MEMBERSHIP" : null, health_resolution_evidence_refs: health ? [evidence("RECORD_SET", "record-set-a")] : null, atomic_group_ref: "record-set-a", source_fact_ref: `fact-${ref}`, source_refs: [evidence("FACT", `fact-${ref}`)], evidence_refs: [evidence("FACT", `fact-${ref}`)], attachment_status: "ATTACHED_EXACT", limitations: [] };
}
const emptySummary = (kind: FieldTwinCollectionKindV1, endpoint: string) => buildExactCollectionSummaryV1({ collection_kind: kind, collection_endpoint: endpoint, items: [] });

const lineage = object("lineage-a", "twin_runtime_lineage_v1", t0);
const checkpoint = object("checkpoint-a", "twin_runtime_checkpoint_v1");
const tick = object("tick-a", "twin_runtime_tick_v1");
const window = object("window-a", "twin_evidence_window_v1");
const transition = object("transition-a", "twin_state_transition_v1");
const assimilation = object("assimilation-a", "twin_assimilation_update_v1");
const posterior = object("posterior-a", "twin_state_history_v1");
const terminalHealth = object("health-terminal-a", "twin_runtime_health_v1");
const operationalHealth = object("health-operational-a", "twin_runtime_health_v1", t2);
const runtimeConfig = object("runtime-config-a", "twin_runtime_config_v1", t0);
const currentForecast = object("forecast-current-a", "twin_forecast_result_v1");
const latestForecast = object("forecast-latest-a", "twin_forecast_result_v1", t2);
const scenarioForecast = object("forecast-scenario-a", "twin_forecast_result_v1");
const scenario = object("scenario-a", "twin_scenario_set_v1", t2);
const decision = object("decision-a", "twin_decision_record_v1", t2);
const plan = object("plan-a", "approved_irrigation_plan_snapshot_v1", t2);
const feedback = collectionItem("feedback-a", t3);
const recordSetValidation = { validation_status: "PASS" as const, record_set_id: "record-set-a", identity_kind: "RUNTIME_TICK_TERMINAL_SET", aggregate_determinism_hash: hash("record-set-a"), recomputed_aggregate_determinism_hash: hash("record-set-a"), exact_member_count: 7, exact_member_refs: [checkpoint, tick, window, transition, assimilation, posterior, terminalHealth].map(canonicalRef), failure_code: null };
const lineageValidation = { source_name: "public.twin_active_lineage_index_v1", profile_family: "OPERATIONAL_POINTER_INDEX" as const, validation_status: "PASS" as const, failure_code: null, validated_object_ref: lineage.object_ref, validated_object_hash: lineage.object_hash, evidence_refs: [evidence("LINEAGE_AUTHORITY", lineage.object_ref)] };
const feedbackSummary = buildExactCollectionSummaryV1({ collection_kind: "ACTION_FEEDBACK", collection_endpoint: "/action-lifecycle", items: [feedback] });

try {
  const currentComposer = new CurrentRuntimeComposerV1();
  const currentInput = { request_scope: scope, response_started_at: t3, root_graph_status: "COMPLETE_EXACT_GRAPH" as const, active_lineage: lineage, active_lineage_authority_validation: lineageValidation, checkpoint, runtime_tick: tick, evidence_window: window, state_transition: transition, assimilation_update: assimilation, posterior_state: posterior, terminal_record_set_health: terminalHealth, runtime_config: runtimeConfig, record_set_validation: recordSetValidation, current_tick_forecast_result: currentForecast, latest_successful_forecast: attached(latestForecast), scenario_source_forecast: attached(scenarioForecast), current_scenario_attachment: attached(scenario), latest_scenario_in_scope: attached(scenario), current_human_decision: attached(decision), current_approved_plan: attached(plan), action_feedback_summary: feedbackSummary, forecast_residual_summary: emptySummary("FORECAST_RESIDUAL", "/residuals"), calibration_candidate_summary: emptySummary("CALIBRATION_CANDIDATE", "/model-governance"), shadow_evaluation_summary: emptySummary("SHADOW_EVALUATION", "/model-governance"), model_activation_summary: emptySummary("MODEL_ACTIVATION", "/model-governance"), limitations: [], validation_summary: [lineageValidation] };
  const runtime = currentComposer.compose(currentInput);
  check("CURRENT_RUNTIME_EXACT_ROOT_SUMMARY_AND_HASH", () => { assert.equal(runtime.root_graph_status, "COMPLETE_EXACT_GRAPH"); assert.equal(runtime.terminal_record_set_health?.object_ref, terminalHealth.object_ref); assert.equal(runtime.action_feedback_summary.total_count, 1); assert.equal("action_feedback_items" in runtime, false); assert.match(runtime.root_graph_content_hash, /^sha256:/); assert.match(runtime.attachment_content_hash, /^sha256:/); assert.match(runtime.response_instance_hash, /^sha256:/); });
  expectCode("CURRENT_RUNTIME_MANDATORY_ROOT_FAILS_CLOSED", "MCFT_RUNTIME_MANDATORY_ROOT_MISSING", () => currentComposer.compose({ ...currentInput, checkpoint: null }));
  expectCode("CURRENT_RUNTIME_RECORD_SET_REQUIRED", "MCFT_RUNTIME_RECORD_SET_VALIDATION_REQUIRED", () => currentComposer.compose({ ...currentInput, record_set_validation: null }));
  expectCode("FORECAST_POINTER_HASH_DIVERGENCE_REJECTED", "MCFT_FORECAST_POINTER_HASH_DIVERGENCE", () => currentComposer.compose({ ...currentInput, latest_successful_forecast: { attachment_status: "ATTACHED_EXACT", reason_code: null, item: { ...canonicalRef(currentForecast), object_hash: hash("wrong") } } }));
  expectCode("SCENARIO_SOURCE_WITHOUT_SCENARIO_REJECTED", "MCFT_SCENARIO_FORECAST_POINTER_INVALID", () => currentComposer.compose({ ...currentInput, current_scenario_attachment: absent() }));
  check("RESPONSE_HASH_BINDS_STARTED_AT", () => { const later = currentComposer.compose({ ...currentInput, response_started_at: at(181) }); assert.equal(later.root_graph_content_hash, runtime.root_graph_content_hash); assert.notEqual(later.response_instance_hash, runtime.response_instance_hash); });

  const terminalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: terminalHealth.object_ref, transaction_family: "A_STATE_TICK_COMMIT", health_role: "TERMINAL_RECORD_SET_MEMBER", health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP", health_resolution_evidence_refs: [evidence("RECORD_SET", "record-set-a")], atomic_group_ref: "record-set-a" };
  const operationalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: operationalHealth.object_ref, transaction_family: "F_OPERATIONAL_ATTEMPT_HEALTH", health_role: "OPERATIONAL_ATTEMPT_AUDIT", health_resolution_basis: "EXACT_OPERATIONAL_ATTEMPT_RELATION", health_resolution_evidence_refs: [evidence("ATTEMPT", "attempt-a")], atomic_group_ref: null };
  const healthComposer = new RuntimeHealthComposerV1();
  const health = healthComposer.compose({ request_scope: scope, response_started_at: t3, terminal_record_set_health: terminalHealth, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: operationalHealth, operational_role_resolution: operationalResolution, health_pointer_validation_summary: [lineageValidation] });
  check("RUNTIME_HEALTH_DUAL_ROLE_EXACT", () => { assert.equal(health.health_relationship, "DISTINCT_OBJECTS"); assert.equal(health.terminal_record_set_health?.object_ref, terminalHealth.object_ref); assert.equal(health.latest_operational_runtime_health?.object_ref, operationalHealth.object_ref); assert.match(health.health_content_hash, /^sha256:/); });
  expectCode("RUNTIME_HEALTH_ROLE_MISMATCH_REJECTED", "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", () => healthComposer.compose({ request_scope: scope, response_started_at: t3, terminal_record_set_health: terminalHealth, terminal_role_resolution: { ...terminalResolution, health_role: "OPERATIONAL_ATTEMPT_AUDIT" }, latest_operational_runtime_health: null, operational_role_resolution: null, health_pointer_validation_summary: [] }));

  const timelineComposer = new FieldTwinTimelineComposerV1();
  const events = Array.from({ length: 53 }, (_, index) => timelineEvent(FIELD_TWIN_TIMELINE_EVENT_KINDS_V1[index % FIELD_TWIN_TIMELINE_EVENT_KINDS_V1.length], at(index * 30), `timeline-${String(index).padStart(3, "0")}`)).reverse();
  const filter = canonicalizeTimelineFilterV1({});
  const timeline1 = timelineComposer.compose({ request_scope: scope, response_started_at: t0, canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, filter, visible_events: events, cursor_signing: signing });
  const timelinePayload = verifyFieldTwinCursorV1(timeline1.next_cursor!, { scope_hash: buildScopeHashV1(scope), filter_hash: buildTimelineFilterHashV1(filter), database_visibility_epoch_id: visibility.database_visibility_epoch_id, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, cursor_kind: "TIMELINE", collection_kind: null, page_limit: 50, now: at(5), signing_keys: { [signing.key_id]: signing.key } }).payload;
  const timeline2 = timelineComposer.compose({ request_scope: scope, response_started_at: at(6), canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, filter, visible_events: events, limit: 50, verified_cursor_payload: timelinePayload, cursor_signing: signing });
  check("TIMELINE_BOUNDED_KEYSET_FIXED_ROOT", () => { assert.equal(timeline1.items.length, 50); assert.equal(timeline2.items.length, 3); assert.equal(timeline1.page_limit, 50); const refs = new Set(timeline1.items.map((entry) => entry.object_ref)); assert.equal(timeline2.items.some((entry) => refs.has(entry.object_ref)), false); assert.equal(timeline2.fixed_root_ref, tick.object_ref); });
  expectCode("TIMELINE_FIXED_ROOT_MISMATCH_REJECTED", "MCFT_CURSOR_FIXED_ROOT_MISMATCH", () => timelineComposer.compose({ request_scope: scope, response_started_at: t1, canonical_visibility_snapshot: visibility, fixed_root_ref: "tick-b", fixed_root_graph_content_hash: runtime.root_graph_content_hash, filter, visible_events: events, limit: 50, verified_cursor_payload: timelinePayload, cursor_signing: signing }));
  expectCode("TIMELINE_MAX_200_ENFORCED", "MCFT_COLLECTION_LIMIT_INVALID", () => timelineComposer.compose({ request_scope: scope, response_started_at: t1, canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, filter, visible_events: events, limit: 201, cursor_signing: signing }));

  const collectionComposer = new BoundedCollectionPageComposerV1();
  const states = Array.from({ length: 52 }, (_, index) => collectionItem(`state-${String(index).padStart(3, "0")}`, at(index * 30)));
  const collection1 = collectionComposer.compose({ endpoint_suffix: "/states", collection_kind: "STATE", request_scope: scope, response_started_at: t0, canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, visible_items: states, cursor_signing: signing });
  const collectionPayload = verifyFieldTwinCursorV1(collection1.next_cursor!, { scope_hash: buildScopeHashV1(scope), filter_hash: buildEmptyCollectionFilterHashV1(), database_visibility_epoch_id: visibility.database_visibility_epoch_id, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, cursor_kind: "OPTIONAL_COLLECTION", collection_kind: "STATE", page_limit: 50, now: at(5), signing_keys: { [signing.key_id]: signing.key } }).payload;
  const collection2 = collectionComposer.compose({ endpoint_suffix: "/states", collection_kind: "STATE", request_scope: scope, response_started_at: at(6), canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, visible_items: states, limit: 50, verified_cursor_payload: collectionPayload, cursor_signing: signing });
  check("COLLECTION_BOUNDED_KEYSET_NO_DUPLICATES", () => { assert.equal(collection1.items.length, 50); assert.equal(collection2.items.length, 2); const refs = new Set(collection1.items.map((entry) => entry.object_ref)); assert.equal(collection2.items.some((entry) => refs.has(entry.object_ref)), false); assert.match(collection1.collection_page_content_hash, /^sha256:/); });
  check("COLLECTION_ENDPOINT_KIND_INVENTORY_EXACT", () => { const mappings: Array<[string, FieldTwinCollectionKindV1]> = [["/states", "STATE"], ["/forecasts", "FORECAST"], ["/scenarios", "SCENARIO"], ["/action-lifecycle", "ACTION_FEEDBACK"], ["/residuals", "FORECAST_RESIDUAL"], ["/model-governance", "CALIBRATION_CANDIDATE"], ["/model-governance", "SHADOW_EVALUATION"], ["/model-governance", "MODEL_ACTIVATION"]]; for (const [endpoint, kind] of mappings) assert.equal(collectionComposer.compose({ endpoint_suffix: endpoint, collection_kind: kind, request_scope: scope, response_started_at: t0, canonical_visibility_snapshot: visibility, fixed_root_ref: tick.object_ref, fixed_root_graph_content_hash: runtime.root_graph_content_hash, visible_items: [], cursor_signing: signing }).page_limit, 50); });

  const traceNodes: FieldTwinTraceNodeV1[] = [tick, posterior, terminalHealth].map((value) => ({ node_id: `node-${value.object_ref}`, object_ref: value.object_ref, object_type: value.object_type, object_hash: value.object_hash, scope, lineage_id: value.lineage_id, revision_id: value.revision_id, logical_time: value.logical_time, source_fact_ref: value.source_fact_ref, validation_profile: value.validation_profile, validation_status: "PASS" }));
  const traceEdges: FieldTwinTraceEdgeV1[] = [{ edge_kind: "POSTERIOR_FOR_TICK", from_ref: posterior.object_ref, to_ref: tick.object_ref, evidence_refs: [evidence("FACT", posterior.source_fact_ref!)] }, { edge_kind: "HEALTH_FOR_TICK", from_ref: terminalHealth.object_ref, to_ref: tick.object_ref, evidence_refs: [evidence("RECORD_SET", "record-set-a")] }];
  const traceComposer = new FieldTwinTraceGraphComposerV1();
  const trace = traceComposer.compose({ request_scope: scope, response_started_at: t3, nodes: traceNodes, exact_edges: traceEdges, unattached_objects: [], missing_diagnostics: [], record_set_validation: recordSetValidation, health_role_resolutions: [terminalResolution], active_lineage_authority_validation: lineageValidation });
  check("TRACE_GRAPH_EXACT_EDGES_HASHED", () => { assert.equal(trace.edges.length, 2); assert.match(trace.trace_graph_content_hash, /^sha256:/); });
  expectCode("TRACE_UNRESOLVED_EDGE_REJECTED", "MCFT_TRACE_EDGE_ENDPOINT_UNRESOLVED", () => traceComposer.compose({ request_scope: scope, response_started_at: t3, nodes: traceNodes, exact_edges: [{ edge_kind: "HEALTH_FOR_TICK", from_ref: "missing", to_ref: tick.object_ref, evidence_refs: [evidence("FACT", "x")] }], unattached_objects: [], missing_diagnostics: [], record_set_validation: recordSetValidation, health_role_resolutions: [], active_lineage_authority_validation: lineageValidation }));

  const actionComposer = new ActionLifecycleComposerV1();
  const action = actionComposer.compose({ request_scope: scope, response_started_at: t3, current_human_decision: attached(decision), current_approved_plan: attached(plan), action_feedback_summary: feedbackSummary, exact_edges: [{ edge_kind: "DECISION_BOUND_TO_PLAN", from_ref: decision.object_ref, to_ref: plan.object_ref, evidence_refs: [evidence("APPROVAL", "approval-a")] }, { edge_kind: "PLAN_EXECUTED_BY_FEEDBACK", from_ref: plan.object_ref, to_ref: feedback.object_ref, evidence_refs: [evidence("RECEIPT", "receipt-a")] }], limitations: [] });
  check("ACTION_LIFECYCLE_EXACT_CHAIN", () => { assert.equal(action.exact_edges.length, 2); assert.equal(action.action_feedback_summary.latest_item_ref, feedback.object_ref); });
  expectCode("ACTION_FEEDBACK_WITHOUT_PLAN_REJECTED", "MCFT_ACTION_FEEDBACK_WITHOUT_PLAN", () => actionComposer.compose({ request_scope: scope, response_started_at: t3, current_human_decision: attached(decision), current_approved_plan: absent(), action_feedback_summary: feedbackSummary, exact_edges: [], limitations: [] }));

  const candidate: FieldTwinModelGovernanceCandidateV1 = { ...collectionItem("candidate-a", t1), activation_status: "NOT_ACTIVE", eligible_for_state_input: false, eligible_for_runtime_config_use: false };
  const evaluation = collectionItem("evaluation-a", t2); const activation = collectionItem("activation-a", t3);
  const candidateSummary = buildExactCollectionSummaryV1({ collection_kind: "CALIBRATION_CANDIDATE", collection_endpoint: "/model-governance", items: [candidate] });
  const evaluationSummary = buildExactCollectionSummaryV1({ collection_kind: "SHADOW_EVALUATION", collection_endpoint: "/model-governance", items: [evaluation] });
  const activationSummary = buildExactCollectionSummaryV1({ collection_kind: "MODEL_ACTIVATION", collection_endpoint: "/model-governance", items: [activation] });
  const relation = { activation, candidate_ref: candidate.object_ref, evaluation_ref: evaluation.object_ref, activated_runtime_config_ref: runtimeConfig.object_ref, active_lineage_ref: lineage.object_ref, active_revision_ref: "revision-a", relation_evidence_refs: [evidence("MODEL_ACTIVATION", activation.object_ref)] };
  const governanceComposer = new ModelGovernanceComposerV1();
  const governance = governanceComposer.compose({ database_profile: "PROFILE_A_RUNTIME", request_scope: scope, response_started_at: t3, calibration_candidates: [candidate], shadow_evaluations: [evaluation], model_activations: [activation], calibration_candidate_summary: candidateSummary, shadow_evaluation_summary: evaluationSummary, model_activation_summary: activationSummary, attached_activation_relation: relation, exact_available_refs: [candidate.object_ref, evaluation.object_ref, activation.object_ref, runtimeConfig.object_ref, lineage.object_ref, "revision-a"], limitations: [] });
  check("MODEL_GOVERNANCE_EXACT_ACTIVATION_CHAIN", () => { assert.equal(governance.attached_activation_relation?.activation.object_ref, activation.object_ref); assert.equal(candidate.activation_status, "NOT_ACTIVE"); assert.equal(candidate.eligible_for_state_input, false); });
  const shadowOnly = governanceComposer.compose({ database_profile: "PROFILE_B_CALIBRATION", request_scope: scope, response_started_at: t3, calibration_candidates: [candidate], shadow_evaluations: [evaluation], model_activations: [], calibration_candidate_summary: candidateSummary, shadow_evaluation_summary: evaluationSummary, model_activation_summary: emptySummary("MODEL_ACTIVATION", "/model-governance"), attached_activation_relation: null, exact_available_refs: [candidate.object_ref, evaluation.object_ref], limitations: [] });
  check("SHADOW_EVALUATION_DOES_NOT_INFER_ACTIVATION", () => assert.equal(shadowOnly.attached_activation_relation, null));
  expectCode("CROSS_DATABASE_ACTIVATION_STITCH_REJECTED", "MCFT_MODEL_GOVERNANCE_CROSS_DATABASE_STITCH_FORBIDDEN", () => governanceComposer.compose({ database_profile: "PROFILE_B_CALIBRATION", request_scope: scope, response_started_at: t3, calibration_candidates: [candidate], shadow_evaluations: [evaluation], model_activations: [activation], calibration_candidate_summary: candidateSummary, shadow_evaluation_summary: evaluationSummary, model_activation_summary: activationSummary, attached_activation_relation: relation, exact_available_refs: [candidate.object_ref, evaluation.object_ref, activation.object_ref, runtimeConfig.object_ref, lineage.object_ref, "revision-a"], limitations: [] }));

  check("S2_ATTESTATION_CONSUMED", () => { const predecessor = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`); assert.equal(predecessor.status, "PASS"); assert.equal(predecessor.merge_commit, "27fcba8cf39cd62b7c9e71ee20577feced182ab0"); assert.equal(predecessor.candidate_to_merge_tree_delta, 0); assert.equal(predecessor.attestation_workflow_run_id, 29765257247); assert.equal(predecessor.artifact_id, 8470534831); assert.equal(predecessor.effective_frontier, "S3"); });
  check("S3_STATUS_S4_SEED_AND_MANIFEST", () => { const s3 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json`); const s4 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json`); const manifest = loadJson(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`); assert.equal(s3.s3_candidate_implemented, true); assert.equal(s3.implementation_authorized, true); assert.equal(s3.runtime_authority_delta, "READ_ONLY_COMPOSERS_ONLY"); assert.equal(s4.s4_candidate_implemented, false); assert.equal(s4.implementation_authorized, false); assert.equal(manifest.current_slice, "S3"); assert.equal(manifest.canonical_write_authorized, false); assert.equal(manifest.mcft_cap_08_authorized, false); });
  check("S4_REGISTRY_BOOTSTRAP_FUTURE_ONLY", () => { const registry = loadJson("docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json"); const cap = (registry.capabilities as Array<Record<string, unknown>>).find((entry) => entry.capability_line === "MCFT-CAP-07")!; assert.ok((cap.authoritative_candidate_status_paths as string[]).includes(`${CAP}/GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json`)); assert.equal(cap.implementation_authorized, false); assert.equal(cap.runtime_source_authorized, false); });

  const composerFiles = ["composer_contracts_v1.ts", "current_runtime_composer_v1.ts", "bounded_page_composers_v1.ts", "trace_graph_composer_v1.ts", "runtime_health_composer_v1.ts", "action_and_governance_composers_v1.ts"].map((file) => path.join(ROOT, "apps/server/src/domain/field_twin_read_model", file));
  check("S3_STATIC_NO_DATABASE_OR_WRITE_BOUNDARY", () => { for (const file of composerFiles) { const source = fs.readFileSync(file, "utf8"); assert.doesNotMatch(source, /from\s+["']pg["']/); assert.doesNotMatch(source, /\/repositories\//); assert.doesNotMatch(source, /\/infra\//); assert.doesNotMatch(source, /\/routes\//); assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i); } });
  const base = process.env.MCFT_BASE_SHA || "";
  if (base) check("S3_CHANGED_FILE_BOUNDARY", () => { const changed = cp.execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: ROOT, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean); const allowed = (file: string) => file.startsWith("apps/server/src/domain/field_twin_read_model/") || /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_07_S3_COMPOSERS(?:_V2|_V3)?\.ts$/.test(file) || file.startsWith(`${CAP}/`) || file === "docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json" || file === ".github/workflows/mcft-cap-07-s3-composers.yml"; assert.deepEqual(changed.filter((file) => !allowed(file)), []); assert.deepEqual(changed.filter((file) => file.includes("/db/migrations/") || file.startsWith("apps/server/src/routes/") || file.startsWith("apps/web/") || file.startsWith("apps/server/src/infra/") || file.startsWith("apps/server/src/repositories/") || file.startsWith("apps/server/src/projections/")), []); });

  const result = { schema_version: "geox_mcft_cap_07_s3_composers_result_v1", status: "PASS", check_count: checks.length, checks, composer_count: 7, composer_names: ["CurrentRuntimeComposerV1", "FieldTwinTimelineComposerV1", "FieldTwinTraceGraphComposerV1", "ActionLifecycleComposerV1", "ModelGovernanceComposerV1", "BoundedCollectionPageComposerV1", "RuntimeHealthComposerV1"], default_page_limit: 50, maximum_page_limit: 200, runtime_authority_delta: "READ_ONLY_COMPOSERS_ONLY", canonical_write_authority_delta: "ZERO", direct_database_access_performed: false, route_implementation_performed: false, frontend_implementation_performed: false, migration_performed: false, persistence_performed: false, cap_08_authorized: false };
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8"); console.log(`MCFT-CAP-07 S3 composers: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify({ schema_version: "geox_mcft_cap_07_s3_composers_result_v1", status: "FAIL", error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`, "utf8"); console.error(error); process.exitCode = 1;
}
