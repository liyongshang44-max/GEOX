// apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts
// Purpose: persist CAP-04 A1/A2/B canonical candidates atomically into the existing append-only facts store with fencing, CAS, idempotency, cross-variant uniqueness, readback, pending-Scenario detection, and rebuildable projections.
// Boundary: persistence and projection mutation only; no Evidence selection, Forecast math, Scenario math, record-set construction, route, scheduler, filesystem, environment, or wall clock authority.

import type { Pool, PoolClient } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ARecordSetIdentityV1,
  deriveCap04ScenarioSetIdentityV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  buildCap04ForecastProjectionRowsV1,
  buildCap04ScenarioProjectionRowsV1,
} from "../../projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.js";
import type {
  Cap04ExpectedPointersV1,
  Cap04ForecastScenarioPersistencePortV1,
} from "../../runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import type {
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../runtime/twin_runtime/ports.js";

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string" ? JSON.parse(recordJsonValue) : recordJsonValue;
  const object = (parsed as { payload?: CanonicalObjectEnvelopeV1 })?.payload;
  if (!object || typeof object !== "object") throw new Error("CAP04_CANONICAL_FACT_PAYLOAD_MISSING");
  return object;
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function assertScopeV1(scope: TwinScopeKeyV1, value: {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
}, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (value[field] !== scope[field]) throw new Error(`${code}:${field}`);
  }
}

function requireMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_A_MEMBER_TYPE_CARDINALITY:${objectType}`);
  return matches[0];
}

function identityKindForARecordSetV1(recordSet: Cap04ARecordSetV1): "A1_RECORD_SET" | "A2_RECORD_SET" {
  return recordSet.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1
    ? "A1_RECORD_SET"
    : "A2_RECORD_SET";
}

function isPgUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

export class PostgresForecastScenarioRepositoryV1 implements Cap04ForecastScenarioPersistencePortV1 {
  constructor(private readonly pool: Pool) {}

  private async verifyLeaseV1(
    client: PoolClient,
    scope: TwinScopeKeyV1,
    lease: RuntimeLeaseClaimV1,
  ): Promise<void> {
    assertScopeV1(scope, lease, "CAP04_LEASE_SCOPE_MISMATCH");
    const result = await client.query(
      `SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid
       FROM twin_runtime_lease_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       FOR UPDATE`,
      scopeValuesV1(scope),
    );
    if (result.rows.length !== 1 || result.rows[0].lease_owner !== lease.lease_owner) throw new Error("LEASE_OWNER_MISMATCH");
    if (BigInt(result.rows[0].fencing_token) !== lease.fencing_token) throw new Error("STALE_FENCING_TOKEN");
    if (!result.rows[0].valid) throw new Error("LEASE_EXPIRED");
  }

  private async readCanonicalObjectWithClientV1(
    client: PoolClient,
    objectId: string,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 LIMIT 2",
      [objectId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CANONICAL_OBJECT_ID_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type === "twin_scenario_set_v1") throw new Error("CANONICAL_OBJECT_TYPE_UNEXPECTED_SCENARIO_SET");
    return object;
  }

  private async verifyRuntimeConfigV1(
    client: PoolClient,
    objectId: string,
    determinismHash: string,
  ): Promise<void> {
    const config = await this.readCanonicalObjectWithClientV1(client, objectId);
    if (!config || config.object_type !== "twin_runtime_config_v1") throw new Error("RUNTIME_CONFIG_NOT_FOUND");
    if (config.determinism_hash !== determinismHash) throw new Error("RUNTIME_CONFIG_HASH_MISMATCH");
  }

  private async verifyAExpectedPointersV1(
    client: PoolClient,
    scope: TwinScopeKeyV1,
    expected: Cap04ExpectedPointersV1,
    recordSet: Cap04ARecordSetV1,
  ): Promise<void> {
    const values = scopeValuesV1(scope);
    const active = await client.query(
      `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    );
    if (active.rows.length !== 1 || active.rows[0].active_lineage_ref !== expected.active_lineage_ref) throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    if (recordSet.operation_key.lineage_id !== expected.lineage_id || recordSet.operation_key.revision_id !== expected.revision_id) throw new Error("CAP04_A_LINEAGE_REVISION_MISMATCH");

    const state = await client.query(
      `SELECT state_object_id,lineage_id,revision_id,determinism_hash FROM twin_state_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    );
    if (state.rows.length !== 1 || state.rows[0].state_object_id !== expected.previous_state_ref) throw new Error("STATE_LATEST_CAS_CONFLICT");
    if (state.rows[0].lineage_id !== expected.lineage_id || state.rows[0].revision_id !== expected.revision_id) throw new Error("CAP04_A_LINEAGE_REVISION_MISMATCH");

    const checkpoint = await client.query(
      `SELECT checkpoint_object_id,lineage_id,revision_id,determinism_hash FROM twin_runtime_checkpoint_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    );
    if (checkpoint.rows.length !== 1 || checkpoint.rows[0].checkpoint_object_id !== expected.previous_checkpoint_ref) throw new Error("CHECKPOINT_CAS_CONFLICT");
    if (checkpoint.rows[0].lineage_id !== expected.lineage_id || checkpoint.rows[0].revision_id !== expected.revision_id) throw new Error("CAP04_A_LINEAGE_REVISION_MISMATCH");

    const forecast = await client.query(
      `SELECT forecast_object_id,determinism_hash FROM twin_forecast_result_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    );
    if (forecast.rows.length !== 1 || forecast.rows[0].forecast_object_id !== expected.previous_forecast_result_ref) throw new Error("FORECAST_RESULT_CAS_CONFLICT");

    const success = await client.query(
      `SELECT forecast_object_id,determinism_hash FROM twin_forecast_success_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    );
    if (expected.previous_successful_forecast_ref === null) {
      if (success.rows.length !== 0) throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
    } else if (success.rows.length !== 1 || success.rows[0].forecast_object_id !== expected.previous_successful_forecast_ref) {
      throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
    }

    const aggregate = recordSet.aggregate_identity_input;
    if (aggregate.previous_posterior_ref !== expected.previous_state_ref
      || aggregate.previous_checkpoint_ref !== expected.previous_checkpoint_ref
      || aggregate.previous_forecast_result_ref !== expected.previous_forecast_result_ref) {
      throw new Error("CAP04_A_AGGREGATE_PREDECESSOR_MISMATCH");
    }
    await this.verifyRuntimeConfigV1(client, aggregate.runtime_config_ref, aggregate.runtime_config_hash);
  }

  async lookupARecordSet(idempotencyKey: string): Promise<Cap04ARecordSetV1 | null> {
    const guard = await this.pool.query(
      `SELECT record_set_id FROM twin_object_idempotency_index_v1
       WHERE identity_kind IN ('A1_RECORD_SET','A2_RECORD_SET') AND idempotency_key=$1`,
      [idempotencyKey],
    );
    return guard.rows.length === 1 ? this.readARecordSet(guard.rows[0].record_set_id) : null;
  }

  private async readARecordSetWithClientV1(
    client: PoolClient,
    recordSetId: string,
  ): Promise<Cap04ARecordSetV1 | null> {
    const guard = await client.query(
      `SELECT identity_kind,idempotency_key,determinism_hash,identity_basis,member_object_ids
       FROM twin_object_idempotency_index_v1
       WHERE identity_kind IN ('A1_RECORD_SET','A2_RECORD_SET') AND record_set_id=$1`,
      [recordSetId],
    );
    if (guard.rows.length === 0) return null;
    if (guard.rows.length !== 1 || !guard.rows[0].identity_basis) throw new Error("CAP04_A_IDEMPOTENCY_GUARD_CORRUPT");
    const idsByType = guard.rows[0].member_object_ids as Record<string, string>;
    const ids = CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => idsByType[type]);
    if (ids.some((id) => typeof id !== "string" || !id)) throw new Error("CAP04_A_MEMBER_IDS_CORRUPT");
    const facts = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
      [ids],
    );
    if (facts.rows.length !== 8) throw new Error("IDEMPOTENT_RECORD_SET_INCOMPLETE");
    const membersUnordered = facts.rows.map((row) => {
      const object = parseFactObjectV1(row.record_json);
      if (object.object_type === "twin_scenario_set_v1") throw new Error("CAP04_A_MEMBER_SCENARIO_SET_FORBIDDEN");
      return object;
    });
    const members = CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => {
      const member = membersUnordered.find((candidate) => candidate.object_type === type);
      if (!member) throw new Error(`CAP04_A_MEMBER_MISSING:${type}`);
      return member;
    });
    const basis = guard.rows[0].identity_basis as Record<string, unknown>;
    const recordSet: Cap04ARecordSetV1 = {
      record_set_contract_id: basis.record_set_contract_id as Cap04ARecordSetV1["record_set_contract_id"],
      terminal_tick_uniqueness_key: basis.terminal_tick_uniqueness_key as Cap04ARecordSetV1["terminal_tick_uniqueness_key"],
      terminal_tick_uniqueness_key_hash: String(basis.terminal_tick_uniqueness_key_hash),
      operation_key: basis.operation_key as Cap04ARecordSetV1["operation_key"],
      operation_key_hash: String(basis.operation_key_hash),
      record_set_id: recordSetId,
      idempotency_key: guard.rows[0].idempotency_key,
      member_object_ids: idsByType as Cap04ARecordSetV1["member_object_ids"],
      aggregate_identity_input: basis.aggregate_identity_input as Cap04ARecordSetV1["aggregate_identity_input"],
      aggregate_determinism_hash: guard.rows[0].determinism_hash,
      members,
    };
    validateCap04ARecordSetV1(recordSet);
    return recordSet;
  }

  async readARecordSet(recordSetId: string): Promise<Cap04ARecordSetV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readARecordSetWithClientV1(client, recordSetId);
    } finally {
      client.release();
    }
  }

  async commitARecordSet(
    input: Parameters<Cap04ForecastScenarioPersistencePortV1["commitARecordSet"]>[0],
  ): Promise<Awaited<ReturnType<Cap04ForecastScenarioPersistencePortV1["commitARecordSet"]>>> {
    validateCap04ARecordSetV1(input.record_set);
    assertScopeV1(input.scope, input.record_set.operation_key.scope, "CAP04_A_INPUT_SCOPE_MISMATCH");
    const identityKind = identityKindForARecordSetV1(input.record_set);
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      inject("before_idempotency_index");
      const reservation = await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [
          identityKind,
          input.record_set.idempotency_key,
          input.record_set.record_set_id,
          input.record_set.aggregate_determinism_hash,
          JSON.stringify({
            record_set_contract_id: input.record_set.record_set_contract_id,
            terminal_tick_uniqueness_key: input.record_set.terminal_tick_uniqueness_key,
            terminal_tick_uniqueness_key_hash: input.record_set.terminal_tick_uniqueness_key_hash,
            operation_key: input.record_set.operation_key,
            operation_key_hash: input.record_set.operation_key_hash,
            aggregate_identity_input: input.record_set.aggregate_identity_input,
          }),
          JSON.stringify(input.record_set.member_object_ids),
          JSON.stringify(Object.fromEntries(input.record_set.members.map((member) => [member.object_id, member.determinism_hash]))),
        ],
      );
      if (reservation.rows.length === 0) {
        const existing = await client.query(
          "SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
          [input.record_set.idempotency_key],
        );
        if (existing.rows.length !== 1
          || existing.rows[0].record_set_id !== input.record_set.record_set_id
          || existing.rows[0].determinism_hash !== input.record_set.aggregate_determinism_hash) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        const recordSet = await this.readARecordSetWithClientV1(client, input.record_set.record_set_id);
        if (!recordSet) throw new Error("IDEMPOTENT_RECORD_SET_INCOMPLETE");
        await client.query("COMMIT");
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          record_set: recordSet,
          fact_ids_by_object_id: Object.fromEntries(recordSet.members.map((member) => [member.object_id, factIdV1(member.object_id)])),
        };
      }
      if (reservation.rows.length !== 1) throw new Error("CAP04_A_IDEMPOTENCY_RESERVATION_CARDINALITY");

      await this.verifyLeaseV1(client, input.scope, input.lease);
      await this.verifyAExpectedPointersV1(client, input.scope, input.expected, input.record_set);

      const tick = requireMemberV1(input.record_set, "twin_runtime_tick_v1");
      inject("before_terminal_uniqueness_guard");
      const terminalReservation = await client.query(
        `INSERT INTO twin_terminal_tick_uniqueness_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
          terminal_tick_uniqueness_key_hash,operation_variant,record_set_id,aggregate_determinism_hash,source_tick_object_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time)
         DO NOTHING
         RETURNING record_set_id`,
        [
          ...scopeValuesV1(input.scope),
          input.record_set.operation_key.lineage_id,
          input.record_set.operation_key.revision_id,
          input.record_set.operation_key.logical_time,
          input.record_set.terminal_tick_uniqueness_key_hash,
          input.record_set.operation_key.operation_variant,
          input.record_set.record_set_id,
          input.record_set.aggregate_determinism_hash,
          tick.object_id,
        ],
      );
      if (terminalReservation.rows.length !== 1) throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");

      const factIds: Record<string, string> = {};
      for (let index = 0; index < input.record_set.members.length; index += 1) {
        const member = input.record_set.members[index];
        inject(`before_fact_${index + 1}_${member.object_type}`);
        const id = factIdV1(member.object_id);
        factIds[member.object_id] = id;
        await client.query(
          "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
          [id, member.logical_time, recordJsonV1(member)],
        );
      }

      const state = requireMemberV1(input.record_set, "twin_state_estimate_v1");
      const forecast = requireMemberV1(input.record_set, "twin_forecast_run_v1");
      const checkpoint = requireMemberV1(input.record_set, "twin_runtime_checkpoint_v1");
      const health = requireMemberV1(input.record_set, "twin_runtime_health_v1");
      const forecastPayload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
      const forecastRows = buildCap04ForecastProjectionRowsV1(forecast, factIds[forecast.object_id]);

      inject("before_state_history_projection");
      await client.query(
        `INSERT INTO twin_state_history_projection_v1
         (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)`,
        [state.object_id, ...scopeValuesV1(input.scope), state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash, JSON.stringify(state.payload), factIds[state.object_id]],
      );

      inject("before_state_latest_projection");
      const stateUpdate = await client.query(
        `UPDATE twin_state_latest_index_v1 SET
           state_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND state_object_id=$13`,
        [...scopeValuesV1(input.scope), state.object_id, state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash, factIds[state.object_id], input.expected.previous_state_ref],
      );
      if (stateUpdate.rowCount !== 1) throw new Error("STATE_LATEST_CAS_CONFLICT");

      inject("before_forecast_result_projection");
      const forecastUpdate = await client.query(
        `UPDATE twin_forecast_result_latest_index_v1 SET
           forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND forecast_object_id=$12`,
        [...scopeValuesV1(input.scope), forecast.object_id, forecastPayload.status, forecast.logical_time, forecast.determinism_hash, factIds[forecast.object_id], input.expected.previous_forecast_result_ref],
      );
      if (forecastUpdate.rowCount !== 1) throw new Error("FORECAST_RESULT_CAS_CONFLICT");

      if (input.record_set.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1) {
        inject("before_forecast_success_projection");
        if (input.expected.previous_successful_forecast_ref === null) {
          await client.query(
            `INSERT INTO twin_forecast_success_latest_index_v1
             (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,logical_time,determinism_hash,source_fact_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10)`,
            [...scopeValuesV1(input.scope), forecast.object_id, forecast.logical_time, forecast.determinism_hash, factIds[forecast.object_id]],
          );
        } else {
          const successUpdate = await client.query(
            `UPDATE twin_forecast_success_latest_index_v1 SET
               forecast_object_id=$7,logical_time=$8::timestamptz,determinism_hash=$9,source_fact_id=$10
             WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
               AND forecast_object_id=$11`,
            [...scopeValuesV1(input.scope), forecast.object_id, forecast.logical_time, forecast.determinism_hash, factIds[forecast.object_id], input.expected.previous_successful_forecast_ref],
          );
          if (successUpdate.rowCount !== 1) throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
        }
      }

      inject("before_checkpoint_projection");
      const checkpointUpdate = await client.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1 SET
           checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND checkpoint_object_id=$13`,
        [...scopeValuesV1(input.scope), checkpoint.object_id, checkpoint.lineage_id, checkpoint.revision_id, checkpoint.logical_time, checkpoint.determinism_hash, factIds[checkpoint.object_id], input.expected.previous_checkpoint_ref],
      );
      if (checkpointUpdate.rowCount !== 1) throw new Error("CHECKPOINT_CAS_CONFLICT");

      inject("before_health_projection");
      const healthUpdate = await client.query(
        `UPDATE twin_runtime_health_latest_index_v1 SET
           health_object_id=$7,operation_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        [...scopeValuesV1(input.scope), health.object_id, String(health.payload.operation_status), health.logical_time, health.determinism_hash, factIds[health.object_id]],
      );
      if (healthUpdate.rowCount !== 1) throw new Error("HEALTH_LATEST_CAS_CONFLICT");

      inject("before_forecast_run_projection");
      await this.insertForecastProjectionRowsV1(client, forecastRows);

      inject("before_commit");
      await client.query("COMMIT");
      return {
        status: "INSERTED",
        record_set: input.record_set,
        fact_ids_by_object_id: factIds,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP04_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertForecastProjectionRowsV1(
    client: PoolClient,
    rows: ReturnType<typeof buildCap04ForecastProjectionRowsV1>,
  ): Promise<void> {
    const run = rows.run;
    await client.query(
      `INSERT INTO twin_forecast_run_projection_v1
       (forecast_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
        forecast_status,source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,forcing_window_hash,
        point_count,determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
      [
        run.forecast_object_id, run.tenant_id, run.project_id, run.group_id, run.field_id, run.season_id, run.zone_id,
        run.lineage_id, run.revision_id, run.logical_time, run.forecast_status, run.source_posterior_ref,
        run.source_posterior_hash, run.runtime_config_ref, run.runtime_config_hash, run.forcing_window_hash,
        run.point_count, run.determinism_hash, JSON.stringify(run.canonical_payload), run.source_fact_id,
      ],
    );
    for (const point of rows.points) {
      await client.query(
        `INSERT INTO twin_forecast_point_projection_v1
         (forecast_object_id,horizon_hour,target_time,storage_mean_mm,storage_variance_mm2,available_water_fraction,determinism_hash,canonical_point)
         VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8::jsonb)`,
        [point.forecast_object_id, point.horizon_hour, point.target_time, point.storage_mean_mm, point.storage_variance_mm2, point.available_water_fraction, point.determinism_hash, JSON.stringify(point.canonical_point)],
      );
    }
  }

  async lookupScenarioSet(idempotencyKey: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const guard = await this.pool.query(
      `SELECT record_set_id FROM twin_object_idempotency_index_v1
       WHERE identity_kind='B_SCENARIO_SET' AND idempotency_key=$1`,
      [idempotencyKey],
    );
    return guard.rows.length === 1 ? this.readScenarioSet(guard.rows[0].record_set_id) : null;
  }

  private async readScenarioSetWithClientV1(
    client: PoolClient,
    scenarioSetId: string,
  ): Promise<Cap04ScenarioSetRecordV1 | null> {
    const guard = await client.query(
      `SELECT idempotency_key,determinism_hash,identity_basis
       FROM twin_object_idempotency_index_v1
       WHERE identity_kind='B_SCENARIO_SET' AND record_set_id=$1`,
      [scenarioSetId],
    );
    if (guard.rows.length === 0) return null;
    if (guard.rows.length !== 1 || !guard.rows[0].identity_basis) throw new Error("CAP04_B_IDEMPOTENCY_GUARD_CORRUPT");
    const fact = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 LIMIT 2",
      [scenarioSetId],
    );
    if (fact.rows.length !== 1) throw new Error("IDEMPOTENT_SCENARIO_SET_INCOMPLETE");
    const scenarioSet = parseFactObjectV1(fact.rows[0].record_json);
    if (scenarioSet.object_type !== "twin_scenario_set_v1") throw new Error("CAP04_B_SCENARIO_OBJECT_TYPE_MISMATCH");
    const basis = guard.rows[0].identity_basis as Record<string, unknown>;
    const record: Cap04ScenarioSetRecordV1 = {
      record_set_contract_id: basis.record_set_contract_id as Cap04ScenarioSetRecordV1["record_set_contract_id"],
      transaction_variant: basis.transaction_variant as Cap04ScenarioSetRecordV1["transaction_variant"],
      scenario_set_uniqueness_key: basis.scenario_set_uniqueness_key as Cap04ScenarioSetRecordV1["scenario_set_uniqueness_key"],
      scenario_set_uniqueness_key_hash: String(basis.scenario_set_uniqueness_key_hash),
      operation_key: basis.operation_key as Cap04ScenarioSetRecordV1["operation_key"],
      operation_key_hash: String(basis.operation_key_hash),
      scenario_set_id: scenarioSetId,
      idempotency_key: guard.rows[0].idempotency_key,
      aggregate_determinism_hash: guard.rows[0].determinism_hash,
      scenario_set: scenarioSet,
    };
    const derived = deriveCap04ScenarioSetIdentityV1({
      uniqueness_key: record.scenario_set_uniqueness_key,
      scenario_policy_id: record.operation_key.scenario_policy_id,
      runtime_config_ref: record.operation_key.runtime_config_ref,
      runtime_config_hash: record.operation_key.runtime_config_hash,
      scenario_set_determinism_hash: scenarioSet.determinism_hash,
    });
    if (derived.scenario_set_id !== record.scenario_set_id
      || derived.idempotency_key !== record.idempotency_key
      || derived.aggregate_determinism_hash !== record.aggregate_determinism_hash) {
      throw new Error("CAP04_B_READBACK_IDENTITY_MISMATCH");
    }
    return record;
  }

  async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readScenarioSetWithClientV1(client, scenarioSetId);
    } finally {
      client.release();
    }
  }

  async readScenarioSetBySourceForecast(
    sourceForecastRef: string,
    sourceForecastHash: string,
  ): Promise<Cap04ScenarioSetRecordV1 | null> {
    const result = await this.pool.query(
      `SELECT scenario_set_id FROM twin_scenario_set_uniqueness_v1
       WHERE source_forecast_ref=$1 AND source_forecast_hash=$2 LIMIT 2`,
      [sourceForecastRef, sourceForecastHash],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP04_B_SOURCE_FORECAST_UNIQUENESS_CORRUPT");
    return this.readScenarioSet(String(result.rows[0].scenario_set_id));
  }

  async commitScenarioSet(
    input: Parameters<Cap04ForecastScenarioPersistencePortV1["commitScenarioSet"]>[0],
  ): Promise<Awaited<ReturnType<Cap04ForecastScenarioPersistencePortV1["commitScenarioSet"]>>> {
    const scenario = input.record.scenario_set;
    assertScopeV1(input.scope, scenario, "CAP04_B_INPUT_SCOPE_MISMATCH");
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      inject("before_scenario_idempotency_index");
      const reservation = await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ('B_SCENARIO_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [
          input.record.idempotency_key,
          input.record.scenario_set_id,
          input.record.aggregate_determinism_hash,
          JSON.stringify({
            record_set_contract_id: input.record.record_set_contract_id,
            transaction_variant: input.record.transaction_variant,
            scenario_set_uniqueness_key: input.record.scenario_set_uniqueness_key,
            scenario_set_uniqueness_key_hash: input.record.scenario_set_uniqueness_key_hash,
            operation_key: input.record.operation_key,
            operation_key_hash: input.record.operation_key_hash,
          }),
          JSON.stringify([scenario.object_id]),
          JSON.stringify({ [scenario.object_id]: scenario.determinism_hash }),
        ],
      );
      if (reservation.rows.length === 0) {
        const existing = await client.query(
          "SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
          [input.record.idempotency_key],
        );
        if (existing.rows.length !== 1
          || existing.rows[0].record_set_id !== input.record.scenario_set_id
          || existing.rows[0].determinism_hash !== input.record.aggregate_determinism_hash) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        const record = await this.readScenarioSetWithClientV1(client, input.record.scenario_set_id);
        if (!record) throw new Error("IDEMPOTENT_SCENARIO_SET_INCOMPLETE");
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS", record, fact_id: factIdV1(record.scenario_set_id) };
      }
      if (reservation.rows.length !== 1) throw new Error("CAP04_B_IDEMPOTENCY_RESERVATION_CARDINALITY");

      await this.verifyLeaseV1(client, input.scope, input.lease);
      const sourceForecast = await this.readCanonicalObjectWithClientV1(client, input.record.scenario_set_uniqueness_key.source_forecast_ref);
      if (!sourceForecast || sourceForecast.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_B_SOURCE_FORECAST_NOT_FOUND");
      if (sourceForecast.determinism_hash !== input.record.scenario_set_uniqueness_key.source_forecast_hash) throw new Error("CAP04_B_SOURCE_FORECAST_HASH_MISMATCH");
      validateCap04ForecastRunPayloadV1(sourceForecast.payload as unknown as Cap04ForecastRunPayloadV1);
      const sourcePayload = sourceForecast.payload as unknown as Cap04ForecastRunPayloadV1;
      if (sourcePayload.status !== "COMPLETED" || sourcePayload.scenario_eligible !== true) throw new Error("CAP04_B_COMPLETED_FORECAST_REQUIRED");
      validateCap04ScenarioSetRecordV1(input.record, sourceForecast);
      validateCap04ScenarioSetPayloadV1(scenario.payload, sourcePayload);
      await this.verifyRuntimeConfigV1(client, scenario.payload.runtime_config_ref, scenario.payload.runtime_config_hash);

      const latestSuccess = await client.query(
        `SELECT forecast_object_id,determinism_hash FROM twin_forecast_success_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
        scopeValuesV1(input.scope),
      );
      if (latestSuccess.rows.length !== 1
        || latestSuccess.rows[0].forecast_object_id !== sourceForecast.object_id
        || latestSuccess.rows[0].determinism_hash !== sourceForecast.determinism_hash) {
        throw new Error("CAP04_B_SOURCE_FORECAST_NOT_LATEST_SUCCESS");
      }


      inject("before_scenario_uniqueness_guard");
      const uniquenessReservation = await client.query(
        `INSERT INTO twin_scenario_set_uniqueness_v1
         (source_forecast_ref,source_forecast_hash,lineage_id,revision_id,scenario_set_uniqueness_key_hash,scenario_set_id,aggregate_determinism_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (source_forecast_ref,source_forecast_hash,lineage_id,revision_id)
         DO NOTHING
         RETURNING scenario_set_id`,
        [
          input.record.scenario_set_uniqueness_key.source_forecast_ref,
          input.record.scenario_set_uniqueness_key.source_forecast_hash,
          input.record.scenario_set_uniqueness_key.lineage_id,
          input.record.scenario_set_uniqueness_key.revision_id,
          input.record.scenario_set_uniqueness_key_hash,
          input.record.scenario_set_id,
          input.record.aggregate_determinism_hash,
        ],
      );
      if (uniquenessReservation.rows.length !== 1) throw new Error("SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT");

      const id = factIdV1(scenario.object_id);
      inject("before_scenario_fact");
      await client.query(
        "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
        [id, scenario.logical_time, recordJsonV1(scenario)],
      );
      const rows = buildCap04ScenarioProjectionRowsV1(input.record, sourcePayload, id);
      inject("before_scenario_projections");
      await this.insertScenarioProjectionRowsV1(client, rows);

      inject("before_commit");
      await client.query("COMMIT");
      return { status: "INSERTED", record: input.record, fact_id: id };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP04_PERSISTENCE_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertScenarioProjectionRowsV1(
    client: PoolClient,
    rows: ReturnType<typeof buildCap04ScenarioProjectionRowsV1>,
  ): Promise<void> {
    const set = rows.set;
    await client.query(
      `INSERT INTO twin_scenario_set_projection_v1
       (scenario_set_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
        source_forecast_ref,source_forecast_hash,source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,
        scenario_policy_id,option_count,determinism_hash,canonical_payload,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21)`,
      [
        set.scenario_set_id, set.tenant_id, set.project_id, set.group_id, set.field_id, set.season_id, set.zone_id,
        set.lineage_id, set.revision_id, set.logical_time, set.source_forecast_ref, set.source_forecast_hash,
        set.source_posterior_ref, set.source_posterior_hash, set.runtime_config_ref, set.runtime_config_hash,
        set.scenario_policy_id, set.option_count, set.determinism_hash, JSON.stringify(set.canonical_payload), set.source_fact_id,
      ],
    );
    for (const point of rows.points) {
      await client.query(
        `INSERT INTO twin_scenario_point_projection_v1
         (scenario_set_id,option_id,horizon_hour,target_time,storage_mean_mm,storage_variance_mm2,available_water_fraction,determinism_hash,canonical_point)
         VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9::jsonb)`,
        [point.scenario_set_id, point.option_id, point.horizon_hour, point.target_time, point.storage_mean_mm, point.storage_variance_mm2, point.available_water_fraction, point.determinism_hash, JSON.stringify(point.canonical_point)],
      );
    }
    const latest = rows.latest;
    const latestResult = await client.query(
      `INSERT INTO twin_scenario_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,scenario_set_id,source_forecast_ref,source_forecast_hash,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)
       ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
         scenario_set_id=EXCLUDED.scenario_set_id,
         source_forecast_ref=EXCLUDED.source_forecast_ref,
         source_forecast_hash=EXCLUDED.source_forecast_hash,
         logical_time=EXCLUDED.logical_time,
         determinism_hash=EXCLUDED.determinism_hash,
         source_fact_id=EXCLUDED.source_fact_id,
         updated_at=transaction_timestamp()
       WHERE twin_scenario_latest_index_v1.logical_time<=EXCLUDED.logical_time`,
      [
        latest.tenant_id, latest.project_id, latest.group_id, latest.field_id, latest.season_id, latest.zone_id,
        latest.scenario_set_id, latest.source_forecast_ref, latest.source_forecast_hash, latest.logical_time,
        latest.determinism_hash, latest.source_fact_id,
      ],
    );
    if (latestResult.rowCount !== 1) throw new Error("SCENARIO_LATEST_CAS_CONFLICT");
  }

  async detectPendingScenario(scope: TwinScopeKeyV1): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await this.pool.query(
      `SELECT f.record_json
       FROM twin_forecast_success_latest_index_v1 s
       JOIN facts f ON f.fact_id=s.source_fact_id
       LEFT JOIN twin_scenario_set_uniqueness_v1 u
         ON u.source_forecast_ref=s.forecast_object_id AND u.source_forecast_hash=s.determinism_hash
       WHERE s.tenant_id=$1 AND s.project_id=$2 AND s.group_id=$3 AND s.field_id=$4 AND s.season_id=$5 AND s.zone_id=$6
         AND u.scenario_set_id IS NULL`,
      scopeValuesV1(scope),
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("PENDING_SCENARIO_CARDINALITY_CONFLICT");
    const forecast = parseFactObjectV1(result.rows[0].record_json);
    if (forecast.object_type !== "twin_forecast_run_v1") throw new Error("PENDING_SCENARIO_FORECAST_TYPE_MISMATCH");
    validateCap04ForecastRunPayloadV1(forecast.payload as unknown as Cap04ForecastRunPayloadV1);
    return forecast;
  }

  async rebuildForecastProjections(recordSetId: string): Promise<{
    rebuilt_forecast_run_count: 1;
    rebuilt_forecast_point_count: 0 | 72;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const recordSet = await this.readARecordSetWithClientV1(client, recordSetId);
      if (!recordSet) throw new Error("CAP04_A_RECORD_SET_NOT_FOUND");
      const forecast = requireMemberV1(recordSet, "twin_forecast_run_v1");
      const rows = buildCap04ForecastProjectionRowsV1(forecast, factIdV1(forecast.object_id));
      await client.query("DELETE FROM twin_forecast_point_projection_v1 WHERE forecast_object_id=$1", [forecast.object_id]);
      await client.query("DELETE FROM twin_forecast_run_projection_v1 WHERE forecast_object_id=$1", [forecast.object_id]);
      await this.insertForecastProjectionRowsV1(client, rows);
      await client.query("COMMIT");
      return {
        rebuilt_forecast_run_count: 1,
        rebuilt_forecast_point_count: rows.points.length as 0 | 72,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rebuildScenarioProjections(scenarioSetId: string): Promise<{
    rebuilt_scenario_set_count: 1;
    rebuilt_scenario_point_count: 216;
    rebuilt_latest_count: 1;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const record = await this.readScenarioSetWithClientV1(client, scenarioSetId);
      if (!record) throw new Error("CAP04_B_SCENARIO_SET_NOT_FOUND");
      const sourceForecast = await this.readCanonicalObjectWithClientV1(client, record.scenario_set_uniqueness_key.source_forecast_ref);
      if (!sourceForecast || sourceForecast.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_B_SOURCE_FORECAST_NOT_FOUND");
      const sourcePayload = sourceForecast.payload as unknown as Cap04ForecastRunPayloadV1;
      validateCap04ForecastRunPayloadV1(sourcePayload);
      const rows = buildCap04ScenarioProjectionRowsV1(record, sourcePayload, factIdV1(record.scenario_set_id));
      await client.query("DELETE FROM twin_scenario_point_projection_v1 WHERE scenario_set_id=$1", [scenarioSetId]);
      await client.query("DELETE FROM twin_scenario_set_projection_v1 WHERE scenario_set_id=$1", [scenarioSetId]);
      await client.query(
        `DELETE FROM twin_scenario_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND scenario_set_id=$7`,
        [...scopeValuesV1({
          tenant_id: record.scenario_set.tenant_id,
          project_id: record.scenario_set.project_id,
          group_id: String(record.scenario_set.group_id),
          field_id: record.scenario_set.field_id,
          season_id: String(record.scenario_set.season_id),
          zone_id: String(record.scenario_set.zone_id),
        }), scenarioSetId],
      );
      await this.insertScenarioProjectionRowsV1(client, rows);
      await client.query("COMMIT");
      return {
        rebuilt_scenario_set_count: 1,
        rebuilt_scenario_point_count: 216,
        rebuilt_latest_count: 1,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
