// Purpose: shared isolated PostgreSQL fixture primitives for MCFT-CAP-07 S4 adapter acceptance.
// Boundary: test-only schema/fact/projection setup; production read code remains SELECT-only.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import type { FieldTwinScopeV1 } from "../../apps/server/src/domain/field_twin_read_model/index.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const databaseUrl = String(process.env.MCFT_S4_TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres");
export const pool = new Pool({ connectionString: databaseUrl, max: 4 });
export const scope: FieldTwinScopeV1 = Object.freeze({ tenant_id: "tenant-s4", project_id: "project-s4", group_id: "group-s4", field_id: "field-s4", season_id: "season-s4", zone_id: "zone-s4" });
export const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json"), "utf8"));
export const now = (minute: number) => new Date(Date.UTC(2026, 6, 20, 0, minute, 0, 0)).toISOString();

export type JsonRecord = Record<string, unknown>;
export type CanonicalObject = JsonRecord & { object_id: string; object_type: string; determinism_hash: string; payload: JsonRecord };
export type Fact = { fact_id: string; record_json: JsonRecord; occurred_at: string };

export function readPath(root: unknown, dotted: string): unknown {
  let value: unknown = root;
  for (const key of dotted.split(".").filter(Boolean)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as JsonRecord)[key];
  }
  return value;
}

export function canonicalObject(input: {
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

export function canonicalFact(object: CanonicalObject): Fact {
  return { fact_id: `fact:${object.object_id}`, occurred_at: String(object.logical_time), record_json: { type: object.object_type, payload: object } };
}

export function replayPlanFact(planId: string, availableAt: string): Fact {
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

export function projectionMatrixRow(sourceName: string): JsonRecord {
  const rows = matrix.rows.filter((row: JsonRecord) => row.source_name === sourceName);
  assert.equal(rows.length, 1, sourceName);
  return rows[0] as JsonRecord;
}

export function projectionRow(sourceName: string, fact: Fact, object: CanonicalObject): JsonRecord {
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

export function sqlType(column: string): string {
  if (["logical_time", "as_of", "execution_start", "execution_end", "available_to_runtime_at", "decided_at"].includes(column)) return "timestamptz";
  if (["canonical_payload", "target_scope", "member_object_ids", "member_determinism_hashes", "identity_basis"].includes(column)) return "jsonb";
  if (column === "active_for_decision" || column.startsWith("eligible_") || column === "revoked") return "boolean";
  if (column.endsWith("_count") || column === "event_rank") return "integer";
  return "text";
}

export async function createProjectionTable(client: PoolClient, sourceName: string): Promise<void> {
  const obligation = projectionMatrixRow(sourceName);
  const table = sourceName.replace(/^public\./, "");
  const columns = [...new Set(obligation.available_projection_columns as string[])];
  await client.query(`CREATE TABLE public.${table} (${columns.map((column) => `${column} ${sqlType(column)}`).join(",")})`);
}

export async function insertProjection(client: PoolClient, sourceName: string, row: JsonRecord): Promise<void> {
  const table = sourceName.replace(/^public\./, "");
  const columns = Object.keys(row);
  const values = columns.map((column) => sqlType(column) === "jsonb" && row[column] !== null ? JSON.stringify(row[column]) : row[column]);
  await client.query(`INSERT INTO public.${table} (${columns.join(",")}) VALUES (${columns.map((_, index) => `$${index + 1}${sqlType(columns[index]) === "jsonb" ? "::jsonb" : ""}`).join(",")})`, values);
}

export async function resetSchema(): Promise<void> {
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

export async function persistFacts(facts: readonly Fact[]): Promise<void> {
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

export async function seedStateHistory(count: number): Promise<CanonicalObject[]> {
  const objects: CanonicalObject[] = [];
  const facts: Fact[] = [];
  for (let index = 0; index < count; index += 1) {
    const object = canonicalObject({ object_id: `state-${String(index).padStart(3, "0")}`, object_type: "twin_state_estimate_v1", logical_time: now(index), payload: { sequence: index } });
    objects.push(object);
    facts.push(canonicalFact(object));
  }
  await persistFacts(facts);
  const client = await pool.connect();
  try {
    for (let index = 0; index < objects.length; index += 1) await insertProjection(client, "public.twin_state_history_projection_v1", projectionRow("public.twin_state_history_projection_v1", facts[index], objects[index]));
  } finally { client.release(); }
  return objects;
}
