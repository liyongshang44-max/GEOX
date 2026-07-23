// apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts
// Purpose: persist immutable Reality Binding Runtime snapshots and reconstruct one consistent next-tick snapshot from PostgreSQL projections plus canonical facts using exact contract and operation-variant dispatch.
// Boundary: persistence/read-model adapter only; no propagation, Evidence selection, State equations, scheduler, routes, web, or canonical object construction.

import type { Pool, PoolClient } from "pg";
import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import { validateContinuationMemberV1 } from "../../domain/twin_runtime/continuation_contracts_v1.js";
import {
  CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1,
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { validateCap04CanonicalEnvelopeV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1,
  readCap04TickRecoveryAuthorityV1,
} from "../../domain/twin_runtime/forecast_record_set_recovery_authority_v1.js";
import type { NextTickReadPortV1, PersistedNextTickSnapshotV1, RealityBindingRuntimeSnapshotV1, RuntimeAuthoritySnapshotRepositoryPortV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

const A0_BOOTSTRAP_OPERATION_VARIANT_V1 = "A0_BOOTSTRAP_STATE_COMMIT" as const;

function exactCap04TerminalTickV1(object: CanonicalObjectEnvelopeV1): boolean {
  if (object.object_type !== "twin_runtime_tick_v1") return false;
  const contractId = object.payload.record_set_contract_id;
  const variant = object.payload.operation_variant;
  const authority = object.payload.recovery_authority;
  const exactVariant = (contractId === CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1 && variant === CAP04_A1_OPERATION_VARIANT_V1)
    || (contractId === CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1 && variant === CAP04_A2_OPERATION_VARIANT_V1);
  return exactVariant
    && Boolean(authority && typeof authority === "object" && !Array.isArray(authority)
      && (authority as Record<string, unknown>).contract_id === CAP04_TICK_RECOVERY_AUTHORITY_CONTRACT_ID_V1);
}

function exactAssimilatedContinuationTickV1(object: CanonicalObjectEnvelopeV1): boolean {
  if (object.object_type !== "twin_runtime_tick_v1") return false;
  const contractId = object.payload.record_set_contract_id;
  return contractId === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1
    || contractId === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2;
}

function exactA0BootstrapTickV1(object: CanonicalObjectEnvelopeV1): boolean {
  return object.object_type === "twin_runtime_tick_v1"
    && object.payload.operation_variant === A0_BOOTSTRAP_OPERATION_VARIANT_V1;
}

function parseFactObjectRawV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string" ? JSON.parse(recordJsonValue) : recordJsonValue;
  const object = (parsed as { payload?: CanonicalObjectEnvelopeV1 }).payload;
  if (!object || typeof object !== "object") throw new Error("PERSISTED_CANONICAL_OBJECT_REQUIRED");
  return object;
}

function validateExactCap04SnapshotGraphV1(input: {
  tick: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
}): void {
  if (!exactCap04TerminalTickV1(input.tick)) throw new Error("CAP04_EXACT_TICK_DISPATCH_REQUIRED");
  readCap04TickRecoveryAuthorityV1(input.tick);
  for (const member of [input.tick, input.checkpoint, input.state, input.forecast]) validateCap04CanonicalEnvelopeV1(member);
  if (input.tick.payload.checkpoint_ref !== input.checkpoint.object_id) throw new Error("CAP04_EXACT_CHECKPOINT_REF_MISMATCH");
  if (input.tick.payload.posterior_state_ref !== input.state.object_id) throw new Error("CAP04_EXACT_STATE_REF_MISMATCH");
  if (input.tick.payload.forecast_result_ref !== input.forecast.object_id) throw new Error("CAP04_EXACT_FORECAST_REF_MISMATCH");
  const forecastPayload = input.forecast.payload as unknown as Cap04CanonicalForecastRunPayloadV1;
  if (forecastPayload.canonical_authority_contract_id !== CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1) {
    throw new Error("CAP04_EXACT_FORECAST_AUTHORITY_CONTRACT_REQUIRED");
  }
  validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
  const variant = input.tick.payload.operation_variant;
  if ((variant === CAP04_A1_OPERATION_VARIANT_V1 && forecastPayload.status !== "COMPLETED")
    || (variant === CAP04_A2_OPERATION_VARIANT_V1 && forecastPayload.status !== "BLOCKED")) {
    throw new Error("CAP04_EXACT_FORECAST_VARIANT_STATUS_MISMATCH");
  }
}

function validateExactA0SnapshotGraphV1(input: {
  tick: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
}): void {
  if (!exactA0BootstrapTickV1(input.tick)) throw new Error("A0_EXACT_TICK_DISPATCH_REQUIRED");
  for (const member of [input.tick, input.checkpoint, input.state, input.forecast]) validateCanonicalObjectV1(member);
  if (input.checkpoint.payload.checkpoint_kind !== "INITIAL") throw new Error("A0_EXACT_CHECKPOINT_KIND_MISMATCH");
  if (input.forecast.payload.status !== "BLOCKED") throw new Error("A0_EXACT_FORECAST_STATUS_MISMATCH");
  if (input.tick.payload.checkpoint_ref !== input.checkpoint.object_id) throw new Error("A0_EXACT_CHECKPOINT_REF_MISMATCH");
  if (input.tick.payload.posterior_state_ref !== input.state.object_id) throw new Error("A0_EXACT_STATE_REF_MISMATCH");
  if (input.tick.payload.forecast_result_ref !== input.forecast.object_id) throw new Error("A0_EXACT_FORECAST_REF_MISMATCH");
  if (input.checkpoint.payload.last_completed_tick_ref !== input.tick.object_id) throw new Error("A0_EXACT_TICK_REF_MISMATCH");
  if (input.checkpoint.payload.last_posterior_state_ref !== input.state.object_id) throw new Error("A0_EXACT_CHECKPOINT_STATE_REF_MISMATCH");
  if (input.checkpoint.payload.forecast_result_ref !== input.forecast.object_id) throw new Error("A0_EXACT_CHECKPOINT_FORECAST_REF_MISMATCH");
  if (input.checkpoint.payload.next_tick_logical_time !== input.tick.payload.next_tick_logical_time) {
    throw new Error("A0_EXACT_NEXT_TICK_TIME_MISMATCH");
  }
}

function validateNonCap04SnapshotGraphV1(input: {
  tick: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
}): void {
  if (exactAssimilatedContinuationTickV1(input.tick)) validateCanonicalObjectV1(input.tick);
  else validateContinuationMemberV1(input.tick);
  validateContinuationMemberV1(input.checkpoint);
  validateContinuationMemberV1(input.state);
  validateCanonicalObjectV1(input.forecast);
}

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("NON_FINITE_AUTHORITY_VALUE");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error(`UNSUPPORTED_AUTHORITY_VALUE:${typeof value}`);
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new Error(code);
  return value;
}

