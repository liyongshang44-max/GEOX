// Purpose: prove S4 production PostgreSQL read semantics: root-independent collections, exact roots, SQL keyset Timeline, Replay Evidence, Health roles, optional attachments, and strict auth.
// Boundary: isolated PostgreSQL fixture only; application code under test remains SELECT-only and all fixture writes occur outside Runtime read transactions.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import {
  computeA0RecordSetDeterminismHashV1,
  computeMemberDeterminismHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import type { FieldTwinScopeV1 } from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { authorizeMcftFieldTwinReadV1 } from "../../apps/server/src/auth/mcft_field_twin_read_authz_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";
import { PostgresFieldTwinProjectionReadRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S4_POSTGRES_API_RESULT.json");
const databaseUrl = String(process.env.MCFT_S4_TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const scope: FieldTwinScopeV1 = Object.freeze({ tenant_id: "tenant-s4", project_id: "project-s4", group_id: "group-s4", field_id: "field-s4", season_id: "season-s4", zone_id: "zone-s4" });
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = async (name: string, action: () => Promise<void> | void) => { await action(); checks.push({ name, status: "PASS" }); };
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json"), "utf8"));
const now = (minute: number) => new Date(Date.UTC(2026, 6, 20, 0, minute, 0, 0)).toISOString();

type JsonRecord = Record<string, unknown>;
type CanonicalObject = JsonRecord & { object_id: string; object_type: string; determinism_hash: string; payload: JsonRecord };
type Fact = { fact_id: string; record_json: JsonRecord; occurred_at: string };

function readPath(root: unknown, dotted: string): unknown {
  let value: unknown = root;
  for (const key of dotted.split(".").filter(Boolean)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as JsonRecord)[key];
  }
  return value;
}

function canonicalObject(input: {
  object_id: string;
  object_type: string;
  logical_time: string;
  payload?: JsonRecord;
  lineage_id?: string | null;
  revision_id?: string | null;
  runtime_config_ref?: string;
  runtime_config_hash?: string;
  context?: boolean;
}): CanonicalObject {
  const base: JsonRecord = {
    object_id: input.object_id,
    object_type: input.object_type,
    schema_version: "v1",
    ...scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [],
    evidence_refs: [],
    ...(input.runtime_config_ref ? { runtime_config_ref: input.runtime_config_ref } : {}),
    ...(input.runtime_config_hash ? { runtime_config_hash: input.runtime_config_hash } : {}),
    idempotency_key: `idem:${input.object_id}`,
    limitations: [],
    created_at: input.logical_time,
    ...(input.context
      ? { context_lineage_ref: input.lineage_id ?? "lineage-s4", context_revision_ref: input.revision_id ?? "revision-s4" }
      : { lineage_id: input.lineage_id ?? "lineage-s4", revision_id: input.revision_id ?? "revision-s4" }),
    payload: input.payload ?? {},
  };
  return { ...base, determinism_hash: computeMemberDeterminismHashV1(base) } as CanonicalObject;
}

function canonicalFact(object: CanonicalObject): Fact {
  return { fact_id: `fact:${object.object_id}`, occurred_at: String(object.logical_time), record_json: { type: object.object_type, payload: object } };
}

function replayPlanFact(planId: string, availableAt: string): Fact {
  const canonicalPayload = { plan_id: planId, target: scope, amount_mm: "15.000000" };
  const semantic: JsonRecord = {
    source_record_id: planId,
    available_to_runtime_at: availableAt,
    evidence_identity_key: `plan:${planId}`,
    source_payload: canonicalPayload,
    canonical_payload: canonicalPayload,
    ...scope,
  };
  const payload = { ...semantic, source_record_hash: semanticHashV1(semantic) };
  return { fact_id: `fact:${planId}`, occurred_at: availableAt, record_json: { type: "approved_irrigation_plan_snapshot_v1", payload } };
}

function projectionMatrixRow(sourceName: string): JsonRecord {
  const rows = matrix.rows.filter((row: JsonRecord) => row.source_name === sourceName);
  assert.equal(rows.length, 1, sourceName);
  return rows[0] as JsonRecord;
}

function projectionRow(sourceName: string, fact: Fact, object: CanonicalObject): JsonRecord {
  const obligation = projectionMatrixRow(sourceName);
  const context = { record_json: fact.record_json, facts: { fact_id: fact.fact_id } };
  const row: JsonRecord = {};
  for (const comparison of obligation.required_column_comparisons as JsonRecord[]) {
    row[String(comparison.projection_column)] = readPath(context, String(comparison.canonical_path));
  }
  for (const column of obligation.available_projection_columns as string[]) {
    if (column in row) continue;
    if (column in object) row[column] = object[column];
    else if (column in object.payload) row[column] = object.payload[column];
    else row[column] = null;
  }
  return row;
}

function sqlType(column: string): string {
  if (["logical_time", "as_of", "execution_start", "execution_end", "available_to_runtime_at", "decided_at"].includes(column)) return "timestamptz";
  if (["canonical_payload", "target_scope", "member_object_ids", "member_determinism_hashes", "identity_basis"].includes(column)) return "jsonb";
  if (column === "active_for_decision" || column.startsWith("eligible_") || column === "revoked") return "boolean";
  if (column.endsWith("_count") || column === "event_rank") return "integer";
  return "text";
}

async function createProjectionTable(client: PoolClient, sourceName: string): Promise<void> {
  const obligation = projectionMatrixRow(sourceName);
  const table = sourceName.replace(/^public\./, "");
  const columns = [...new Set(obligation.available_projection_columns as string[])];
  await client.query(`CREATE TABLE public.${table} (${columns.map((column) => `${column} ${sqlType(column)}`).join(",")})`);
}

async function insertProjection(client: PoolClient, sourceName: string, row: JsonRecord): Promise<void> {
  const table = sourceName.replace(/^public\./, "");
  const columns = Object.keys(row);
  const values = columns.map((column) => sqlType(column) === "jsonb" && row[column] !== null ? JSON.stringify(row[column]) : row[column]);
  await client.query(`INSERT INTO public.${table} (${columns.join(",")}) VALUES (${columns.map((_, index) => `$${index + 1}${sqlType(columns[index]) === "jsonb" ? "::jsonb" : ""}`).join(",")})`, values);
}

async function resetSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    const drop = [
      "twin_action_feedback_projection_v1", "twin_decision_record_projection_v1", "twin_scenario_set_projection_v1", "twin_forecast_run_projection_v1", "twin_state_history_projection_v1",
      "twin_forecast_residual_projection_v1", "twin_calibration_candidate_projection_v1", "twin_shadow_evaluation_projection_v1", "twin_approved_plan_binding_projection_v1",
      "twin_active_lineage_index_v1", "twin_runtime_checkpoint_latest_index_v1", "twin_forecast_success_latest_index_v1", "twin_scenario_latest_index_v1", "twin_runtime_health_latest_index_v1",
      "twin_object_idempotency_index_v1", "twin_fact_visibility_index_v1", "twin_fact_visibility_epoch_v1", "facts",
    ];
    for (const table of drop) await client.query(`DROP TABLE IF EXISTS public.${table} CASCADE`);
    await client.query(`CREATE TABLE public.facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp())`);
    await client.query(`CREATE TABLE public.twin_fact_visibility_epoch_v1 (visibility_epoch_id text PRIMARY KEY, status text NOT NULL)`);
    await client.query(`CREATE TABLE public.twin_fact_visibility_index_v1 (fact_id text PRIMARY KEY, visibility_epoch_id text NOT NULL, visibility_anchor_xid8 xid8 NOT NULL, visibility_anchor_kind text NOT NULL)`);
    await client.query(`INSERT INTO public.twin_fact_visibility_epoch_v1 VALUES ('epoch-s4','ACTIVE')`);
    for (const sourceName of [
      "public.twin_state_history_projection_v1", "public.twin_forecast_run_projection_v1", "public.twin_scenario_set_projection_v1", "public.twin_decision_record_projection_v1", "public.twin_action_feedback_projection_v1", "public.twin_forecast_residual_projection_v1", "public.twin_calibration_candidate_projection_v1", "public.twin_shadow_evaluation_projection_v1",
    ]) await createProjectionTable(client, sourceName);
    await client.query(`CREATE TABLE public.twin_approved_plan_binding_projection_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,decision_request_ref text,decision_request_hash text,selected_option_ref text,selected_option_hash text,approved_plan_evidence_ref text,approved_plan_evidence_hash text,active_for_decision boolean)`);
    await client.query(`CREATE TABLE public.twin_active_lineage_index_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,active_lineage_ref text,activation_authority_ref text)`);
    await client.query(`CREATE TABLE public.twin_runtime_checkpoint_latest_index_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,checkpoint_object_id text,determinism_hash text,lineage_id text)`);
    await client.query(`CREATE TABLE public.twin_forecast_success_latest_index_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,forecast_object_id text,determinism_hash text)`);
    await client.query(`CREATE TABLE public.twin_scenario_latest_index_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,scenario_set_id text,determinism_hash text)`);
    await client.query(`CREATE TABLE public.twin_runtime_health_latest_index_v1 (tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,health_object_id text,determinism_hash text)`);
    await client.query(`CREATE TABLE public.twin_object_idempotency_index_v1 (identity_kind text,idempotency_key text,record_set_id text,determinism_hash text,identity_basis jsonb,member_object_ids jsonb,member_determinism_hashes jsonb)`);
  } finally { client.release(); }
}

