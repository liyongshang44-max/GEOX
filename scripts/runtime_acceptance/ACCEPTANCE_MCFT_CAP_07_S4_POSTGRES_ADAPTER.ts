// Purpose: prove S4 production PostgreSQL read semantics for root-independent collections, exact root failures, keyset Timeline, Replay Evidence, Health roles, and strict auth.
// Boundary: isolated PostgreSQL fixture; product adapter performs SELECT-only reads and no canonical/projection writes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { authorizeMcftFieldTwinReadV1 } from "../../apps/server/src/auth/mcft_field_twin_read_authz_v1.js";
import { computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import type { FieldTwinScopeV1, SemanticHashTextV1 } from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";
import { PostgresFieldTwinS4RepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_repository_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

const DB = String(process.env.MCFT_S4_POSTGRES_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S4_POSTGRES_ADAPTER_RESULT.json");
const scope: FieldTwinScopeV1 = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA" };
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, fn: () => void) => { fn(); checks.push({ name, status: "PASS" }); };
const at = (minute: number) => new Date(Date.UTC(2026, 6, 20, 0, minute, 0)).toISOString();

type Obj = Record<string, any>;
function object(id: string, type: string, logicalTime: string, payload: Obj = {}, extra: Obj = {}): Obj {
  const value: Obj = { object_id: id, object_type: type, ...scope, lineage_id: extra.lineage_id ?? "lineage-a", revision_id: extra.revision_id ?? "revision-a", logical_time: logicalTime, as_of: logicalTime, payload, source_refs: [], evidence_refs: [], limitations: [], ...extra };
  value.determinism_hash = computeMemberDeterminismHashV1(value);
  return value;
}
function envelope(obj: Obj): Obj { return { type: obj.object_type, payload: obj }; }
async function insertFact(pool: Pool, factId: string, recordJson: Obj): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query("INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,'s4',$3::jsonb)", [factId, recordJson.payload?.logical_time ?? recordJson.payload?.available_to_runtime_at ?? at(0), JSON.stringify(recordJson)]);
    await pool.query("INSERT INTO public.twin_fact_visibility_index_v1(visibility_epoch_id,fact_id,visibility_anchor_xid8,visibility_anchor_kind) VALUES('epoch-s4',$1,pg_catalog.pg_current_xact_id(),'FACT_INSERT_TRANSACTION')", [factId]);
    await pool.query("COMMIT");
  } catch (error) { await pool.query("ROLLBACK"); throw error; }
}

