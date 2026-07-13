// apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts
// Purpose: extend the proven CAP-04 PostgreSQL transaction repository with canonical-facts Tick-root and Scenario-Set recovery, guard self-repair, and checkpoint-authoritative pending-Scenario detection.
// Boundary: persistence recovery and guard repair only; normal atomic writes remain delegated to PostgresForecastScenarioRepositoryV1 and no Evidence selection, Forecast math, Scenario math, route, scheduler, filesystem, environment, or wall-clock authority is introduced.

import type { Pool, PoolClient } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  validateCap04ForecastRunPayloadV1,
  type Cap04AMemberObjectTypeV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  computeCap04AAggregateDeterminismHashV1,
  deriveCap04ARecordSetIdentityV1,
  deriveCap04ScenarioSetIdentityV1,
  type Cap04AAggregateIdentityInputV1,
  type Cap04AOperationVariantV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  materializeCap04TickRecoveryAuthorityV1,
  readCap04TickRecoveryAuthorityV1,
} from "../../domain/twin_runtime/forecast_record_set_recovery_authority_v1.js";
import { PostgresForecastScenarioRepositoryV1 } from "./postgres_forecast_scenario_repository_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string" ? JSON.parse(recordJsonValue) : recordJsonValue;
  const object = (parsed as { payload?: CanonicalObjectEnvelopeV1 })?.payload;
  if (!object || typeof object !== "object") throw new Error("CAP04_RECOVERY_CANONICAL_FACT_PAYLOAD_MISSING");
  return object;
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function requireCanonicalMemberV1(
  members: readonly CanonicalObjectEnvelopeV1[],
  objectType: Cap04AMemberObjectTypeV1,
): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_RECOVERY_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function identityKindV1(recordSet: Cap04ARecordSetV1): "A1_RECORD_SET" | "A2_RECORD_SET" {
  return recordSet.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1
    ? "A1_RECORD_SET"
    : "A2_RECORD_SET";
}

