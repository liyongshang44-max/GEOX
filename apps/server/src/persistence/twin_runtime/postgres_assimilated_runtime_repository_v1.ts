// apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts
// Purpose: extend the immutable CAP-02 PostgreSQL repository with CAP-03 assimilated A2 commit, canonical readback, idempotency, CAS, fencing, and five-projection rebuild on the existing A2 transaction family.
// Boundary: persistence only; no Evidence selection, assimilation math, candidate construction, Runtime tick orchestration, range execution, routes, schedulers, web, successful Forecast, Scenario, Recommendation, or action.

import type { Pool, PoolClient } from "pg";
import { ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import type { AssimilatedContinuationRecordSetV1 } from "../../domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationMemberV1 } from "../../domain/twin_runtime/continuation_contracts_v1.js";
import { validateVersionedContinuationRecordSetV1 } from "../../domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import {
  buildContinuationProjectionRowsV1,
  type CanonicalFactReadV1,
} from "../../projections/twin_runtime/projection_rebuilder_v1.js";
import type {
  AssimilatedContinuationPersistencePortV1,
  ContinuationExpectedPointersV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../runtime/twin_runtime/ports.js";
import { PostgresRuntimeRepositoryV1 } from "./postgres_runtime_repository_v1.js";

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string"
    ? JSON.parse(recordJsonValue)
    : recordJsonValue;
  return (parsed as { payload: CanonicalObjectEnvelopeV1 }).payload;
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

function requireMemberV1(
  recordSet: AssimilatedContinuationRecordSetV1,
  objectType: CanonicalObjectEnvelopeV1["object_type"],
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) {
    throw new Error(`CONTINUATION_MEMBER_TYPE_CARDINALITY:${objectType}`);
  }
  return matches[0];
}

function assertScopeMatchesV1(
  scope: TwinScopeKeyV1,
  recordSet: AssimilatedContinuationRecordSetV1,
): void {
  const operationScope = recordSet.continuation_operation_key.scope;
  for (const key of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (scope[key] !== operationScope[key]) {
      throw new Error(`CONTINUATION_INPUT_SCOPE_MISMATCH:${key}`);
    }
  }
}

