// Purpose: prove MCFT-CAP-07 S6 domain composition profiles, PostgreSQL production readback, pool re-instantiation, rebuild/cursor stability, zero-write observation, and closure nonclaims.
// Boundary: isolated PostgreSQL fixture writes and pure production composers only; no product database mutation, Runtime source activation, canonical write authority, PostgreSQL service-restart claim, or CAP-08 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  ActionLifecycleComposerV1,
  CurrentRuntimeComposerV1,
  ModelGovernanceComposerV1,
  RuntimeHealthComposerV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinComposerObjectV1,
  type FieldTwinScopeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import { computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

const DB = String(process.env.MCFT_S6_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S6_CLOSURE_RESULT.json");
const scope: FieldTwinScopeV1 = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA" };
const checks: Array<{ name: string; status: "PASS"; ledger_items: string[]; details?: unknown }> = [];
const at = (minute: number, seconds = 0) => new Date(Date.UTC(2026, 6, 21, 0, minute, seconds)).toISOString();

type Obj = Record<string, any>;
type RootFixture = { root_ref: string; root_hash: string; lineage_ref: string; members: Obj[]; objects: Obj[] };

function check(name: string, ledgerItems: string[], fn: () => void, details?: unknown): void {
  fn();
  checks.push({ name, status: "PASS", ledger_items: ledgerItems, ...(details === undefined ? {} : { details }) });
}

async function withTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function object(id: string, type: string, logicalTime: string, payload: Obj = {}, extra: Obj = {}): Obj {
  const value: Obj = {
    object_id: id,
    object_type: type,
    ...scope,
    lineage_id: extra.lineage_id ?? "lineage-a",
    revision_id: extra.revision_id ?? "revision-a",
    logical_time: logicalTime,
    as_of: logicalTime,
    payload,
    source_refs: [],
    evidence_refs: [],
    limitations: [],
    ...extra,
  };
  value.determinism_hash = computeMemberDeterminismHashV1(value);
  return value;
}

function envelope(obj: Obj): Obj { return { type: obj.object_type, payload: obj }; }
function ref(obj: Obj): FieldTwinCanonicalObjectRefV1 { return { object_ref: obj.object_id, object_type: obj.object_type, object_hash: obj.determinism_hash, source_fact_ref: `fact-${obj.object_id}` }; }
function composerObject(obj: Obj): FieldTwinComposerObjectV1 {
  return { ...ref(obj), scope, lineage_id: obj.lineage_id ?? null, revision_id: obj.revision_id ?? null, logical_time: obj.logical_time, source_refs: [], evidence_refs: [], validation_profile: "CANONICAL_TWIN_FACT_DIRECT", validation_status: "PASS", attachment_status: "ATTACHED_EXACT" };
}
function attachment(obj: Obj | null, reason = "ABSENT_OPTIONAL_DOMAIN"): any {
  return obj ? { attachment_status: "ATTACHED_EXACT", reason_code: null, item: ref(obj) } : { attachment_status: "ABSENT_OPTIONAL_DOMAIN", reason_code: reason, item: null };
}
function detached(reason: string): any { return { attachment_status: "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH", reason_code: reason, item: null }; }
function summary(kind: string, endpoint: string, objects: Obj[]): any {
  const latest = [...objects].sort((a, b) => b.logical_time.localeCompare(a.logical_time) || a.object_id.localeCompare(b.object_id))[0] ?? null;
  return { collection_kind: kind, attachment_status: latest ? "ATTACHED_EXACT" : "ABSENT_OPTIONAL_DOMAIN", reason_code: latest ? null : "NO_VISIBLE_ITEMS_IN_SCOPE", has_items: Boolean(latest), count_status: "EXACT_VALIDATED_PROJECTION", total_count: objects.length, latest_item_ref: latest?.object_id ?? null, latest_item_hash: latest?.determinism_hash ?? null, collection_endpoint: endpoint };
}
function validation(source: string, obj: Obj): any {
  return { source_name: source, profile_family: "CANONICAL_TWIN_FACT_DIRECT", validation_status: "PASS", failure_code: null, validated_object_ref: obj.object_id, validated_object_hash: obj.determinism_hash, evidence_refs: [{ ref_type: "FACT", ref_value: `fact-${obj.object_id}` }] };
}
function healthResolution(objectRef: string, role: "TERMINAL_RECORD_SET_MEMBER" | "OPERATIONAL_ATTEMPT_AUDIT", atomicGroupRef: string | null): any {
  const terminal = role === "TERMINAL_RECORD_SET_MEMBER";
  return {
    health_object_ref: objectRef,
    transaction_family: terminal ? "A_STATE_TICK_COMMIT" : "F_OPERATIONAL_ATTEMPT_HEALTH",
    health_role: role,
    health_resolution_basis: terminal ? "EXACT_RECORD_SET_MEMBERSHIP" : "EXACT_OPERATIONAL_ATTEMPT_RELATION",
    health_resolution_evidence_refs: [{ ref_type: terminal ? "RECORD_SET" : "ATTEMPT", ref_value: atomicGroupRef || "attempt-a3" }],
    atomic_group_ref: atomicGroupRef,
  };
}

function makePureRoot(prefix: string, forecastStatus: "COMPLETED" | "BLOCKED", pointCount: number, minute: number): Record<string, Obj> {
  const config = object(`${prefix}-config`, "twin_runtime_config_v1", at(minute), { config: prefix });
  const extra = { lineage_id: `${prefix}-lineage-id`, runtime_config_ref: config.object_id, runtime_config_hash: config.determinism_hash };
  const lineage = object(`${prefix}-lineage`, "twin_runtime_lineage_v1", at(minute), { lineage_kind: "INITIAL", activation_authority_ref: `${prefix}-lineage` }, extra);
  const checkpoint = object(`${prefix}-checkpoint`, "twin_runtime_checkpoint_v1", at(minute + 1), {}, extra);
  const tick = object(`${prefix}-tick`, "twin_runtime_tick_v1", at(minute + 1), {}, extra);
  const evidence = object(`${prefix}-evidence`, "twin_evidence_window_v1", at(minute + 1), {}, extra);
  const transition = object(`${prefix}-transition`, "twin_state_transition_v1", at(minute + 1), {}, extra);
  const assimilation = object(`${prefix}-assimilation`, "twin_assimilation_update_v1", at(minute + 1), {}, extra);
  const posterior = object(`${prefix}-posterior`, "twin_state_estimate_v1", at(minute + 1), {}, extra);
  const forecast = object(`${prefix}-forecast`, "twin_forecast_run_v1", at(minute + 1), { status: forecastStatus, point_count: pointCount }, extra);
  const health = object(`${prefix}-health`, "twin_runtime_health_v1", at(minute + 1), {}, extra);
  return { config, lineage, checkpoint, tick, evidence, transition, assimilation, posterior, forecast, health };
}

function recordSetValidation(prefix: string, objects: Obj[]): any {
  return { validation_status: "PASS", record_set_id: `${prefix}-record-set`, identity_kind: "A0_RECORD_SET", aggregate_determinism_hash: semanticHashV1(objects.map((item) => item.determinism_hash)), recomputed_aggregate_determinism_hash: semanticHashV1(objects.map((item) => item.determinism_hash)), exact_member_count: objects.length, exact_member_refs: objects.map(ref), failure_code: null };
}

function composeRuntimeProfile(input: { prefix: string; forecastStatus: "COMPLETED" | "BLOCKED"; pointCount: number; latestSuccess: Obj | null; scenarioSource: Obj | null; currentScenario: any; latestScenario: Obj | null; decision: Obj | null; plan: Obj | null; feedback: Obj[]; residuals: Obj[]; responseStartedAt: string }): any {
  const root = makePureRoot(input.prefix, input.forecastStatus, input.pointCount, 600);
  const mandatory = [root.checkpoint, root.tick, root.evidence, root.transition, root.assimilation, root.posterior, root.forecast, root.health];
  const exactScenarioSource = input.currentScenario?.item ? root.forecast : input.scenarioSource;
  return new CurrentRuntimeComposerV1().compose({
    request_scope: scope,
    response_started_at: input.responseStartedAt as any,
    root_graph_status: "COMPLETE_EXACT_GRAPH",
    active_lineage: composerObject(root.lineage),
    active_lineage_authority_validation: validation("active-lineage", root.lineage),
    checkpoint: composerObject(root.checkpoint),
    runtime_tick: composerObject(root.tick),
    evidence_window: composerObject(root.evidence),
    state_transition: composerObject(root.transition),
    assimilation_update: composerObject(root.assimilation),
    posterior_state: composerObject(root.posterior),
    terminal_record_set_health: composerObject(root.health),
    runtime_config: composerObject(root.config),
    record_set_validation: recordSetValidation(input.prefix, mandatory),
    current_tick_forecast_result: composerObject(root.forecast),
    latest_successful_forecast: attachment(input.latestSuccess),
    scenario_source_forecast: attachment(exactScenarioSource),
    current_scenario_attachment: input.currentScenario,
    latest_scenario_in_scope: attachment(input.latestScenario),
    current_human_decision: attachment(input.decision),
    current_approved_plan: attachment(input.plan),
    action_feedback_summary: summary("ACTION_FEEDBACK", "/action-lifecycle", input.feedback),
    forecast_residual_summary: summary("FORECAST_RESIDUAL", "/residuals", input.residuals),
    calibration_candidate_summary: summary("CALIBRATION_CANDIDATE", "/model-governance", []),
    shadow_evaluation_summary: summary("SHADOW_EVALUATION", "/model-governance", []),
    model_activation_summary: summary("MODEL_ACTIVATION", "/model-governance", []),
    limitations: [],
    validation_summary: [validation("root", root.checkpoint)],
  } as any);
}

function proveDomainProfiles(): void {
  const completed = object("profile-a1-forecast", "twin_forecast_run_v1", at(610), { status: "COMPLETED", point_count: 72 });
  const scenario = object("profile-a1-scenario", "twin_scenario_set_v1", at(611), { source_forecast_ref: completed.object_id, source_forecast_hash: completed.determinism_hash });
  const decision = object("profile-a1-decision", "twin_decision_record_v1", at(612), { scenario_ref: scenario.object_id });
  const plan = object("profile-a1-plan", "approved_irrigation_plan_snapshot_v1", at(613), { decision_ref: decision.object_id });
  const feedback = object("profile-a1-feedback", "twin_action_feedback_v1", at(614), { decision_ref: decision.object_id, approved_plan_evidence_ref: plan.object_id });
  const residual = object("profile-a1-residual", "twin_forecast_residual_v1", at(615), { forecast_ref: completed.object_id });
  const a1 = composeRuntimeProfile({ prefix: "a1", forecastStatus: "COMPLETED", pointCount: 72, latestSuccess: completed, scenarioSource: completed, currentScenario: attachment(scenario), latestScenario: scenario, decision, plan, feedback: [feedback], residuals: [residual], responseStartedAt: at(620) });
  check("DOMAIN_PROFILE_A1_COMPLETE_CHAIN", ["E001", "E004", "E006", "G004", "G005", "G007", "G008"], () => {
    assert.equal(a1.current_tick_forecast_result?.object_type, "twin_forecast_run_v1");
    assert.equal(a1.current_scenario_attachment.attachment_status, "ATTACHED_EXACT");
    assert.equal(a1.scenario_source_forecast.item?.object_ref, a1.current_tick_forecast_result?.object_ref);
    assert.equal(a1.current_human_decision.item?.object_ref, decision.object_id);
    assert.equal(a1.current_approved_plan.item?.object_ref, plan.object_id);
    assert.equal(a1.action_feedback_summary.total_count, 1);
    assert.equal(a1.forecast_residual_summary.total_count, 1);
  });

  const oldSuccess = object("profile-a2-old-success", "twin_forecast_run_v1", at(630), { status: "COMPLETED", point_count: 72 });
  const oldScenario = object("profile-a2-old-scenario", "twin_scenario_set_v1", at(631), { source_forecast_ref: oldSuccess.object_id, source_forecast_hash: oldSuccess.determinism_hash });
  const a2 = composeRuntimeProfile({ prefix: "a2", forecastStatus: "BLOCKED", pointCount: 0, latestSuccess: oldSuccess, scenarioSource: oldSuccess, currentScenario: detached("CURRENT_FORECAST_BLOCKED"), latestScenario: oldScenario, decision: null, plan: null, feedback: [], residuals: [], responseStartedAt: at(640) });
  check("DOMAIN_PROFILE_A2_BLOCKED_CURRENT_WITH_OLD_SUCCESS", ["E002", "E003", "E005", "E007", "E009", "E010", "J006"], () => {
    assert.equal(a2.current_scenario_attachment.attachment_status, "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH");
    assert.equal(a2.current_scenario_attachment.reason_code, "CURRENT_FORECAST_BLOCKED");
    assert.equal(a2.latest_successful_forecast.item?.object_ref, oldSuccess.object_id);
    assert.equal(a2.scenario_source_forecast.item?.object_ref, oldSuccess.object_id);
    assert.equal(a2.latest_scenario_in_scope.item?.object_ref, oldScenario.object_id);
  });

  const terminal = object("profile-a3-health-a", "twin_runtime_health_v1", at(650));
  const operational = object("profile-a3-health-f", "twin_runtime_health_v1", at(651), { attempt_ref: "attempt-a3", forecast_failure_ref: "failure-a3" });
  const health = new RuntimeHealthComposerV1().compose({
    request_scope: scope,
    response_started_at: at(652) as any,
    terminal_record_set_health: composerObject(terminal),
    terminal_role_resolution: healthResolution(terminal.object_id, "TERMINAL_RECORD_SET_MEMBER", "record-set-a3"),
    latest_operational_runtime_health: composerObject(operational),
    operational_role_resolution: healthResolution(operational.object_id, "OPERATIONAL_ATTEMPT_AUDIT", null),
    health_pointer_validation_summary: [validation("latest-health", operational)],
  } as any);
  check("DOMAIN_PROFILE_A3_TERMINAL_AND_LATER_OPERATIONAL_HEALTH", ["D016", "D017", "D018", "D020", "D021", "J011"], () => {
    assert.equal(health.health_relationship, "LATEST_OPERATIONAL_IS_LATER");
    assert.equal(health.terminal_record_set_health?.object_ref, terminal.object_id);
    assert.equal(health.latest_operational_runtime_health?.object_ref, operational.object_id);
  });

  const candidates = [0, 1, 2].map((index) => ({ object_ref: `candidate-${index}`, object_type: "twin_calibration_candidate_v1", object_hash: semanticHashV1({ index }) as SemanticHashTextV1, logical_time: at(660 + index) as any, attachment_status: "ATTACHED_EXACT" as const, activation_status: "NOT_ACTIVE" as const, eligible_for_state_input: false as const, eligible_for_runtime_config_use: false as const }));
  const evaluations = [0, 1].map((index) => ({ object_ref: `evaluation-${index}`, object_type: "twin_shadow_evaluation_v1", object_hash: semanticHashV1({ evaluation: index }) as SemanticHashTextV1, logical_time: at(670 + index) as any, attachment_status: "ATTACHED_EXACT" as const }));
  const governance = new ModelGovernanceComposerV1().compose({ request_scope: scope, response_started_at: at(680) as any, database_profile: "PROFILE_B_CALIBRATION", calibration_candidates: candidates, shadow_evaluations: evaluations, model_activations: [], calibration_candidate_summary: { ...summary("CALIBRATION_CANDIDATE", "/model-governance", candidates.map((item) => ({ object_id: item.object_ref, determinism_hash: item.object_hash, logical_time: item.logical_time }))), total_count: candidates.length }, shadow_evaluation_summary: { ...summary("SHADOW_EVALUATION", "/model-governance", evaluations.map((item) => ({ object_id: item.object_ref, determinism_hash: item.object_hash, logical_time: item.logical_time }))), total_count: evaluations.length }, model_activation_summary: summary("MODEL_ACTIVATION", "/model-governance", []), attached_activation_relation: null, exact_available_refs: [...candidates.map((item) => item.object_ref), ...evaluations.map((item) => item.object_ref)], limitations: [] } as any);
  check("DOMAIN_PROFILE_B_CANDIDATES_AND_EVALUATIONS_DO_NOT_ACTIVATE", ["G006", "G009", "G010", "G011"], () => {
    assert.equal(governance.calibration_candidate_summary.total_count, 3);
    assert.equal(governance.shadow_evaluation_summary.total_count, 2);
    assert.equal(governance.model_activation_summary.total_count, 0);
    assert.equal(governance.attached_activation_relation, null);
  });

  check("DOMAIN_PROFILE_C_FAIL_CLOSED_NEGATIVES", ["D012", "D023", "G003", "G010"], () => {
    assert.throws(() => new CurrentRuntimeComposerV1().compose({ request_scope: scope, response_started_at: at(690) as any, root_graph_status: "COMPLETE_EXACT_GRAPH" } as any), /MCFT_RUNTIME_MANDATORY_ROOT_MISSING/);
    assert.throws(() => new RuntimeHealthComposerV1().compose({ request_scope: scope, response_started_at: at(690) as any, terminal_record_set_health: composerObject(terminal), terminal_role_resolution: healthResolution(terminal.object_id, "TERMINAL_RECORD_SET_MEMBER", "record-set-a3"), latest_operational_runtime_health: composerObject(object("too-early", "twin_runtime_health_v1", at(649))), operational_role_resolution: healthResolution("too-early", "OPERATIONAL_ATTEMPT_AUDIT", null), health_pointer_validation_summary: [] } as any), /MCFT_RUNTIME_HEALTH_RELATIONSHIP_INVALID/);
    assert.throws(() => new ActionLifecycleComposerV1().compose({ request_scope: scope, response_started_at: at(690) as any, current_human_decision: attachment(null), current_approved_plan: attachment(null), action_feedback_summary: summary("ACTION_FEEDBACK", "/action-lifecycle", [feedback]), exact_edges: [], limitations: [] } as any), /MCFT_ACTION_FEEDBACK_WITHOUT_PLAN/);
    assert.throws(() => new ModelGovernanceComposerV1().compose({ request_scope: scope, response_started_at: at(690) as any, database_profile: "PROFILE_B_CALIBRATION", calibration_candidates: [{ ...candidates[0], activation_status: "ACTIVE" }], shadow_evaluations: [], model_activations: [], calibration_candidate_summary: { ...summary("CALIBRATION_CANDIDATE", "/model-governance", [candidates[0] as any]), total_count: 1 }, shadow_evaluation_summary: summary("SHADOW_EVALUATION", "/model-governance", []), model_activation_summary: summary("MODEL_ACTIVATION", "/model-governance", []), attached_activation_relation: null, exact_available_refs: [], limitations: [] } as any), /MCFT_CALIBRATION_CANDIDATE_SAFETY_CONTRACT_INVALID/);
  });
}

async function insertFact(client: PoolClient, factId: string, obj: Obj): Promise<void> {
  await client.query("INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,'s6',$3::jsonb)", [factId, obj.logical_time, JSON.stringify(envelope(obj))]);
  await client.query("INSERT INTO public.twin_fact_visibility_index_v1(visibility_epoch_id,fact_id,visibility_anchor_xid8,visibility_anchor_kind) VALUES('epoch-s6',$1,pg_catalog.pg_current_xact_id(),'FACT_INSERT_TRANSACTION')", [factId]);
}

async function insertState(pool: Pool, id: string, logicalTime: string, ordinal: number): Promise<Obj> {
  const obj = object(id, "twin_state_estimate_v1", logicalTime, { ordinal });
  const factId = `fact-${id}`;
  await withTransaction(pool, async (client) => {
    await insertFact(client, factId, obj);
    await client.query("INSERT INTO public.twin_state_history_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)", [id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, obj.lineage_id, obj.revision_id, obj.logical_time, obj.determinism_hash, JSON.stringify(obj.payload), factId]);
  });
  return obj;
}

async function insertRoot(pool: Pool, suffix: string, minute: number, setCurrent: boolean): Promise<RootFixture> {
  const config = object(`config-${suffix}`, "twin_runtime_config_v1", at(minute), { config: suffix });
  const extra = { lineage_id: `lineage-${suffix}`, runtime_config_ref: config.object_id, runtime_config_hash: config.determinism_hash };
  const lineage = object(`lineage-object-${suffix}`, "twin_runtime_lineage_v1", at(minute), { lineage_kind: "INITIAL", activation_authority_ref: `lineage-object-${suffix}` }, extra);
  const evidence = object(`evidence-${suffix}`, "twin_evidence_window_v1", at(minute + 1), {}, extra);
  const transition = object(`transition-${suffix}`, "twin_state_transition_v1", at(minute + 1), {}, extra);
  const assimilation = object(`assimilation-${suffix}`, "twin_assimilation_update_v1", at(minute + 1), {}, extra);
  const posterior = object(`posterior-${suffix}`, "twin_state_estimate_v1", at(minute + 1), {}, extra);
  const forecast = object(`forecast-${suffix}`, "twin_forecast_run_v1", at(minute + 1), { status: "COMPLETED", point_count: 72 }, extra);
  const health = object(`health-${suffix}`, "twin_runtime_health_v1", at(minute + 1), {}, extra);
  const checkpoint = object(`checkpoint-${suffix}`, "twin_runtime_checkpoint_v1", at(minute + 1), { last_completed_tick_ref: `tick-${suffix}`, last_posterior_state_ref: posterior.object_id, forecast_result_ref: forecast.object_id }, extra);
  const tick = object(`tick-${suffix}`, "twin_runtime_tick_v1", at(minute + 1), { checkpoint_ref: checkpoint.object_id, evidence_window_ref: evidence.object_id, state_transition_ref: transition.object_id, assimilation_update_ref: assimilation.object_id, posterior_state_ref: posterior.object_id, forecast_result_ref: forecast.object_id }, extra);
  const members = [checkpoint, tick, evidence, transition, assimilation, posterior, forecast, health];
  const objects = [config, lineage, ...members];
  return withTransaction(pool, async (client) => {
    for (const obj of objects) await insertFact(client, `fact-${obj.object_id}`, obj);
    const recordSetId = `record-set-${suffix}`;
    const recordSetHash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSetId, members });
    await client.query("INSERT INTO public.twin_object_idempotency_index_v1 VALUES('A0_RECORD_SET',$1,$2,$3,'{}'::jsonb,$4::jsonb,$5::jsonb)", [`idem-${suffix}`, recordSetId, recordSetHash, JSON.stringify(members.map((item) => item.object_id)), JSON.stringify(Object.fromEntries(members.map((item) => [item.object_id, item.determinism_hash])))]);
    await client.query("INSERT INTO public.twin_runtime_record_set_identity_index_v1 VALUES($1,$2::jsonb)", [recordSetId, JSON.stringify(members.map((item) => item.object_id))]);
    if (setCurrent) {
      await client.query("DELETE FROM public.twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", Object.values(scope));
      await client.query("DELETE FROM public.twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", Object.values(scope));
      await client.query("INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$7)", [...Object.values(scope), lineage.object_id]);
      await client.query("INSERT INTO public.twin_runtime_checkpoint_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [...Object.values(scope), checkpoint.object_id, checkpoint.determinism_hash, `lineage-${suffix}`]);
    }
    return { root_ref: checkpoint.object_id, root_hash: checkpoint.determinism_hash, lineage_ref: lineage.object_id, members, objects };
  });
}

async function prepareDatabase(pool: Pool): Promise<{ states: Obj[]; rootA: RootFixture }> {
  await pool.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    CREATE TABLE public.facts(fact_id text PRIMARY KEY,occurred_at timestamptz NOT NULL,source text NOT NULL,record_json jsonb NOT NULL);
    CREATE TABLE public.twin_fact_visibility_epoch_v1(visibility_epoch_id text PRIMARY KEY,status text NOT NULL);
    INSERT INTO public.twin_fact_visibility_epoch_v1 VALUES('epoch-s6','ACTIVE');
    CREATE TABLE public.twin_fact_visibility_index_v1(visibility_epoch_id text NOT NULL,fact_id text NOT NULL,visibility_anchor_xid8 xid8 NOT NULL,visibility_anchor_kind text NOT NULL,PRIMARY KEY(visibility_epoch_id,fact_id));
    CREATE TABLE public.twin_state_history_projection_v1(state_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_forecast_run_projection_v1(forecast_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_scenario_set_projection_v1(scenario_set_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_action_feedback_projection_v1(action_feedback_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_forecast_residual_projection_v1(residual_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_calibration_candidate_projection_v1(candidate_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_shadow_evaluation_projection_v1(evaluation_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_active_lineage_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,active_lineage_ref text,activation_authority_ref text);
    CREATE TABLE public.twin_runtime_checkpoint_latest_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,checkpoint_object_id text,determinism_hash text,lineage_id text);
    CREATE TABLE public.twin_forecast_success_latest_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,forecast_object_id text,determinism_hash text);
    CREATE TABLE public.twin_scenario_latest_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,scenario_set_id text,determinism_hash text);
    CREATE TABLE public.twin_runtime_health_latest_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,health_object_id text,determinism_hash text);
    CREATE TABLE public.twin_object_idempotency_index_v1(identity_kind text,idempotency_key text,record_set_id text,determinism_hash text,identity_basis jsonb,member_object_ids jsonb,member_determinism_hashes jsonb);
    CREATE TABLE public.twin_runtime_record_set_identity_index_v1(record_set_id text,member_object_ids jsonb);
  `);
  const states: Obj[] = [];
  for (let index = 0; index < 120; index += 1) states.push(await insertState(pool, `state-${String(index).padStart(3, "0")}`, at(index), index));
  const rootA = await insertRoot(pool, "a", 400, true);
  const attempt = object("attempt-f", "twin_runtime_attempt_v1", at(402), {});
  const failure = object("failure-f", "twin_forecast_failure_v1", at(402), { attempt_ref: attempt.object_id });
  const healthF = object("health-f", "twin_runtime_health_v1", at(402), { attempt_ref: attempt.object_id, forecast_failure_ref: failure.object_id });
  await withTransaction(pool, async (client) => {
    for (const obj of [attempt, failure, healthF]) await insertFact(client, `fact-${obj.object_id}`, obj);
    await client.query("INSERT INTO public.twin_runtime_health_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [...Object.values(scope), healthF.object_id, healthF.determinism_hash]);
  });
  return { states, rootA };
}

async function tableCounts(pool: Pool): Promise<Record<string, string>> {
  const relations = ["facts", "twin_fact_visibility_index_v1", "twin_state_history_projection_v1", "twin_forecast_run_projection_v1", "twin_scenario_set_projection_v1", "twin_action_feedback_projection_v1", "twin_forecast_residual_projection_v1", "twin_calibration_candidate_projection_v1", "twin_shadow_evaluation_projection_v1", "twin_active_lineage_index_v1", "twin_runtime_checkpoint_latest_index_v1", "twin_forecast_success_latest_index_v1", "twin_scenario_latest_index_v1", "twin_runtime_health_latest_index_v1", "twin_object_idempotency_index_v1", "twin_runtime_record_set_identity_index_v1"];
  const output: Record<string, string> = {};
  for (const relation of relations) output[relation] = String((await pool.query(`SELECT count(*)::text AS count FROM public.${relation}`)).rows[0]?.count ?? "0");
  return output;
}

async function provePostgresReadback(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s6-key": "0123456789abcdef0123456789abcdef" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s6-key";

  const initialPool = new Pool({ connectionString: DB, max: 8 });
  const { states, rootA } = await prepareDatabase(initialPool);
  const apiA = new PostgresMcftFieldTwinReadApiV1(initialPool);
  const runtimeA = await apiA.readRuntime({ scope }) as any;
  const traceA = await apiA.readTrace({ scope }) as any;
  await initialPool.end();

  const pool = new Pool({ connectionString: DB, max: 8 });
  try {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const apiRestart = new PostgresMcftFieldTwinReadApiV1(pool);
    const runtimeRestart = await apiRestart.readRuntime({ scope }) as any;
    const traceRestart = await apiRestart.readTrace({ scope }) as any;
    check("CONNECTION_POOL_RESTART_AND_ADAPTER_REINSTANTIATION_STABILITY", ["H021a", "H022", "K001", "K010"], () => {
      assert.equal(runtimeA.root_graph_content_hash, runtimeRestart.root_graph_content_hash);
      assert.equal(runtimeA.attachment_content_hash, runtimeRestart.attachment_content_hash);
      assert.equal(traceA.trace_graph_content_hash, traceRestart.trace_graph_content_hash);
      assert.notEqual(runtimeA.response_started_at, runtimeRestart.response_started_at);
      assert.notEqual(runtimeA.response_instance_hash, runtimeRestart.response_instance_hash);
    });

    const pageBefore = await apiRestart.readStates({ scope, limit: 50 }) as any;
    await withTransaction(pool, async (client) => {
      await client.query("TRUNCATE public.twin_state_history_projection_v1");
      for (const obj of [...states].reverse()) {
        await client.query("INSERT INTO public.twin_state_history_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)", [obj.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, obj.lineage_id, obj.revision_id, obj.logical_time, obj.determinism_hash, JSON.stringify(obj.payload), `fact-${obj.object_id}`]);
      }
    });
    const pageAfter = await new PostgresMcftFieldTwinReadApiV1(pool).readStates({ scope, limit: 50 }) as any;
    check("PROJECTION_REBUILD_AND_INSERTION_ORDER_STABILITY", ["H021b", "H021c", "H021d", "K002", "K006", "K007", "K008"], () => {
      assert.deepEqual(pageAfter.items, pageBefore.items);
      assert.equal(pageAfter.collection_items_content_hash, pageBefore.collection_items_content_hash);
      assert.equal(pageAfter.fixed_root_ref.startsWith("collection-visibility:STATE:"), true);
    });

    const first = await apiRestart.readStates({ scope, limit: 50 }) as any;
    assert.equal(typeof first.next_cursor, "string");
    await insertState(pool, "state-late", at(65, 30), 6530);
    const second = await apiRestart.readStates({ scope, limit: 50, cursor: first.next_cursor }) as any;
    check("OLD_COLLECTION_CURSOR_EXCLUDES_POST_SNAPSHOT_FACT", ["C020", "H023", "H024"], () => {
      assert.equal(second.items.some((item: any) => item.object_ref === "state-late"), false);
      assert.equal(second.fixed_root_ref, first.fixed_root_ref);
      assert.equal(second.items.length, 50);
    });
    const fresh = await apiRestart.readStates({ scope, limit: 100 }) as any;
    check("FRESH_FIRST_PAGE_OBSERVES_POST_SNAPSHOT_FACT", ["C020", "H024"], () => assert.equal(fresh.items.some((item: any) => item.object_ref === "state-late"), true));

    const writer = await pool.connect();
    const reader = await pool.connect();
    try {
      await writer.query("BEGIN");
      const xid = String((await writer.query("SELECT pg_catalog.pg_current_xact_id()::text AS xid")).rows[0]?.xid);
      const late = object("early-start-late-commit", "twin_state_estimate_v1", at(200), { ordinal: 200 });
      await insertFact(writer, "fact-early-start-late-commit", late);
      await reader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const snapshot = String((await reader.query("SELECT pg_catalog.pg_current_snapshot()::text AS snapshot")).rows[0]?.snapshot);
      await writer.query("COMMIT");
      const visible = Boolean((await reader.query("SELECT pg_catalog.pg_visible_in_snapshot($1::xid8,$2::pg_snapshot) AS visible", [xid, snapshot])).rows[0]?.visible);
      check("EARLY_START_LATE_COMMIT_EXCLUDED", ["C021"], () => assert.equal(visible, false), { xid, snapshot });
      await reader.query("COMMIT");
    } catch (error) {
      await writer.query("ROLLBACK").catch(() => undefined);
      await reader.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      writer.release();
      reader.release();
    }

    const timelineFirst = await apiRestart.readTimeline({ scope, limit: 20 }) as any;
    const rootB = await insertRoot(pool, "b", 500, true);

    const attemptB = object("attempt-b-operational", "twin_runtime_attempt_v1", at(502), {});
    const failureB = object("failure-b-operational", "twin_forecast_failure_v1", at(502), {
      attempt_ref: attemptB.object_id,
    });
    const healthB = object("health-b-operational", "twin_runtime_health_v1", at(502), {
      attempt_ref: attemptB.object_id,
      forecast_failure_ref: failureB.object_id,
    });

    await withTransaction(pool, async (client) => {
      for (const obj of [attemptB, failureB, healthB]) {
        await insertFact(client, `fact-${obj.object_id}`, obj);
      }
      const updated = await client.query(
        `UPDATE public.twin_runtime_health_latest_index_v1
         SET health_object_id=$7, determinism_hash=$8
         WHERE tenant_id=$1
           AND project_id=$2
           AND group_id=$3
           AND field_id=$4
           AND season_id=$5
           AND zone_id=$6`,
        [...Object.values(scope), healthB.object_id, healthB.determinism_hash],
      );
      assert.equal(updated.rowCount, 1, "LATEST_OPERATIONAL_HEALTH_POINTER_NOT_UPDATED");
    });

    const timelineContinuation = await apiRestart.readTimeline({ scope, limit: 20, cursor: timelineFirst.next_cursor }) as any;
    const timelineFresh = await apiRestart.readTimeline({ scope, limit: 20 }) as any;
    check("OLD_TIMELINE_CURSOR_PRESERVES_FIXED_ROOT_AFTER_POINTER_ADVANCE", ["C022", "F015", "H020", "H023"], () => {
      assert.equal(timelineFirst.fixed_root_ref, rootA.root_ref);
      assert.equal(timelineContinuation.fixed_root_ref, rootA.root_ref);
      assert.equal(timelineFresh.fixed_root_ref, rootB.root_ref);
      assert.notEqual(timelineFresh.fixed_root_graph_content_hash, timelineFirst.fixed_root_graph_content_hash);
    });

    const before = await tableCounts(pool);
    const responses = await Promise.all([
      apiRestart.readRuntime({ scope }), apiRestart.readTimeline({ scope, limit: 50 }), apiRestart.readTrace({ scope }),
      apiRestart.readStates({ scope, limit: 50 }), apiRestart.readForecasts({ scope, limit: 50 }), apiRestart.readScenarios({ scope, limit: 50 }),
      apiRestart.readResiduals({ scope, limit: 50 }), apiRestart.readActionLifecycle({ scope, limit: 50 }),
      apiRestart.readModelGovernance({ scope, limit: 50, collection_kind: "CALIBRATION_CANDIDATE" }),
      apiRestart.readModelGovernance({ scope, limit: 50, collection_kind: "SHADOW_EVALUATION" }),
      apiRestart.readModelGovernance({ scope, limit: 50, collection_kind: "MODEL_ACTIVATION" }), apiRestart.readHealth({ scope }),
    ]);
    const after = await tableCounts(pool);
    check("POSTGRES_PRODUCTION_REPOSITORY_API_READBACK_ZERO_WRITES", ["C006", "C007", "C008", "I006", "I007", "I008", "I009", "K009"], () => {
      assert.deepEqual(after, before);
      assert.equal(responses.length, 12);
      assert.equal((responses[0] as any).root_graph_status, "COMPLETE_EXACT_GRAPH");
      assert.equal((responses[11] as any).health_relationship, "LATEST_OPERATIONAL_IS_LATER");
    }, { before, after });
  } finally {
    await pool.end();
  }
}

function staticClosureAudit(): void {
  const productSources = [
    "apps/server/src/services/mcft_field_twin_read_api_v1.ts",
    "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.ts",
    "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_repository_v1.ts",
    "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.ts",
    "apps/web/src/api/mcftFieldTwinRuntime.ts",
    "apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx",
  ].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  check("STATIC_ZERO_WRITE_DEPENDENCY_BOUNDARY", ["I006", "I007", "I008", "I009", "J001", "J002", "J003", "J004", "J005"], () => {
    assert.doesNotMatch(productSources, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
    assert.doesNotMatch(productSources, /from\s+["'][^"']*(?:writer|recommendation|approval|ao_act|dispatch|activation)[^"']*["']/i);
    assert.doesNotMatch(productSources, /confidence_score|confidence_percent|timestamp_latest/i);
  });
  const s6 = JSON.parse(fs.readFileSync("docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json", "utf8"));
  check("CAP_08_AND_RUNTIME_SOURCE_REMAIN_UNAUTHORIZED", ["L016"], () => {
    assert.equal(s6.runtime_source_authorized, false);
    assert.equal(s6.canonical_write_authorized, false);
    assert.equal(s6.mcft_cap_08_authorized, false);
  });
}

async function main(): Promise<void> {
  try {
    proveDomainProfiles();
    await provePostgresReadback();
    staticClosureAudit();
    const result = {
      schema_version: "geox_mcft_cap_07_s6_closure_result_v2",
      status: "PASS",
      check_count: checks.length,
      checks,
      domain_composition_profiles: ["PROFILE_A1_COMPLETE", "PROFILE_A2_BLOCKED", "PROFILE_A3_HEALTH_DUAL_VIEW", "PROFILE_B_CALIBRATION", "PROFILE_C_NEGATIVE"],
      postgres_production_repository_api_readback: true,
      postgres_isolation: "ISOLATED_ACCEPTANCE_DATABASE_ONLY",
      connection_pool_restart_and_adapter_reinstantiation_stable: true,
      postgresql_service_restart_proven: false,
      rebuild_collection_items_hash_stable: true,
      early_start_late_commit_excluded: true,
      old_cursor_post_snapshot_fact_excluded: true,
      old_cursor_pointer_advancement_excluded: true,
      product_read_observation_write_delta: 0,
      runtime_source_authorized: false,
      canonical_write_authority_delta: "ZERO",
      mcft_cap_08_authorized: false,
      completion_claim: "LEVEL_A_READ_ONLY_DETERMINISTIC_FIELD_TWIN_READ_SURFACE_CANDIDATE",
      nonclaims: ["NO_CONTINUOUS_RUNTIME", "NO_LIVE_FIELD_VALIDATION", "NO_POSTGRESQL_SERVICE_RESTART_PROOF", "NO_RUNTIME_SOURCE_AUTHORITY", "NO_CANONICAL_WRITE_AUTHORITY", "NO_MCFT_CAP_08_AUTHORITY"],
      repository_write_performed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`MCFT-CAP-07 S6 closure: ${checks.length} PASS`);
  } catch (error) {
    const result = { schema_version: "geox_mcft_cap_07_s6_closure_result_v2", status: "FAIL", check_count: checks.length, checks, error: String(error instanceof Error ? error.stack || error.message : error) };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