async function persistFacts(facts: readonly Fact[]): Promise<void> {
  if (facts.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const anchor = String((await client.query<{ xid: string }>("SELECT pg_catalog.pg_current_xact_id()::text AS xid")).rows[0].xid);
    for (const fact of facts) {
      await client.query(`INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,'s4-postgres-acceptance',$3::jsonb)`, [fact.fact_id, fact.occurred_at, JSON.stringify(fact.record_json)]);
      await client.query(`INSERT INTO public.twin_fact_visibility_index_v1 VALUES($1,'epoch-s4',$2::xid8,'FACT_INSERT_TRANSACTION')`, [fact.fact_id, anchor]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function seedStateHistory(count: number): Promise<CanonicalObject[]> {
  const objects: CanonicalObject[] = [];
  const facts: Fact[] = [];
  for (let index = 0; index < count; index += 1) {
    const object = canonicalObject({ object_id: `state-${String(index).padStart(3, "0")}`, object_type: "twin_state_estimate_v1", logical_time: now(index), payload: { sequence: index } });
    objects.push(object); facts.push(canonicalFact(object));
  }
  await persistFacts(facts);
  const client = await pool.connect();
  try {
    for (let index = 0; index < objects.length; index += 1) await insertProjection(client, "public.twin_state_history_projection_v1", projectionRow("public.twin_state_history_projection_v1", facts[index], objects[index]));
  } finally { client.release(); }
  return objects;
}

async function seedRuntimeRoot(posterior: CanonicalObject): Promise<{ currentForecast: CanonicalObject; oldForecast: CanonicalObject; oldScenario: CanonicalObject; terminalHealth: CanonicalObject; operationalHealth: CanonicalObject }> {
  const config = canonicalObject({ object_id: "config-s4", object_type: "twin_runtime_config_v1", logical_time: now(400), payload: { config: "s4" } });
  const common = { runtime_config_ref: config.object_id, runtime_config_hash: config.determinism_hash, lineage_id: "lineage-s4", revision_id: "revision-s4" };
  const lineage = canonicalObject({ object_id: "lineage-object-s4", object_type: "twin_runtime_lineage_v1", logical_time: now(401), payload: { lineage_kind: "INITIAL", activation_authority_ref: "lineage-object-s4" }, ...common });
  const evidence = canonicalObject({ object_id: "evidence-s4", object_type: "twin_evidence_window_v1", logical_time: now(402), payload: {}, ...common });
  const transition = canonicalObject({ object_id: "transition-s4", object_type: "twin_state_transition_v1", logical_time: now(403), payload: {}, ...common });
  const assimilation = canonicalObject({ object_id: "assimilation-s4", object_type: "twin_assimilation_update_v1", logical_time: now(404), payload: {}, ...common });
  posterior.runtime_config_ref = config.object_id; posterior.runtime_config_hash = config.determinism_hash; posterior.lineage_id = "lineage-s4"; posterior.revision_id = "revision-s4"; posterior.determinism_hash = computeMemberDeterminismHashV1(posterior);
  const currentForecast = canonicalObject({ object_id: "forecast-current-blocked", object_type: "twin_forecast_run_v1", logical_time: now(405), payload: { status: "BLOCKED", source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash }, ...common });
  const terminalHealth = canonicalObject({ object_id: "health-terminal-s4", object_type: "twin_runtime_health_v1", logical_time: now(406), payload: { status: "PASS" }, ...common });
  const checkpoint = canonicalObject({ object_id: "checkpoint-s4", object_type: "twin_runtime_checkpoint_v1", logical_time: now(407), payload: { last_completed_tick_ref: "tick-s4", last_posterior_state_ref: posterior.object_id, forecast_result_ref: currentForecast.object_id }, ...common });
  const tick = canonicalObject({ object_id: "tick-s4", object_type: "twin_runtime_tick_v1", logical_time: now(408), payload: { checkpoint_ref: checkpoint.object_id, evidence_window_ref: evidence.object_id, state_transition_ref: transition.object_id, assimilation_update_ref: assimilation.object_id, posterior_state_ref: posterior.object_id, forecast_result_ref: currentForecast.object_id }, ...common });
  const members = [lineage, evidence, transition, assimilation, posterior, currentForecast, tick, checkpoint, terminalHealth];
  const recordSetId = "record-set-s4";
  const recordSetHash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSetId, members });
  const oldForecast = canonicalObject({ object_id: "forecast-old-success", object_type: "twin_forecast_run_v1", logical_time: now(350), payload: { status: "SUCCEEDED", source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash }, ...common });
  const oldScenario = canonicalObject({ object_id: "scenario-old", object_type: "twin_scenario_set_v1", logical_time: now(351), payload: { source_forecast_ref: oldForecast.object_id, source_forecast_hash: oldForecast.determinism_hash, source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash, scenario_policy_id: "policy-s4", option_count: 1 }, ...common });
  const attempt = canonicalObject({ object_id: "attempt-operational-s4", object_type: "twin_runtime_attempt_v1", logical_time: now(409), payload: {}, ...common });
  const operationalHealth = canonicalObject({ object_id: "health-operational-s4", object_type: "twin_runtime_health_v1", logical_time: now(410), payload: { attempt_ref: attempt.object_id, status: "FAIL" }, ...common });
  const rootFacts = [config, ...members, oldForecast, oldScenario, attempt, operationalHealth].map(canonicalFact);
  await persistFacts(rootFacts);
  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO public.twin_object_idempotency_index_v1 VALUES('A0_RECORD_SET','idem-record-set',$1,$2,NULL,$3::jsonb,$4::jsonb)`, [recordSetId, recordSetHash, JSON.stringify(members.map((member) => member.object_id)), JSON.stringify(Object.fromEntries(members.map((member) => [member.object_id, member.determinism_hash])))]);
    await client.query(`INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [...Object.values(scope), lineage.object_id]);
    await client.query(`INSERT INTO public.twin_runtime_checkpoint_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...Object.values(scope), checkpoint.object_id, checkpoint.determinism_hash, "lineage-s4"]);
    await client.query(`INSERT INTO public.twin_forecast_success_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), oldForecast.object_id, oldForecast.determinism_hash]);
    await client.query(`INSERT INTO public.twin_scenario_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), oldScenario.object_id, oldScenario.determinism_hash]);
    await client.query(`INSERT INTO public.twin_runtime_health_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), operationalHealth.object_id, operationalHealth.determinism_hash]);
    await insertProjection(client, "public.twin_forecast_run_projection_v1", projectionRow("public.twin_forecast_run_projection_v1", canonicalFact(oldForecast), oldForecast));
    await insertProjection(client, "public.twin_scenario_set_projection_v1", projectionRow("public.twin_scenario_set_projection_v1", canonicalFact(oldScenario), oldScenario));
  } finally { client.release(); }
  return { currentForecast, oldForecast, oldScenario, terminalHealth, operationalHealth };
}