function stringFieldV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export class PostgresForecastScenarioRecoveryRepositoryV1 extends PostgresForecastScenarioRepositoryV1 {
  constructor(private readonly recoveryPool: Pool) {
    super(recoveryPool);
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
    if (result.rows.length !== 1) throw new Error("CAP04_RECOVERY_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type === "twin_scenario_set_v1") throw new Error("CAP04_RECOVERY_UNEXPECTED_SCENARIO_SET");
    return object;
  }

  private async findTickByIdempotencyWithClientV1(
    client: PoolClient,
    idempotencyKey: string,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_type'='twin_runtime_tick_v1'
         AND record_json->'payload'->'payload'->'recovery_authority'->>'record_set_idempotency_key'=$1
       LIMIT 2`,
      [idempotencyKey],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP04_RECOVERY_TICK_IDEMPOTENCY_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type !== "twin_runtime_tick_v1") throw new Error("CAP04_RECOVERY_TICK_TYPE_MISMATCH");
    return object;
  }

  private async findTickByRecordSetIdWithClientV1(
    client: PoolClient,
    recordSetId: string,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_type'='twin_runtime_tick_v1'
         AND record_json->'payload'->'payload'->'recovery_authority'->>'record_set_id'=$1
       LIMIT 2`,
      [recordSetId],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP04_RECOVERY_TICK_RECORD_SET_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type !== "twin_runtime_tick_v1") throw new Error("CAP04_RECOVERY_TICK_TYPE_MISMATCH");
    return object;
  }

  private async findTerminalTickWithClientV1(
    client: PoolClient,
    recordSet: Cap04ARecordSetV1,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const key = recordSet.terminal_tick_uniqueness_key;
    const result = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_type'='twin_runtime_tick_v1'
         AND record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
         AND record_json->'payload'->>'lineage_id'=$7
         AND record_json->'payload'->>'revision_id'=$8
         AND record_json->'payload'->>'logical_time'=$9
         AND record_json->'payload'->'payload' ? 'recovery_authority'
       LIMIT 2`,
      [...scopeValuesV1(key.scope), key.lineage_id, key.revision_id, key.logical_time],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP04_RECOVERY_TERMINAL_TICK_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type !== "twin_runtime_tick_v1") throw new Error("CAP04_RECOVERY_TICK_TYPE_MISMATCH");
    return object;
  }

  private async reconstructAFromTickWithClientV1(
    client: PoolClient,
    tick: CanonicalObjectEnvelopeV1,
  ): Promise<Cap04ARecordSetV1> {
    const authority = readCap04TickRecoveryAuthorityV1(tick);
    const operationVariant = tick.payload.operation_variant as Cap04AOperationVariantV1;
    if (operationVariant !== CAP04_A1_OPERATION_VARIANT_V1 && operationVariant !== CAP04_A2_OPERATION_VARIANT_V1) {
      throw new Error("CAP04_RECOVERY_OPERATION_VARIANT_MISMATCH");
    }
    const operationKey = {
      scope: {
        tenant_id: tick.tenant_id,
        project_id: tick.project_id,
        group_id: tick.group_id,
        field_id: tick.field_id,
        season_id: tick.season_id,
        zone_id: tick.zone_id,
      },
      lineage_id: stringFieldV1(tick.lineage_id, "CAP04_RECOVERY_LINEAGE_REQUIRED"),
      revision_id: stringFieldV1(tick.revision_id, "CAP04_RECOVERY_REVISION_REQUIRED"),
      logical_time: tick.logical_time,
      operation_variant: operationVariant,
    };
    const identity = deriveCap04ARecordSetIdentityV1(operationKey);
    if (identity.record_set_id !== authority.record_set_id
      || identity.idempotency_key !== authority.record_set_idempotency_key
      || identity.record_set_id !== String(tick.payload.record_set_id)) {
      throw new Error("CAP04_RECOVERY_TICK_IDENTITY_MISMATCH");
    }
    const directIds: Record<Cap04AMemberObjectTypeV1, string> = {
      twin_evidence_window_v1: stringFieldV1(tick.payload.evidence_window_ref, "CAP04_RECOVERY_EVIDENCE_REF_REQUIRED"),
      twin_state_transition_v1: stringFieldV1(tick.payload.state_transition_ref, "CAP04_RECOVERY_TRANSITION_REF_REQUIRED"),
      twin_assimilation_update_v1: stringFieldV1(tick.payload.assimilation_update_ref, "CAP04_RECOVERY_ASSIMILATION_REF_REQUIRED"),
      twin_state_estimate_v1: stringFieldV1(tick.payload.posterior_state_ref, "CAP04_RECOVERY_STATE_REF_REQUIRED"),
      twin_forecast_run_v1: stringFieldV1(tick.payload.forecast_result_ref, "CAP04_RECOVERY_FORECAST_REF_REQUIRED"),
      twin_runtime_tick_v1: tick.object_id,
      twin_runtime_checkpoint_v1: stringFieldV1(tick.payload.checkpoint_ref, "CAP04_RECOVERY_CHECKPOINT_REF_REQUIRED"),
      twin_runtime_health_v1: "",
    };
    const healthResult = await client.query(
      `SELECT record_json FROM facts
       WHERE record_json->'payload'->>'object_type'='twin_runtime_health_v1'
         AND record_json->'payload'->'payload'->>'tick_ref'=$1
       LIMIT 2`,
      [tick.object_id],
    );
    if (healthResult.rows.length !== 1) throw new Error("CAP04_RECOVERY_HEALTH_REVERSE_CARDINALITY");
    const health = parseFactObjectV1(healthResult.rows[0].record_json);
    if (health.object_type === "twin_scenario_set_v1") throw new Error("CAP04_RECOVERY_HEALTH_TYPE_MISMATCH");
    directIds.twin_runtime_health_v1 = health.object_id;
    for (const type of CAP04_A_MEMBER_OBJECT_TYPES_V1) {
      if (directIds[type] !== identity.member_object_ids[type]) throw new Error(`CAP04_RECOVERY_MEMBER_ID_MISMATCH:${type}`);
    }
    const facts = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
      [CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => directIds[type])],
    );
    if (facts.rows.length !== CAP04_A_MEMBER_OBJECT_TYPES_V1.length) throw new Error("CAP04_RECOVERY_MEMBER_FACT_SET_INCOMPLETE");
    const unordered = facts.rows.map((row) => {
      const object = parseFactObjectV1(row.record_json);
      if (object.object_type === "twin_scenario_set_v1") throw new Error("CAP04_RECOVERY_A_MEMBER_SCENARIO_FORBIDDEN");
      return object;
    });
    const members = CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => requireCanonicalMemberV1(unordered, type));
    const evidence = requireCanonicalMemberV1(members, "twin_evidence_window_v1");
    const assimilation = requireCanonicalMemberV1(members, "twin_assimilation_update_v1");
    const state = requireCanonicalMemberV1(members, "twin_state_estimate_v1");
    const forecast = requireCanonicalMemberV1(members, "twin_forecast_run_v1");
    const forecastPayload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
    validateCap04ForecastRunPayloadV1(forecastPayload);
    const memberHashes = Object.fromEntries(members.map((member) => [member.object_type, member.determinism_hash])) as Record<Cap04AMemberObjectTypeV1, string>;
    const aggregateInput: Cap04AAggregateIdentityInputV1 = {
      record_set_contract_id: identity.record_set_contract_id,
      operation_key: operationKey,
      previous_posterior_ref: authority.previous_posterior_ref,
      previous_posterior_hash: authority.previous_posterior_hash,
      previous_checkpoint_ref: authority.previous_checkpoint_ref,
      previous_checkpoint_hash: authority.previous_checkpoint_hash,
      previous_forecast_result_ref: authority.previous_forecast_result_ref,
      previous_forecast_result_hash: authority.previous_forecast_result_hash,
      runtime_config_ref: authority.runtime_config_ref,
      runtime_config_hash: authority.runtime_config_hash,
      evidence_window_hash: evidence.determinism_hash,
      assimilation_update_hash: assimilation.determinism_hash,
      posterior_state_hash: state.determinism_hash,
      forcing_window_hash: forecastPayload.forcing_window_hash,
      forecast_point_hashes: forecastPayload.points.map((point) => point.determinism_hash),
      member_determinism_hashes: memberHashes,
    };
    const aggregateHash = computeCap04AAggregateDeterminismHashV1(aggregateInput);
    if (aggregateHash !== tick.payload.aggregate_determinism_hash) throw new Error("CAP04_RECOVERY_AGGREGATE_HASH_MISMATCH");
    const recordSet: Cap04ARecordSetV1 = {
      ...identity,
      aggregate_identity_input: aggregateInput,
      aggregate_determinism_hash: aggregateHash,
      members,
    };
    validateCap04ARecordSetV1(recordSet);
    return recordSet;
  }

  private async repairAGuardsWithClientV1(
    client: PoolClient,
    recordSet: Cap04ARecordSetV1,
  ): Promise<void> {
    const tick = requireCanonicalMemberV1(recordSet.members, "twin_runtime_tick_v1");
    const terminal = await client.query(
      `SELECT record_set_id,aggregate_determinism_hash FROM twin_terminal_tick_uniqueness_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND lineage_id=$7 AND revision_id=$8 AND logical_time=$9::timestamptz FOR UPDATE`,
      [...scopeValuesV1(recordSet.operation_key.scope), recordSet.operation_key.lineage_id, recordSet.operation_key.revision_id, recordSet.operation_key.logical_time],
    );
    if (terminal.rows.length === 0) {
      await client.query(
        `INSERT INTO twin_terminal_tick_uniqueness_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
          terminal_tick_uniqueness_key_hash,operation_variant,record_set_id,aggregate_determinism_hash,source_tick_object_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14)`,
        [
          ...scopeValuesV1(recordSet.operation_key.scope),
          recordSet.operation_key.lineage_id,
          recordSet.operation_key.revision_id,
          recordSet.operation_key.logical_time,
          recordSet.terminal_tick_uniqueness_key_hash,
          recordSet.operation_key.operation_variant,
          recordSet.record_set_id,
          recordSet.aggregate_determinism_hash,
          tick.object_id,
        ],
      );
    } else if (terminal.rows.length !== 1
      || terminal.rows[0].record_set_id !== recordSet.record_set_id
      || terminal.rows[0].aggregate_determinism_hash !== recordSet.aggregate_determinism_hash) {
      throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");
    }
    const guard = await client.query(
      `SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1
       WHERE idempotency_key=$1 FOR UPDATE`,
      [recordSet.idempotency_key],
    );
    if (guard.rows.length === 0) {
      await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
        [
          identityKindV1(recordSet),
          recordSet.idempotency_key,
          recordSet.record_set_id,
          recordSet.aggregate_determinism_hash,
          JSON.stringify({
            record_set_contract_id: recordSet.record_set_contract_id,
            terminal_tick_uniqueness_key: recordSet.terminal_tick_uniqueness_key,
            terminal_tick_uniqueness_key_hash: recordSet.terminal_tick_uniqueness_key_hash,
            operation_key: recordSet.operation_key,
            operation_key_hash: recordSet.operation_key_hash,
            aggregate_identity_input: recordSet.aggregate_identity_input,
          }),
          JSON.stringify(recordSet.member_object_ids),
          JSON.stringify(Object.fromEntries(recordSet.members.map((member) => [member.object_id, member.determinism_hash]))),
        ],
      );
    } else if (guard.rows.length !== 1
      || guard.rows[0].record_set_id !== recordSet.record_set_id
      || guard.rows[0].determinism_hash !== recordSet.aggregate_determinism_hash) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
  }

  private async recoverAByTickWithTransactionV1(
    tick: CanonicalObjectEnvelopeV1,
  ): Promise<Cap04ARecordSetV1> {
    const client = await this.recoveryPool.connect();
    try {
      await client.query("BEGIN");
      const recordSet = await this.reconstructAFromTickWithClientV1(client, tick);
      await this.repairAGuardsWithClientV1(client, recordSet);
      await client.query("COMMIT");
      return recordSet;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  override async lookupARecordSet(idempotencyKey: string): Promise<Cap04ARecordSetV1 | null> {
    const guarded = await super.lookupARecordSet(idempotencyKey);
    if (guarded) return guarded;
    const client = await this.recoveryPool.connect();
    try {
      const tick = await this.findTickByIdempotencyWithClientV1(client, idempotencyKey);
      if (!tick) return null;
      return await this.recoverAByTickWithTransactionV1(tick);
    } finally {
      client.release();
    }
  }

  override async readARecordSet(recordSetId: string): Promise<Cap04ARecordSetV1 | null> {
    const guarded = await super.readARecordSet(recordSetId);
    if (guarded) return guarded;
    const client = await this.recoveryPool.connect();
    try {
      const tick = await this.findTickByRecordSetIdWithClientV1(client, recordSetId);
      if (!tick) return null;
      return await this.recoverAByTickWithTransactionV1(tick);
    } finally {
      client.release();
    }
  }

  override async commitARecordSet(
    input: Parameters<PostgresForecastScenarioRepositoryV1["commitARecordSet"]>[0],
  ): Promise<Awaited<ReturnType<PostgresForecastScenarioRepositoryV1["commitARecordSet"]>>> {
    const materialized = materializeCap04TickRecoveryAuthorityV1(input.record_set);
    const client = await this.recoveryPool.connect();
    try {
      const terminalTick = await this.findTerminalTickWithClientV1(client, materialized);
      if (terminalTick) {
        const existing = await this.recoverAByTickWithTransactionV1(terminalTick);
        if (existing.idempotency_key !== materialized.idempotency_key
          || existing.aggregate_determinism_hash !== materialized.aggregate_determinism_hash) {
          throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");
        }
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          record_set: existing,
          fact_ids_by_object_id: Object.fromEntries(existing.members.map((member) => [member.object_id, factIdV1(member.object_id)])),
        };
      }
    } finally {
      client.release();
    }
    return super.commitARecordSet({ ...input, record_set: materialized });
  }

  private async reconstructScenarioRecordV1(
    scenarioSet: Cap04ScenarioSetEnvelopeV1,
  ): Promise<Cap04ScenarioSetRecordV1> {
    const payload = scenarioSet.payload;
    const identity = deriveCap04ScenarioSetIdentityV1({
      uniqueness_key: {
        source_forecast_ref: payload.source_forecast_ref,
        source_forecast_hash: payload.source_forecast_hash,
        lineage_id: stringFieldV1(scenarioSet.lineage_id, "CAP04_RECOVERY_SCENARIO_LINEAGE_REQUIRED"),
        revision_id: stringFieldV1(scenarioSet.revision_id, "CAP04_RECOVERY_SCENARIO_REVISION_REQUIRED"),
      },
      scenario_policy_id: payload.scenario_policy_id,
      runtime_config_ref: payload.runtime_config_ref,
      runtime_config_hash: payload.runtime_config_hash,
      scenario_set_determinism_hash: scenarioSet.determinism_hash,
    });
    if (identity.scenario_set_id !== scenarioSet.object_id || identity.idempotency_key !== scenarioSet.idempotency_key) {
      throw new Error("CAP04_RECOVERY_SCENARIO_IDENTITY_MISMATCH");
    }
    const record: Cap04ScenarioSetRecordV1 = { ...identity, scenario_set: scenarioSet };
    const client = await this.recoveryPool.connect();
    try {
      const sourceForecast = await this.readCanonicalObjectWithClientV1(client, payload.source_forecast_ref);
      if (!sourceForecast || sourceForecast.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_RECOVERY_SCENARIO_SOURCE_FORECAST_NOT_FOUND");
      if (sourceForecast.determinism_hash !== payload.source_forecast_hash) throw new Error("CAP04_RECOVERY_SCENARIO_SOURCE_FORECAST_HASH_MISMATCH");
      validateCap04ScenarioSetRecordV1(record, sourceForecast);
    } finally {
      client.release();
    }
    return record;
  }

  private async findScenarioFactV1(input: {
    scenario_set_id?: string;
    idempotency_key?: string;
    source_forecast_ref?: string;
    source_forecast_hash?: string;
  }): Promise<Cap04ScenarioSetEnvelopeV1 | null> {
    const clauses = ["record_json->'payload'->>'object_type'='twin_scenario_set_v1'"];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown): void => {
      values.push(value);
      clauses.push(sql.replace("?", `$${values.length}`));
    };
    if (input.scenario_set_id) add("record_json->'payload'->>'object_id'=?", input.scenario_set_id);
    if (input.idempotency_key) add("record_json->'payload'->>'idempotency_key'=?", input.idempotency_key);
    if (input.source_forecast_ref) add("record_json->'payload'->'payload'->>'source_forecast_ref'=?", input.source_forecast_ref);
    if (input.source_forecast_hash) add("record_json->'payload'->'payload'->>'source_forecast_hash'=?", input.source_forecast_hash);
    const result = await this.recoveryPool.query(
      `SELECT record_json FROM facts WHERE ${clauses.join(" AND ")} LIMIT 2`,
      values,
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP04_RECOVERY_SCENARIO_FACT_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type !== "twin_scenario_set_v1") throw new Error("CAP04_RECOVERY_SCENARIO_TYPE_MISMATCH");
    return object;
  }

  private async repairScenarioGuardsV1(record: Cap04ScenarioSetRecordV1): Promise<void> {
    const client = await this.recoveryPool.connect();
    try {
      await client.query("BEGIN");
      const uniqueness = await client.query(
        `SELECT scenario_set_id,aggregate_determinism_hash FROM twin_scenario_set_uniqueness_v1
         WHERE source_forecast_ref=$1 AND source_forecast_hash=$2 AND lineage_id=$3 AND revision_id=$4 FOR UPDATE`,
        [
          record.scenario_set_uniqueness_key.source_forecast_ref,
          record.scenario_set_uniqueness_key.source_forecast_hash,
          record.scenario_set_uniqueness_key.lineage_id,
          record.scenario_set_uniqueness_key.revision_id,
        ],
      );
      if (uniqueness.rows.length === 0) {
        await client.query(
          `INSERT INTO twin_scenario_set_uniqueness_v1
           (source_forecast_ref,source_forecast_hash,lineage_id,revision_id,scenario_set_uniqueness_key_hash,scenario_set_id,aggregate_determinism_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            record.scenario_set_uniqueness_key.source_forecast_ref,
            record.scenario_set_uniqueness_key.source_forecast_hash,
            record.scenario_set_uniqueness_key.lineage_id,
            record.scenario_set_uniqueness_key.revision_id,
            record.scenario_set_uniqueness_key_hash,
            record.scenario_set_id,
            record.aggregate_determinism_hash,
          ],
        );
      } else if (uniqueness.rows.length !== 1
        || uniqueness.rows[0].scenario_set_id !== record.scenario_set_id
        || uniqueness.rows[0].aggregate_determinism_hash !== record.aggregate_determinism_hash) {
        throw new Error("SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT");
      }
      const guard = await client.query(
        `SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1
         WHERE idempotency_key=$1 FOR UPDATE`,
        [record.idempotency_key],
      );
      if (guard.rows.length === 0) {
        await client.query(
          `INSERT INTO twin_object_idempotency_index_v1
           (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
           VALUES ('B_SCENARIO_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
          [
            record.idempotency_key,
            record.scenario_set_id,
            record.aggregate_determinism_hash,
            JSON.stringify({
              record_set_contract_id: record.record_set_contract_id,
              transaction_variant: record.transaction_variant,
              scenario_set_uniqueness_key: record.scenario_set_uniqueness_key,
              scenario_set_uniqueness_key_hash: record.scenario_set_uniqueness_key_hash,
              operation_key: record.operation_key,
              operation_key_hash: record.operation_key_hash,
            }),
            JSON.stringify([record.scenario_set.object_id]),
            JSON.stringify({ [record.scenario_set.object_id]: record.scenario_set.determinism_hash }),
          ],
        );
      } else if (guard.rows.length !== 1
        || guard.rows[0].record_set_id !== record.scenario_set_id
        || guard.rows[0].determinism_hash !== record.aggregate_determinism_hash) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  override async lookupScenarioSet(idempotencyKey: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const guarded = await super.lookupScenarioSet(idempotencyKey);
    if (guarded) return guarded;
    const fact = await this.findScenarioFactV1({ idempotency_key: idempotencyKey });
    if (!fact) return null;
    const record = await this.reconstructScenarioRecordV1(fact);
    await this.repairScenarioGuardsV1(record);
    return record;
  }

  override async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const guarded = await super.readScenarioSet(scenarioSetId);
    if (guarded) return guarded;
    const fact = await this.findScenarioFactV1({ scenario_set_id: scenarioSetId });
    if (!fact) return null;
    const record = await this.reconstructScenarioRecordV1(fact);
    await this.repairScenarioGuardsV1(record);
    return record;
  }

  override async readScenarioSetBySourceForecast(
    sourceForecastRef: string,
    sourceForecastHash: string,
  ): Promise<Cap04ScenarioSetRecordV1 | null> {
    const guarded = await super.readScenarioSetBySourceForecast(sourceForecastRef, sourceForecastHash);
    if (guarded) return guarded;
    const fact = await this.findScenarioFactV1({ source_forecast_ref: sourceForecastRef, source_forecast_hash: sourceForecastHash });
    if (!fact) return null;
    const record = await this.reconstructScenarioRecordV1(fact);
    await this.repairScenarioGuardsV1(record);
    return record;
  }

  override async commitScenarioSet(
    input: Parameters<PostgresForecastScenarioRepositoryV1["commitScenarioSet"]>[0],
  ): Promise<Awaited<ReturnType<PostgresForecastScenarioRepositoryV1["commitScenarioSet"]>>> {
    const existing = await this.findScenarioFactV1({
      source_forecast_ref: input.record.scenario_set_uniqueness_key.source_forecast_ref,
      source_forecast_hash: input.record.scenario_set_uniqueness_key.source_forecast_hash,
    });
    if (existing) {
      const record = await this.reconstructScenarioRecordV1(existing);
      if (record.idempotency_key !== input.record.idempotency_key
        || record.aggregate_determinism_hash !== input.record.aggregate_determinism_hash) {
        throw new Error("SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT");
      }
      await this.repairScenarioGuardsV1(record);
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record, fact_id: factIdV1(record.scenario_set_id) };
    }
    return super.commitScenarioSet(input);
  }

  override async detectPendingScenario(scope: TwinScopeKeyV1): Promise<CanonicalObjectEnvelopeV1 | null> {
    const checkpointResult = await this.recoveryPool.query(
      `SELECT f.record_json
       FROM twin_runtime_checkpoint_latest_index_v1 c
       JOIN facts f ON f.fact_id=c.source_fact_id
       WHERE c.tenant_id=$1 AND c.project_id=$2 AND c.group_id=$3 AND c.field_id=$4 AND c.season_id=$5 AND c.zone_id=$6`,
      scopeValuesV1(scope),
    );
    if (checkpointResult.rows.length !== 1) throw new Error("PENDING_SCENARIO_CHECKPOINT_CARDINALITY_CONFLICT");
    const checkpoint = parseFactObjectV1(checkpointResult.rows[0].record_json);
    if (checkpoint.object_type === "twin_scenario_set_v1" || checkpoint.object_type !== "twin_runtime_checkpoint_v1") {
      throw new Error("PENDING_SCENARIO_CHECKPOINT_TYPE_MISMATCH");
    }
    const forecastRef = stringFieldV1(checkpoint.payload.forecast_result_ref, "PENDING_SCENARIO_CHECKPOINT_FORECAST_REF_REQUIRED");
    const forecast = await this.readCanonicalObjectWithClientV1(await this.recoveryPool.connect(), forecastRef).catch((error) => { throw error; });
    if (!forecast || forecast.object_type !== "twin_forecast_run_v1") throw new Error("PENDING_SCENARIO_FORECAST_NOT_FOUND");
    const payload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
    validateCap04ForecastRunPayloadV1(payload);
    if (payload.status === "BLOCKED" || payload.scenario_eligible !== true) return null;
    return (await this.readScenarioSetBySourceForecast(forecast.object_id, forecast.determinism_hash)) ? null : forecast;
  }
}