export class PostgresNextTickRepositoryV1 implements RuntimeAuthoritySnapshotRepositoryPortV1, NextTickReadPortV1 {
  constructor(private readonly pool: Pool) {}

  async commitRealityBindingSnapshot(snapshot: RealityBindingRuntimeSnapshotV1): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; binding_id: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1
         (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES ('REALITY_BINDING',$1,$2,$3::jsonb)
         ON CONFLICT (authority_kind,authority_ref) DO NOTHING
         RETURNING authority_ref`,
        [snapshot.binding_id, snapshot.determinism_hash, JSON.stringify(snapshot)],
      );
      if (inserted.rows.length === 1) {
        await client.query("COMMIT");
        return { status: "INSERTED", binding_id: snapshot.binding_id };
      }
      if (inserted.rows.length !== 0) throw new Error("REALITY_BINDING_SNAPSHOT_INSERT_CARDINALITY");
      const existing = await client.query(
        "SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1",
        [snapshot.binding_id],
      );
      if (existing.rows.length !== 1) throw new Error("REALITY_BINDING_SNAPSHOT_CONFLICT");
      if (existing.rows[0].determinism_hash !== snapshot.determinism_hash
        || canonicalJsonV1(existing.rows[0].semantic_payload) !== canonicalJsonV1(snapshot)) {
        throw new Error("REALITY_BINDING_SNAPSHOT_CONFLICT");
      }
      await client.query("COMMIT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", binding_id: snapshot.binding_id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readRealityBindingSnapshotWithClientV1(client: PoolClient, bindingId: string): Promise<RealityBindingRuntimeSnapshotV1 | null> {
    const result = await client.query("SELECT semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1", [bindingId]);
    return result.rows.length ? result.rows[0].semantic_payload as RealityBindingRuntimeSnapshotV1 : null;
  }

  async readRealityBindingSnapshot(bindingId: string): Promise<RealityBindingRuntimeSnapshotV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readRealityBindingSnapshotWithClientV1(client, bindingId);
    } finally {
      client.release();
    }
  }

  private async readCanonicalObjectRawV1(client: PoolClient, objectId: string, expectedType: CanonicalObjectEnvelopeV1["object_type"]): Promise<CanonicalObjectEnvelopeV1> {
    const result = await client.query("SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2 LIMIT 2", [objectId, expectedType]);
    if (result.rows.length !== 1) throw new Error(`PERSISTED_OBJECT_CARDINALITY:${expectedType}:${objectId}`);
    const object = parseFactObjectRawV1(result.rows[0].record_json);
    if (object.object_type !== expectedType) throw new Error(`PERSISTED_OBJECT_TYPE_MISMATCH:${expectedType}:${objectId}`);
    return object;
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const active = await client.query("SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      const checkpointPointer = await client.query("SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      const statePointer = await client.query("SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      if (!active.rows.length && !checkpointPointer.rows.length && !statePointer.rows.length) {
        await client.query("COMMIT");
        return null;
      }
      if (active.rows.length !== 1 || checkpointPointer.rows.length !== 1 || statePointer.rows.length !== 1) throw new Error("PERSISTED_NEXT_TICK_POINTER_SET_INCOMPLETE");

      const activeLineageRef = requiredStringV1(active.rows[0].active_lineage_ref, "ACTIVE_LINEAGE_REF_REQUIRED");
      const activeLineage = await this.readCanonicalObjectRawV1(client, activeLineageRef, "twin_runtime_lineage_v1");
      validateCanonicalObjectV1(activeLineage);
      const activeLineageId = requiredStringV1(activeLineage.lineage_id, "ACTIVE_LINEAGE_ID_REQUIRED");
      const checkpoint = await this.readCanonicalObjectRawV1(client, checkpointPointer.rows[0].checkpoint_object_id, "twin_runtime_checkpoint_v1");
      const previousPosterior = await this.readCanonicalObjectRawV1(client, statePointer.rows[0].state_object_id, "twin_state_estimate_v1");
      const previousForecastResultRef = requiredStringV1(checkpoint.payload.forecast_result_ref, "PREVIOUS_FORECAST_RESULT_REF_REQUIRED");
      const previousForecastResult = await this.readCanonicalObjectRawV1(client, previousForecastResultRef, "twin_forecast_run_v1");
      const lastCompletedTickRef = requiredStringV1(checkpoint.payload.last_completed_tick_ref, "LAST_COMPLETED_TICK_REF_REQUIRED");
      const lastTerminalTick = await this.readCanonicalObjectRawV1(client, lastCompletedTickRef, "twin_runtime_tick_v1");
      if (exactCap04TerminalTickV1(lastTerminalTick)) {
        validateExactCap04SnapshotGraphV1({
          tick: lastTerminalTick,
          checkpoint,
          state: previousPosterior,
          forecast: previousForecastResult,
        });
      } else if (exactA0BootstrapTickV1(lastTerminalTick)) {
        validateExactA0SnapshotGraphV1({
          tick: lastTerminalTick,
          checkpoint,
          state: previousPosterior,
          forecast: previousForecastResult,
        });
      } else {
        validateNonCap04SnapshotGraphV1({
          tick: lastTerminalTick,
          checkpoint,
          state: previousPosterior,
          forecast: previousForecastResult,
        });
      }
      if (!previousPosterior.runtime_config_ref || checkpoint.runtime_config_ref !== previousPosterior.runtime_config_ref) throw new Error("PERSISTED_RUNTIME_CONFIG_POINTER_MISMATCH");
      const runtimeConfig = await this.readCanonicalObjectRawV1(client, previousPosterior.runtime_config_ref, "twin_runtime_config_v1");
      validateCanonicalObjectV1(runtimeConfig);
      const realityBindingRef = runtimeConfig.payload.reality_binding_ref;
      if (typeof realityBindingRef !== "string" || !realityBindingRef) throw new Error("RUNTIME_CONFIG_REALITY_BINDING_REF_REQUIRED");
      const realityBinding = await this.readRealityBindingSnapshotWithClientV1(client, realityBindingRef);
      if (!realityBinding) throw new Error("PERSISTED_REALITY_BINDING_NOT_FOUND");
      await client.query("COMMIT");
      return {
        active_lineage_ref: activeLineageRef,
        active_lineage_id: activeLineageId,
        checkpoint,
        previous_posterior: previousPosterior,
        previous_forecast_result: previousForecastResult,
        last_terminal_tick: lastTerminalTick,
        runtime_config: runtimeConfig,
        reality_binding: realityBinding,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