async function seedCurrentScenarioDecisionPlanFeedback(currentForecast: CanonicalObject, posterior: CanonicalObject): Promise<void> {
  const scenario = canonicalObject({ object_id: "scenario-current", object_type: "twin_scenario_set_v1", logical_time: now(420), payload: { source_forecast_ref: currentForecast.object_id, source_forecast_hash: currentForecast.determinism_hash, source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash, scenario_policy_id: "policy-s4", option_count: 1 }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const decision = canonicalObject({ object_id: "decision-current", object_type: "twin_decision_record_v1", logical_time: now(421), context: true, payload: { scenario_set_ref: scenario.object_id, scenario_set_hash: scenario.determinism_hash, selected_option_ref: "option-current", selected_option_hash: semanticHashV1("option-current"), selected_option_id: "IRRIGATE_NOW_15MM", decision_request_evidence_ref: "decision-request-current", decision_request_evidence_hash: semanticHashV1("decision-request-current"), actor_ref: "operator-s4" }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const plan = replayPlanFact("plan-current", now(422));
  const planHash = String((plan.record_json.payload as JsonRecord).source_record_hash);
  const feedback = canonicalObject({ object_id: "feedback-current", object_type: "twin_action_feedback_v1", logical_time: now(423), context: true, payload: { decision_ref: decision.object_id, decision_hash: decision.determinism_hash, approved_plan_evidence_ref: "plan-current", approved_plan_evidence_hash: planHash, dispatch_disposition: "EXTERNALLY_RECORDED", event_id: "event-current", source_record_id: "source-current", binding_id: "binding-current", origin_source_id: "origin-current", execution_status: "EXECUTED", validation_status: "VALIDATED", source_quality: "PASS", eligible_for_state_input: true, actual_amount_mm: "15.000000", spatial_coverage_fraction: "1.000000", target_scope_equivalent_irrigation_mm: "15.000000", execution_start: now(422), execution_end: now(423), available_to_runtime_at: now(423) }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const facts = [canonicalFact(scenario), canonicalFact(decision), plan, canonicalFact(feedback)];
  await persistFacts(facts);
  const client = await pool.connect();
  try {
    await insertProjection(client, "public.twin_scenario_set_projection_v1", projectionRow("public.twin_scenario_set_projection_v1", facts[0], scenario));
    await insertProjection(client, "public.twin_decision_record_projection_v1", projectionRow("public.twin_decision_record_projection_v1", facts[1], decision));
    await insertProjection(client, "public.twin_action_feedback_projection_v1", projectionRow("public.twin_action_feedback_projection_v1", facts[3], feedback));
    await client.query(`INSERT INTO public.twin_approved_plan_binding_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`, [...Object.values(scope), decision.payload.decision_request_evidence_ref, decision.payload.decision_request_evidence_hash, decision.payload.selected_option_ref, decision.payload.selected_option_hash, "plan-current", planHash]);
  } finally { client.release(); }
}

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s4-key": "0123456789abcdef0123456789abcdef" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s4-key";
  try {
    await resetSchema();
    const states = await seedStateHistory(360);
    const api = new PostgresMcftFieldTwinReadApiV1(pool);

    await check("COLLECTIONS_DO_NOT_REQUIRE_CURRENT_RUNTIME_ROOT", async () => {
      const page = await api.readStates({ scope, limit: 50 }) as any;
      assert.equal(page.items.length, 50);
      assert.equal(page.has_more, true);
      assert.equal(typeof page.next_cursor, "string");
      const second = await api.readStates({ scope, limit: 50, cursor: page.next_cursor }) as any;
      assert.equal(second.items.length, 50);
      const empty = await api.readForecasts({ scope, limit: 50 }) as any;
      assert.deepEqual(empty.items, []);
      assert.equal(empty.has_more, false);
    });

    await check("RUNTIME_ROOT_404_AND_BROKEN_POINTER_FAIL_CLOSED", async () => {
      await assert.rejects(() => api.readRuntime({ scope }), /MCFT_RUNTIME_NOT_ESTABLISHED/);
      const client = await pool.connect();
      try { await client.query(`INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,'missing-lineage','missing-lineage')`, Object.values(scope)); }
      finally { client.release(); }
      await assert.rejects(() => api.readRuntime({ scope }), /MCFT_OPERATIONAL_POINTER_TARGET_MISSING/);
      await pool.query(`DELETE FROM public.twin_active_lineage_index_v1`);
    });

    const root = await seedRuntimeRoot(states.at(-1)!);

    await check("VALID_ROOT_AND_CURRENT_VS_LATEST_SCENARIO_SEPARATION", async () => {
      const runtime = await api.readRuntime({ scope }) as any;
      assert.equal(runtime.root_graph_status, "COMPLETE_EXACT_GRAPH");
      assert.equal(runtime.current_tick_forecast_result.object_ref, root.currentForecast.object_id);
      assert.equal(runtime.current_scenario_attachment.attachment_status, "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH");
      assert.equal(runtime.latest_scenario_in_scope.item.object_ref, root.oldScenario.object_id);
      assert.equal(runtime.scenario_source_forecast.item.object_ref, root.oldForecast.object_id);
      for (const summary of [runtime.action_feedback_summary, runtime.forecast_residual_summary, runtime.calibration_candidate_summary, runtime.shadow_evaluation_summary, runtime.model_activation_summary]) {
        assert.equal(summary.count_status, "NOT_COMPUTED");
        assert.equal(summary.total_count, null);
      }
    });

    await check("TIMELINE_SQL_KEYSET_BEYOND_201_AND_HEALTH_ROLES", async () => {
      const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
      const repository = new PostgresFieldTwinProjectionReadRepositoryV1();
      await snapshots.withReadOnlyRequestSnapshot(scope, async (context) => {
        const from = states[300].logical_time as string;
        const page = await repository.readTimelineEvents(context, 11, { from_logical_time: from, until_logical_time: null }, null);
        assert.equal(page.length, 11);
        assert.ok(page.every((event) => event.logical_time >= from));
        const after = await repository.readTimelineEvents(context, 11, { from_logical_time: null, until_logical_time: null }, { logical_time: states[300].logical_time as string, event_rank: 40, object_ref: states[300].object_id });
        assert.equal(after.length, 11);
        assert.ok(after[0].object_ref > states[300].object_id || after[0].logical_time > states[300].logical_time);
        const health = await repository.readTimelineEvents(context, 201, { from_logical_time: now(400), until_logical_time: null }, null);
        const terminal = health.find((event) => event.object_ref === root.terminalHealth.object_id)!;
        const operational = health.find((event) => event.object_ref === root.operationalHealth.object_id)!;
        assert.equal(terminal.transaction_family, "A_STATE_TICK_COMMIT");
        assert.equal(terminal.health_role, "TERMINAL_RECORD_SET_MEMBER");
        assert.equal(operational.transaction_family, "F_OPERATIONAL_ATTEMPT_HEALTH");
        assert.equal(operational.health_role, "OPERATIONAL_ATTEMPT_AUDIT");
      });
    });

    await check("REPLAY_PLAN_TIMELINE_AND_EXACT_OPTIONAL_ATTACHMENTS", async () => {
      await seedCurrentScenarioDecisionPlanFeedback(root.currentForecast, states.at(-1)!);
      const runtime = await api.readRuntime({ scope }) as any;
      assert.equal(runtime.current_scenario_attachment.item.object_ref, "scenario-current");
      assert.equal(runtime.current_human_decision.item.object_ref, "decision-current");
      assert.equal(runtime.current_approved_plan.item.object_ref, "plan-current");
      const actions = await api.readActionLifecycle({ scope, limit: 20 }) as any;
      assert.equal(actions.items[0].object_ref, "feedback-current");
      const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
      const repository = new PostgresFieldTwinProjectionReadRepositoryV1();
      await snapshots.withReadOnlyRequestSnapshot(scope, async (context) => {
        const timeline = await repository.readTimelineEvents(context, 201, { from_logical_time: now(420), until_logical_time: null }, null);
        const plan = timeline.find((event) => event.event_kind === "APPROVED_PLAN_EVIDENCE");
        assert.equal(plan?.object_ref, "plan-current");
        assert.equal(plan?.object_type, "approved_irrigation_plan_snapshot_v1");
      });
    });

    await check("MODEL_GOVERNANCE_COMPOSER_RUNS_IN_PAGE_SNAPSHOT", async () => {
      const page = await api.readModelGovernance({ scope, collection_kind: "CALIBRATION_CANDIDATE", limit: 20 }) as any;
      assert.deepEqual(page.items, []);
    });

    await check("STRICT_PILOT_AND_COMMERCIAL_AUTH_FAIL_CLOSED", () => {
      const old = { env: process.env.GEOX_RUNTIME_ENV, json: process.env.GEOX_TOKENS_JSON, file: process.env.GEOX_TOKENS_FILE, token: process.env.GEOX_TOKEN };
      process.env.GEOX_RUNTIME_ENV = "pilot";
      delete process.env.GEOX_TOKENS_JSON;
      delete process.env.GEOX_TOKENS_FILE;
      process.env.GEOX_TOKEN = "development-token-must-not-work";
      const request = { headers: { authorization: "Bearer development-token-must-not-work" } } as any;
      assert.equal(authorizeMcftFieldTwinReadV1(request), null);
      process.env.GEOX_TOKENS_JSON = JSON.stringify({ version: "ao_act_tokens_v0", tokens: [{ token: "strict-token", token_id: "strict-id", actor_id: "actor", ...scope, scopes: ["fields.read"], revoked: false, role: "viewer", allowed_field_ids: [scope.field_id] }] });
      const strictRequest = { headers: { authorization: "Bearer strict-token" } } as any;
      assert.equal(authorizeMcftFieldTwinReadV1(strictRequest)?.tenant_id, scope.tenant_id);
      if (old.env === undefined) delete process.env.GEOX_RUNTIME_ENV; else process.env.GEOX_RUNTIME_ENV = old.env;
      if (old.json === undefined) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON = old.json;
      if (old.file === undefined) delete process.env.GEOX_TOKENS_FILE; else process.env.GEOX_TOKENS_FILE = old.file;
      if (old.token === undefined) delete process.env.GEOX_TOKEN; else process.env.GEOX_TOKEN = old.token;
    });

    await check("READ_ADAPTER_DOES_NOT_MUTATE_FIXTURE", async () => {
      const before = Number((await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.facts")).rows[0].count);
      await api.readStates({ scope, limit: 10 });
      await api.readRuntime({ scope });
      const after = Number((await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.facts")).rows[0].count);
      assert.equal(after, before);
      const source = fs.readFileSync(path.join(ROOT, "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.ts"), "utf8");
      assert.doesNotMatch(source, /SELECT\s+pg_catalog\.count\(\*\)/i);
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_api_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
    console.log(JSON.stringify({ status: "PASS", check_count: checks.length }));
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_api_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