async function prepare(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS public.twin_state_history_projection_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_forecast_run_projection_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_active_lineage_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_runtime_checkpoint_latest_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_object_idempotency_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_runtime_record_set_identity_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_fact_visibility_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.twin_fact_visibility_epoch_v1 CASCADE;
    DROP TABLE IF EXISTS public.facts CASCADE;
    CREATE TABLE public.facts(fact_id text PRIMARY KEY,occurred_at timestamptz NOT NULL,source text NOT NULL,record_json jsonb NOT NULL);
    CREATE TABLE public.twin_fact_visibility_epoch_v1(visibility_epoch_id text PRIMARY KEY,status text NOT NULL);
    INSERT INTO public.twin_fact_visibility_epoch_v1 VALUES('epoch-s4','ACTIVE');
    CREATE TABLE public.twin_fact_visibility_index_v1(visibility_epoch_id text NOT NULL,fact_id text NOT NULL,visibility_anchor_xid8 xid8 NOT NULL,visibility_anchor_kind text NOT NULL,PRIMARY KEY(visibility_epoch_id,fact_id));
    CREATE TABLE public.twin_state_history_projection_v1(state_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_forecast_run_projection_v1(forecast_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    CREATE TABLE public.twin_active_lineage_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,active_lineage_ref text,activation_authority_ref text);
    CREATE TABLE public.twin_runtime_checkpoint_latest_index_v1(tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,checkpoint_object_id text,determinism_hash text,lineage_id text);
    CREATE TABLE public.twin_object_idempotency_index_v1(identity_kind text,idempotency_key text,record_set_id text,determinism_hash text,identity_basis jsonb,member_object_ids jsonb,member_determinism_hashes jsonb);
    CREATE TABLE public.twin_runtime_record_set_identity_index_v1(record_set_id text,member_object_ids jsonb);
  `);

  for (let i = 0; i < 305; i += 1) {
    const id = `state-${String(i).padStart(3, "0")}`;
    const obj = object(id, "twin_state_estimate_v1", at(i), { ordinal: i });
    const factId = `fact-${id}`;
    await insertFact(pool, factId, envelope(obj));
    await pool.query("INSERT INTO public.twin_state_history_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)", [id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, obj.lineage_id, obj.revision_id, obj.logical_time, obj.determinism_hash, JSON.stringify(obj.payload), factId]);
  }

  const runtimeConfig = object("config-a", "twin_runtime_config_v1", at(400), { config: "a" });
  const cfgRef = runtimeConfig.object_id, cfgHash = runtimeConfig.determinism_hash;
  const lineage = object("lineage-object-a", "twin_runtime_lineage_v1", at(400), { lineage_kind: "INITIAL", activation_authority_ref: "lineage-object-a" }, { lineage_id: "lineage-a", runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const evidence = object("evidence-a", "twin_evidence_window_v1", at(401), {}, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const transition = object("transition-a", "twin_state_transition_v1", at(401), {}, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const assimilation = object("assimilation-a", "twin_assimilation_update_v1", at(401), {}, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const posterior = object("posterior-a", "twin_state_estimate_v1", at(401), {}, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const forecast = object("forecast-a", "twin_forecast_run_v1", at(401), { status: "COMPLETED", point_count: 72 }, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const healthA = object("health-a", "twin_runtime_health_v1", at(401), {}, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const checkpoint = object("checkpoint-a", "twin_runtime_checkpoint_v1", at(401), { last_completed_tick_ref: "tick-a", last_posterior_state_ref: "posterior-a", forecast_result_ref: "forecast-a" }, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const tick = object("tick-a", "twin_runtime_tick_v1", at(401), { checkpoint_ref: "checkpoint-a", evidence_window_ref: "evidence-a", state_transition_ref: "transition-a", assimilation_update_ref: "assimilation-a", posterior_state_ref: "posterior-a", forecast_result_ref: "forecast-a" }, { runtime_config_ref: cfgRef, runtime_config_hash: cfgHash });
  const members = [checkpoint, tick, evidence, transition, assimilation, posterior, forecast, healthA];
  for (const obj of [runtimeConfig, lineage, ...members]) await insertFact(pool, `fact-${obj.object_id}`, envelope(obj));
  const recordSetId = "record-set-a";
  const recordSetHash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSetId, members });
  await pool.query("INSERT INTO public.twin_object_idempotency_index_v1 VALUES('A0_RECORD_SET','idem-a',$1,$2,'{}'::jsonb,$3::jsonb,$4::jsonb)", [recordSetId, recordSetHash, JSON.stringify(members.map((x) => x.object_id)), JSON.stringify(Object.fromEntries(members.map((x) => [x.object_id, x.determinism_hash])))]);
  await pool.query("INSERT INTO public.twin_runtime_record_set_identity_index_v1 VALUES($1,$2::jsonb)", [recordSetId, JSON.stringify(members.map((x) => x.object_id))]);

  const attempt = object("attempt-f", "twin_runtime_attempt_v1", at(402), {});
  const failure = object("failure-f", "twin_forecast_failure_v1", at(402), { attempt_ref: "attempt-f" });
  const healthF = object("health-f", "twin_runtime_health_v1", at(402), { attempt_ref: "attempt-f", forecast_failure_ref: "failure-f" });
  for (const obj of [attempt, failure, healthF]) await insertFact(pool, `fact-${obj.object_id}`, envelope(obj));

  const canonicalPlan = { approved_amount_mm: 12, observed_at: at(403) };
  const replayPayload: Obj = { ...scope, source_record_id: "plan-a", available_to_runtime_at: at(403), evidence_identity_key: "plan-a|approved", source_payload: canonicalPlan, canonical_payload: canonicalPlan };
  replayPayload.source_record_hash = semanticHashV1(replayPayload) as SemanticHashTextV1;
  await insertFact(pool, "fact-plan-a", { type: "approved_irrigation_plan_snapshot_v1", payload: replayPayload });
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DB, max: 4 });
  try {
    await prepare(pool);
    process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s4-key": "0123456789abcdef0123456789abcdef" });
    process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s4-key";
    const api = new PostgresMcftFieldTwinReadApiV1(pool);
    const first = await api.readStates({ scope, limit: 50 }) as any;
    check("LIST_WITHOUT_CURRENT_ROOT_RETURNS_ITEMS", () => { assert.equal(first.items.length, 50); assert.equal(first.items[0].object_ref, "state-304"); assert.equal(typeof first.next_cursor, "string"); });
    const second = await api.readStates({ scope, limit: 50, cursor: first.next_cursor }) as any;
    check("LIST_CURSOR_CONTINUES_WITHOUT_CURRENT_ROOT", () => { assert.equal(second.items.length, 50); assert.equal(second.items[0].object_ref, "state-254"); });
    const empty = await api.readForecasts({ scope, limit: 50 }) as any;
    check("LEGAL_EMPTY_COLLECTION_IS_200_BODY", () => { assert.deepEqual(empty.items, []); assert.equal(empty.next_cursor, null); });

    let noRoot = "";
    try { await api.readRuntime({ scope }); } catch (error) { noRoot = String((error as Error).message); }
    check("RUNTIME_WITHOUT_ROOT_FAILS_404_CODE", () => assert.match(noRoot, /MCFT_RUNTIME_NOT_ESTABLISHED/));
    await pool.query("INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,'missing-lineage','missing-authority')", [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id]);
    let brokenRoot = "";
    try { await api.readRuntime({ scope }); } catch (error) { brokenRoot = String((error as Error).message); }
    check("ESTABLISHED_POINTER_WITH_MISSING_TARGET_FAILS_409_CODE", () => assert.match(brokenRoot, /MCFT_OPERATIONAL_POINTER_TARGET_MISSING/));
    await pool.query("DELETE FROM public.twin_active_lineage_index_v1");

    const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
    const repository = new PostgresFieldTwinS4RepositoryV1();
    await snapshots.withReadOnlyRequestSnapshot(scope, async (context) => {
      const from250 = await repository.readTimelineEvents(context, 51, { from_logical_time: at(250), until_logical_time: null }, null);
      check("TIMELINE_FROM_FILTER_AFTER_ROW_201", () => { assert.equal(from250[0].object_ref, "state-250"); assert.equal(from250.length, 51); });
      const first201 = await repository.readTimelineEvents(context, 201, { from_logical_time: null, until_logical_time: null }, null);
      const boundary = first201[200];
      const continued = await repository.readTimelineEvents(context, 51, { from_logical_time: null, until_logical_time: null }, { logical_time: boundary.logical_time, event_rank: boundary.event_rank, object_ref: boundary.object_ref });
      check("TIMELINE_KEYSET_AFTER_201", () => { assert.equal(continued[0].object_ref, "state-201"); assert.equal(continued.length, 51); });
      const tail = await repository.readTimelineEvents(context, 30, { from_logical_time: at(400), until_logical_time: null }, null);
      const plan = tail.find((x) => x.object_ref === "plan-a");
      const a = tail.find((x) => x.object_ref === "health-a");
      const f = tail.find((x) => x.object_ref === "health-f");
      check("TIMELINE_REPLAY_EVIDENCE_RESOLVER", () => { assert.equal(plan?.event_kind, "APPROVED_PLAN_EVIDENCE"); assert.equal(plan?.object_type, "approved_irrigation_plan_snapshot_v1"); });
      check("TIMELINE_A_HEALTH_ROLE", () => { assert.equal(a?.transaction_family, "A_STATE_TICK_COMMIT"); assert.equal(a?.health_role, "TERMINAL_RECORD_SET_MEMBER"); assert.equal(a?.atomic_group_ref, "record-set-a"); });
      check("TIMELINE_F_HEALTH_ROLE", () => { assert.equal(f?.transaction_family, "F_OPERATIONAL_ATTEMPT_HEALTH"); assert.equal(f?.health_role, "OPERATIONAL_ATTEMPT_AUDIT"); assert.equal(f?.atomic_group_ref, null); });
    });

    const oldEnv = process.env.GEOX_RUNTIME_ENV, oldToken = process.env.GEOX_TOKEN, oldJson = process.env.GEOX_TOKENS_JSON;
    process.env.GEOX_RUNTIME_ENV = "pilot"; process.env.GEOX_TOKEN = "dev-token"; delete process.env.GEOX_TOKENS_JSON;
    const request = { headers: { authorization: "Bearer dev-token" } } as any;
    check("PILOT_SINGLE_TOKEN_FAILS_CLOSED", () => assert.equal(authorizeMcftFieldTwinReadV1(request), null));
    process.env.GEOX_TOKENS_JSON = JSON.stringify({ tokens: [{ token: "strict-token", token_id: "tok", actor_id: "actor", ...scope, scopes: ["fields.read"], revoked: false, role: "viewer" }] });
    check("PILOT_STRUCTURED_SSOT_AUTHORIZES", () => assert.equal(authorizeMcftFieldTwinReadV1({ headers: { authorization: "Bearer strict-token" } } as any)?.tenant_id, scope.tenant_id));
    if (oldEnv == null) delete process.env.GEOX_RUNTIME_ENV; else process.env.GEOX_RUNTIME_ENV = oldEnv;
    if (oldToken == null) delete process.env.GEOX_TOKEN; else process.env.GEOX_TOKEN = oldToken;
    if (oldJson == null) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON = oldJson;

    const source = fs.readFileSync("apps/server/src/services/mcft_field_twin_read_api_v1.ts", "utf8") + fs.readFileSync("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_repository_v1.ts", "utf8");
    check("S4_PRODUCT_PATH_HAS_NO_COUNT_QUERY", () => assert.doesNotMatch(source, /count\s*\(\s*\*\s*\)/i));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_adapter_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
    console.log(`MCFT-CAP-07 S4 PostgreSQL adapter: ${checks.length} PASS`);
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_adapter_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
void main();