export class PostgresAssimilatedRuntimeRepositoryV1
  extends PostgresRuntimeRepositoryV1
  implements AssimilatedContinuationPersistencePortV1 {
  constructor(private readonly poolV1: Pool) {
    super(poolV1);
  }

  async lookupAssimilatedContinuationRecordSet(
    idempotencyKey: string,
  ): Promise<AssimilatedContinuationRecordSetV1 | null> {
    const guard = await this.poolV1.query(
      "SELECT record_set_id FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND idempotency_key=$1",
      [idempotencyKey],
    );
    return guard.rows.length
      ? this.readAssimilatedContinuationRecordSet(guard.rows[0].record_set_id)
      : null;
  }

  private async verifyLeaseV1(
    client: PoolClient,
    scope: TwinScopeKeyV1,
    lease: RuntimeLeaseClaimV1,
  ): Promise<void> {
    const result = await client.query(
      "SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      scopeValuesV1(scope),
    );
    if (!result.rows.length || result.rows[0].lease_owner !== lease.lease_owner) {
      throw new Error("LEASE_OWNER_MISMATCH");
    }
    if (BigInt(result.rows[0].fencing_token) !== lease.fencing_token) {
      throw new Error("STALE_FENCING_TOKEN");
    }
    if (!result.rows[0].valid) throw new Error("LEASE_EXPIRED");
  }

  private async readCanonicalObjectWithClientV1(
    client: PoolClient,
    objectId: string,
    validator: (object: CanonicalObjectEnvelopeV1) => void = validateCanonicalObjectV1,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 LIMIT 2",
      [objectId],
    );
    if (!result.rows.length) return null;
    if (result.rows.length !== 1) throw new Error("CANONICAL_OBJECT_ID_NOT_UNIQUE");
    const object = parseFactObjectV1(result.rows[0].record_json);
    validator(object);
    return object;
  }

  private async verifyRuntimeConfigReferenceV1(
    client: PoolClient,
    objectId: string,
    determinismHash: string,
  ): Promise<CanonicalObjectEnvelopeV1> {
    const config = await this.readCanonicalObjectWithClientV1(client, objectId);
    if (!config || config.object_type !== "twin_runtime_config_v1") {
      throw new Error("RUNTIME_CONFIG_NOT_FOUND");
    }
    if (config.determinism_hash !== determinismHash) {
      throw new Error("RUNTIME_CONFIG_HASH_MISMATCH");
    }
    return config;
  }

  private async readAssimilatedContinuationRecordSetWithClientV1(
    client: PoolClient,
    recordSetId: string,
  ): Promise<AssimilatedContinuationRecordSetV1 | null> {
    const guard = await client.query(
      "SELECT idempotency_key,determinism_hash,identity_basis,member_object_ids FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
      [recordSetId],
    );
    if (!guard.rows.length || !guard.rows[0].identity_basis) return null;
    const identityBasis = guard.rows[0].identity_basis as Record<string, unknown>;
    if (
      identityBasis.record_set_contract_id
      !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1
    ) {
      throw new Error("ASSIMILATED_RECORD_SET_CONTRACT_MISMATCH");
    }
    const ids: string[] = guard.rows[0].member_object_ids;
    const facts = await client.query(
      "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
      [ids],
    );
    if (facts.rows.length !== 8) return null;
    const members = facts.rows.map((row) => parseFactObjectV1(row.record_json));
    const aggregate = identityBasis.aggregate_identity_input as AssimilatedContinuationRecordSetV1["aggregate_identity_input"];
    const runtimeConfig = await this.verifyRuntimeConfigReferenceV1(
      client,
      aggregate.runtime_config_ref,
      aggregate.runtime_config_hash,
    );
    const recordSet: AssimilatedContinuationRecordSetV1 = {
      record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
      continuation_operation_key: identityBasis.continuation_operation_key as AssimilatedContinuationRecordSetV1["continuation_operation_key"],
      continuation_operation_key_hash: String(
        identityBasis.continuation_operation_key_hash,
      ),
      continuation_record_set_id: recordSetId,
      continuation_idempotency_key: guard.rows[0].idempotency_key,
      member_object_ids: Object.fromEntries(
        members.map((member) => [member.object_type, member.object_id]),
      ) as AssimilatedContinuationRecordSetV1["member_object_ids"],
      aggregate_identity_input: aggregate,
      continuation_record_set_determinism_hash: guard.rows[0].determinism_hash,
      members,
    };
    validateVersionedContinuationRecordSetV1({
      record_set: recordSet,
      runtime_config: runtimeConfig,
    });
    return recordSet;
  }

  async readAssimilatedContinuationRecordSet(
    recordSetId: string,
  ): Promise<AssimilatedContinuationRecordSetV1 | null> {
    const client = await this.poolV1.connect();
    try {
      return await this.readAssimilatedContinuationRecordSetWithClientV1(
        client,
        recordSetId,
      );
    } finally {
      client.release();
    }
  }

  private async verifyAssimilatedContinuationAuthorityV1(
    client: PoolClient,
    scope: TwinScopeKeyV1,
    expected: ContinuationExpectedPointersV1,
    recordSet: AssimilatedContinuationRecordSetV1,
  ): Promise<void> {
    const values = scopeValuesV1(scope);
    const active = await client.query(
      "SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      values,
    );
    if (
      active.rows.length !== 1
      || active.rows[0].active_lineage_ref !== expected.active_lineage_ref
    ) {
      throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    }

    const lineage = await this.readCanonicalObjectWithClientV1(
      client,
      expected.active_lineage_ref,
    );
    if (!lineage || lineage.object_type !== "twin_runtime_lineage_v1") {
      throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    }
    if (lineage.lineage_id !== expected.lineage_id) {
      throw new Error("ACTIVE_LINEAGE_ID_MISMATCH");
    }
    if (lineage.revision_id !== expected.revision_id) {
      throw new Error("LINEAGE_REVISION_MISMATCH");
    }

    const currentCheckpoint = requireMemberV1(
      recordSet,
      "twin_runtime_checkpoint_v1",
    );
    const currentSequence = currentCheckpoint.payload.tick_sequence;
    if (
      typeof currentSequence !== "number"
      || !Number.isInteger(currentSequence)
      || currentSequence < 2
    ) {
      throw new Error("CONTINUATION_CHECKPOINT_TICK_SEQUENCE_INVALID");
    }

    const previousState = await this.readCanonicalObjectWithClientV1(
      client,
      expected.previous_state_ref,
      validateContinuationMemberV1,
    );
    const previousCheckpoint = await this.readCanonicalObjectWithClientV1(
      client,
      expected.previous_checkpoint_ref,
      validateContinuationMemberV1,
    );
    const previousForecast = await this.readCanonicalObjectWithClientV1(
      client,
      expected.previous_forecast_result_ref,
      validateContinuationMemberV1,
    );
    if (!previousState || previousState.object_type !== "twin_state_estimate_v1") {
      throw new Error("STATE_LATEST_CAS_CONFLICT");
    }
    if (
      !previousCheckpoint
      || previousCheckpoint.object_type !== "twin_runtime_checkpoint_v1"
    ) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }
    if (!previousForecast || previousForecast.object_type !== "twin_forecast_run_v1") {
      throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    }
    if (
      previousState.lineage_id !== expected.lineage_id
      || previousCheckpoint.lineage_id !== expected.lineage_id
    ) {
      throw new Error("ACTIVE_LINEAGE_ID_MISMATCH");
    }
    if (
      previousState.revision_id !== expected.revision_id
      || previousCheckpoint.revision_id !== expected.revision_id
    ) {
      throw new Error("LINEAGE_REVISION_MISMATCH");
    }
    if (
      previousCheckpoint.payload.last_posterior_state_ref
      !== expected.previous_state_ref
    ) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }
    if (
      previousCheckpoint.payload.forecast_result_ref
      !== expected.previous_forecast_result_ref
    ) {
      throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    }

    const aggregate = recordSet.aggregate_identity_input;
    if (
      aggregate.previous_posterior_ref !== expected.previous_state_ref
      || aggregate.previous_posterior_hash !== previousState.determinism_hash
    ) {
      throw new Error("STATE_LATEST_CAS_CONFLICT");
    }
    if (
      aggregate.previous_checkpoint_ref !== expected.previous_checkpoint_ref
      || aggregate.previous_checkpoint_hash !== previousCheckpoint.determinism_hash
    ) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }
    if (recordSet.continuation_operation_key.lineage_id !== expected.lineage_id) {
      throw new Error("ACTIVE_LINEAGE_ID_MISMATCH");
    }
    if (recordSet.continuation_operation_key.revision_id !== expected.revision_id) {
      throw new Error("LINEAGE_REVISION_MISMATCH");
    }

    const statePointer = await client.query(
      "SELECT state_object_id,lineage_id,revision_id,determinism_hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      values,
    );
    if (
      statePointer.rows.length !== 1
      || statePointer.rows[0].state_object_id !== expected.previous_state_ref
      || statePointer.rows[0].determinism_hash !== previousState.determinism_hash
    ) {
      throw new Error("STATE_LATEST_CAS_CONFLICT");
    }
    if (statePointer.rows[0].lineage_id !== expected.lineage_id) {
      throw new Error("ACTIVE_LINEAGE_ID_MISMATCH");
    }
    if (statePointer.rows[0].revision_id !== expected.revision_id) {
      throw new Error("LINEAGE_REVISION_MISMATCH");
    }

    const checkpointPointer = await client.query(
      "SELECT checkpoint_object_id,lineage_id,revision_id,determinism_hash FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      values,
    );
    if (
      checkpointPointer.rows.length !== 1
      || checkpointPointer.rows[0].checkpoint_object_id
        !== expected.previous_checkpoint_ref
      || checkpointPointer.rows[0].determinism_hash
        !== previousCheckpoint.determinism_hash
    ) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }
    if (checkpointPointer.rows[0].lineage_id !== expected.lineage_id) {
      throw new Error("ACTIVE_LINEAGE_ID_MISMATCH");
    }
    if (checkpointPointer.rows[0].revision_id !== expected.revision_id) {
      throw new Error("LINEAGE_REVISION_MISMATCH");
    }

    const forecastPointer = await client.query(
      "SELECT forecast_object_id,determinism_hash FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      values,
    );
    if (
      forecastPointer.rows.length !== 1
      || forecastPointer.rows[0].forecast_object_id
        !== expected.previous_forecast_result_ref
      || forecastPointer.rows[0].determinism_hash
        !== previousForecast.determinism_hash
    ) {
      throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    }

    const successfulForecast = await client.query(
      "SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE",
      values,
    );
    if (
      expected.latest_successful_forecast_ref !== null
      || successfulForecast.rows.length !== 0
    ) {
      throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");
    }

    await this.verifyRuntimeConfigReferenceV1(
      client,
      aggregate.runtime_config_ref,
      aggregate.runtime_config_hash,
    );
    const health = requireMemberV1(recordSet, "twin_runtime_health_v1");
    if (health.payload.active_lineage_ref !== expected.active_lineage_ref) {
      throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    }
  }

  private async verifyCanonicalUniquenessV1(
    client: PoolClient,
    recordSet: AssimilatedContinuationRecordSetV1,
  ): Promise<void> {
    const key = recordSet.continuation_operation_key;
    const existing = await client.query(
      `SELECT 1 FROM facts
       WHERE record_json->>'type'='twin_runtime_tick_v1'
         AND record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
         AND record_json->'payload'->>'lineage_id'=$7
         AND record_json->'payload'->>'revision_id'=$8
         AND record_json->'payload'->>'logical_time'=$9
         AND record_json->'payload'->'payload'->>'operation_variant'=$10
       LIMIT 1`,
      [
        ...scopeValuesV1(key.scope),
        key.lineage_id,
        key.revision_id,
        key.logical_time,
        key.operation_variant,
      ],
    );
    if (existing.rows.length) {
      throw new Error("CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT");
    }
  }

  async commitAssimilatedContinuationState(
    input: Parameters<
      AssimilatedContinuationPersistencePortV1["commitAssimilatedContinuationState"]
    >[0],
  ) {
    validateAssimilatedContinuationCrossReferencesV1(input.record_set);
    assertScopeMatchesV1(input.scope, input.record_set);
    const client = await this.poolV1.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    let committed = false;
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND idempotency_key=$1 FOR UPDATE",
        [input.record_set.continuation_idempotency_key],
      );
      if (existing.rows.length) {
        if (
          existing.rows[0].record_set_id
            !== input.record_set.continuation_record_set_id
          || existing.rows[0].determinism_hash
            !== input.record_set.continuation_record_set_determinism_hash
        ) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        const recordSet = await this.readAssimilatedContinuationRecordSetWithClientV1(
          client,
          input.record_set.continuation_record_set_id,
        );
        if (!recordSet) {
          throw new Error("IDEMPOTENT_CONTINUATION_RECORD_SET_INCOMPLETE");
        }
        if (
          recordSet.continuation_record_set_determinism_hash
          !== input.record_set.continuation_record_set_determinism_hash
        ) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        await client.query("COMMIT");
        committed = true;
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS" as const,
          record_set: recordSet,
          fact_ids_by_object_id: Object.fromEntries(
            recordSet.members.map((member) => [
              member.object_id,
              factIdV1(member.object_id),
            ]),
          ),
        };
      }

      await this.verifyLeaseV1(client, input.scope, input.lease);
      await this.verifyAssimilatedContinuationAuthorityV1(
        client,
        input.scope,
        input.expected,
        input.record_set,
      );
      await this.verifyCanonicalUniquenessV1(client, input.record_set);

      const factIds: Record<string, string> = {};
      const factReads: CanonicalFactReadV1[] = [];
      for (let index = 0; index < input.record_set.members.length; index += 1) {
        const object = input.record_set.members[index];
        inject(`before_fact_${index + 1}_${object.object_type}`);
        const id = factIdV1(object.object_id);
        factIds[object.object_id] = id;
        await client.query(
          "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
          [id, object.logical_time, recordJsonV1(object)],
        );
        factReads.push({ fact_id: id, object });
      }

      const rows = buildContinuationProjectionRowsV1(factReads);
      inject("before_state_history_projection");
      await client.query(
        "INSERT INTO twin_state_history_projection_v1 (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)",
        [
          rows.state_history.state_object_id,
          ...scopeValuesV1(input.scope),
          rows.state_history.lineage_id,
          rows.state_history.revision_id,
          rows.state_history.logical_time,
          rows.state_history.determinism_hash,
          JSON.stringify(rows.state_history.canonical_payload),
          rows.state_history.source_fact_id,
        ],
      );

      inject("before_state_latest_projection");
      const stateCas = await client.query(
        `UPDATE twin_state_latest_index_v1 SET
           state_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND state_object_id=$13
         RETURNING state_object_id`,
        [
          ...scopeValuesV1(input.scope),
          rows.state_latest.state_object_id,
          rows.state_latest.lineage_id,
          rows.state_latest.revision_id,
          rows.state_latest.logical_time,
          rows.state_latest.determinism_hash,
          rows.state_latest.source_fact_id,
          input.expected.previous_state_ref,
        ],
      );
      if (stateCas.rows.length !== 1) throw new Error("STATE_LATEST_CAS_CONFLICT");

      inject("before_forecast_result_projection");
      const forecastCas = await client.query(
        `UPDATE twin_forecast_result_latest_index_v1 SET
           forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND forecast_object_id=$12
         RETURNING forecast_object_id`,
        [
          ...scopeValuesV1(input.scope),
          rows.forecast_result_latest.forecast_object_id,
          rows.forecast_result_latest.forecast_status,
          rows.forecast_result_latest.logical_time,
          rows.forecast_result_latest.determinism_hash,
          rows.forecast_result_latest.source_fact_id,
          input.expected.previous_forecast_result_ref,
        ],
      );
      if (forecastCas.rows.length !== 1) {
        throw new Error("FORECAST_RESULT_CAS_CONFLICT");
      }

      inject("before_checkpoint_projection");
      const checkpointCas = await client.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1 SET
           checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND checkpoint_object_id=$13
         RETURNING checkpoint_object_id`,
        [
          ...scopeValuesV1(input.scope),
          rows.checkpoint_latest.checkpoint_object_id,
          rows.checkpoint_latest.lineage_id,
          rows.checkpoint_latest.revision_id,
          rows.checkpoint_latest.logical_time,
          rows.checkpoint_latest.determinism_hash,
          rows.checkpoint_latest.source_fact_id,
          input.expected.previous_checkpoint_ref,
        ],
      );
      if (checkpointCas.rows.length !== 1) {
        throw new Error("CHECKPOINT_CAS_CONFLICT");
      }

      inject("before_health_projection");
      await client.query(
        `INSERT INTO twin_runtime_health_latest_index_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           health_object_id=EXCLUDED.health_object_id,
           operation_status=EXCLUDED.operation_status,
           logical_time=EXCLUDED.logical_time,
           determinism_hash=EXCLUDED.determinism_hash,
           source_fact_id=EXCLUDED.source_fact_id`,
        [
          ...scopeValuesV1(input.scope),
          rows.runtime_health_latest.health_object_id,
          rows.runtime_health_latest.operation_status,
          rows.runtime_health_latest.logical_time,
          rows.runtime_health_latest.determinism_hash,
          rows.runtime_health_latest.source_fact_id,
        ],
      );

      inject("before_idempotency_index");
      await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
           (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ('A2_RECORD_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
        [
          input.record_set.continuation_idempotency_key,
          input.record_set.continuation_record_set_id,
          input.record_set.continuation_record_set_determinism_hash,
          JSON.stringify({
            record_set_contract_id: input.record_set.record_set_contract_id,
            continuation_operation_key: input.record_set.continuation_operation_key,
            continuation_operation_key_hash:
              input.record_set.continuation_operation_key_hash,
            aggregate_identity_input: input.record_set.aggregate_identity_input,
          }),
          JSON.stringify(
            input.record_set.members.map((member) => member.object_id),
          ),
          JSON.stringify(
            Object.fromEntries(
              input.record_set.members.map((member) => [
                member.object_id,
                member.determinism_hash,
              ]),
            ),
          ),
        ],
      );
      inject("before_commit");
      await client.query("COMMIT");
      committed = true;

      const readback = await this.readAssimilatedContinuationRecordSet(
        input.record_set.continuation_record_set_id,
      );
      if (!readback) {
        throw new Error("ASSIMILATED_CANONICAL_READBACK_INCOMPLETE");
      }
      if (
        readback.continuation_record_set_determinism_hash
        !== input.record_set.continuation_record_set_determinism_hash
      ) {
        throw new Error("ASSIMILATED_CANONICAL_READBACK_HASH_MISMATCH");
      }
      return {
        status: "INSERTED" as const,
        record_set: readback,
        fact_ids_by_object_id: factIds,
      };
    } catch (error) {
      if (!committed) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rebuildAssimilatedContinuationProjections(
    recordSetId: string,
  ): Promise<{ rebuilt_projection_count: 5 }> {
    const client = await this.poolV1.connect();
    try {
      await client.query("BEGIN");
      const recordSet = await this.readAssimilatedContinuationRecordSetWithClientV1(
        client,
        recordSetId,
      );
      if (!recordSet) throw new Error("ASSIMILATED_CONTINUATION_RECORD_SET_NOT_FOUND");
      const scope = recordSet.continuation_operation_key.scope;
      const rows = buildContinuationProjectionRowsV1(
        recordSet.members.map((object) => ({
          fact_id: factIdV1(object.object_id),
          object,
        })),
      );
      const values = scopeValuesV1(scope);

      const history = await client.query(
        `INSERT INTO twin_state_history_projection_v1
           (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)
         ON CONFLICT (state_object_id) DO UPDATE SET
           canonical_payload=EXCLUDED.canonical_payload,
           source_fact_id=EXCLUDED.source_fact_id
         WHERE twin_state_history_projection_v1.determinism_hash=EXCLUDED.determinism_hash
         RETURNING state_object_id`,
        [
          rows.state_history.state_object_id,
          ...values,
          rows.state_history.lineage_id,
          rows.state_history.revision_id,
          rows.state_history.logical_time,
          rows.state_history.determinism_hash,
          JSON.stringify(rows.state_history.canonical_payload),
          rows.state_history.source_fact_id,
        ],
      );
      if (history.rows.length !== 1) {
        throw new Error("PROJECTION_REBUILD_STATE_HISTORY_CONFLICT");
      }

      const state = await client.query(
        `INSERT INTO twin_state_latest_index_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           state_object_id=EXCLUDED.state_object_id,lineage_id=EXCLUDED.lineage_id,revision_id=EXCLUDED.revision_id,
           logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id
         WHERE twin_state_latest_index_v1.logical_time<=EXCLUDED.logical_time
         RETURNING state_object_id`,
        [
          ...values,
          rows.state_latest.state_object_id,
          rows.state_latest.lineage_id,
          rows.state_latest.revision_id,
          rows.state_latest.logical_time,
          rows.state_latest.determinism_hash,
          rows.state_latest.source_fact_id,
        ],
      );
      if (state.rows.length !== 1) {
        throw new Error("PROJECTION_REBUILD_NEWER_STATE_POINTER_PRESENT");
      }

      const forecast = await client.query(
        `INSERT INTO twin_forecast_result_latest_index_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           forecast_object_id=EXCLUDED.forecast_object_id,forecast_status=EXCLUDED.forecast_status,
           logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id
         WHERE twin_forecast_result_latest_index_v1.logical_time<=EXCLUDED.logical_time
         RETURNING forecast_object_id`,
        [
          ...values,
          rows.forecast_result_latest.forecast_object_id,
          rows.forecast_result_latest.forecast_status,
          rows.forecast_result_latest.logical_time,
          rows.forecast_result_latest.determinism_hash,
          rows.forecast_result_latest.source_fact_id,
        ],
      );
      if (forecast.rows.length !== 1) {
        throw new Error("PROJECTION_REBUILD_NEWER_FORECAST_POINTER_PRESENT");
      }

      const checkpoint = await client.query(
        `INSERT INTO twin_runtime_checkpoint_latest_index_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           checkpoint_object_id=EXCLUDED.checkpoint_object_id,lineage_id=EXCLUDED.lineage_id,revision_id=EXCLUDED.revision_id,
           logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id
         WHERE twin_runtime_checkpoint_latest_index_v1.logical_time<=EXCLUDED.logical_time
         RETURNING checkpoint_object_id`,
        [
          ...values,
          rows.checkpoint_latest.checkpoint_object_id,
          rows.checkpoint_latest.lineage_id,
          rows.checkpoint_latest.revision_id,
          rows.checkpoint_latest.logical_time,
          rows.checkpoint_latest.determinism_hash,
          rows.checkpoint_latest.source_fact_id,
        ],
      );
      if (checkpoint.rows.length !== 1) {
        throw new Error("PROJECTION_REBUILD_NEWER_CHECKPOINT_POINTER_PRESENT");
      }

      const health = await client.query(
        `INSERT INTO twin_runtime_health_latest_index_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           health_object_id=EXCLUDED.health_object_id,operation_status=EXCLUDED.operation_status,
           logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id
         WHERE twin_runtime_health_latest_index_v1.logical_time<=EXCLUDED.logical_time
         RETURNING health_object_id`,
        [
          ...values,
          rows.runtime_health_latest.health_object_id,
          rows.runtime_health_latest.operation_status,
          rows.runtime_health_latest.logical_time,
          rows.runtime_health_latest.determinism_hash,
          rows.runtime_health_latest.source_fact_id,
        ],
      );
      if (health.rows.length !== 1) {
        throw new Error("PROJECTION_REBUILD_NEWER_HEALTH_POINTER_PRESENT");
      }

      await client.query("COMMIT");
      return { rebuilt_projection_count: 5 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
