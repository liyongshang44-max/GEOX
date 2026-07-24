// Purpose: freeze and compare the active Runtime authority fingerprint across the S3 E→H and B→G critical sections so config/model/pointer changes fail closed.
// Boundary: read-only authority observation only; no fact append, projection mutation, pointer repair, lease claim, route, scheduler, clock, filesystem, environment, or production authority.

import type { Pool } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type Cap08S3AuthorityFingerprintV1 = {
  schema_version: "geox_mcft_cap08_s3_authority_fingerprint_v1";
  scope: TwinScopeKeyV1;
  active_lineage: unknown;
  latest_state: unknown;
  latest_checkpoint: unknown;
  latest_successful_forecast: unknown;
  latest_successful_forecast_projection: unknown;
  latest_scenario: unknown;
  latest_scenario_projection: unknown;
  model_activations: unknown[];
  digest: string;
};

function scopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

export class Cap08S3AuthorityGuardV1 {
  constructor(private readonly pool: Pool) {}

  private async oneRowV1(table: string, scope: TwinScopeKeyV1, code: string): Promise<unknown> {
    const result = await this.pool.query(
      `SELECT to_jsonb(t) AS row FROM ${table} t
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValuesV1(scope),
    );
    if (result.rows.length !== 1) throw new Error(code);
    return structuredClone(result.rows[0].row);
  }

  private async latestForecastProjectionV1(scope: TwinScopeKeyV1): Promise<unknown> {
    const result = await this.pool.query(
      `SELECT to_jsonb(p) AS row
       FROM twin_forecast_success_latest_index_v1 l
       JOIN twin_forecast_run_projection_v1 p ON p.forecast_object_id=l.forecast_object_id
       WHERE l.tenant_id=$1 AND l.project_id=$2 AND l.group_id=$3 AND l.field_id=$4 AND l.season_id=$5 AND l.zone_id=$6`,
      scopeValuesV1(scope),
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S3_AUTHORITY_FORECAST_PROJECTION_CARDINALITY");
    return structuredClone(result.rows[0].row);
  }

  private async latestScenarioProjectionV1(scope: TwinScopeKeyV1): Promise<unknown> {
    const result = await this.pool.query(
      `SELECT to_jsonb(p) AS row
       FROM twin_scenario_latest_index_v1 l
       JOIN twin_scenario_set_projection_v1 p ON p.scenario_set_id=l.scenario_set_id
       WHERE l.tenant_id=$1 AND l.project_id=$2 AND l.group_id=$3 AND l.field_id=$4 AND l.season_id=$5 AND l.zone_id=$6`,
      scopeValuesV1(scope),
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S3_AUTHORITY_SCENARIO_PROJECTION_CARDINALITY");
    return structuredClone(result.rows[0].row);
  }

  private async modelActivationsV1(scope: TwinScopeKeyV1): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT fact_id,record_json
       FROM facts
       WHERE record_json->>'type'='twin_model_activation_v1'
         AND record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
       ORDER BY fact_id`,
      scopeValuesV1(scope),
    );
    return result.rows.map((row) => structuredClone({ fact_id: row.fact_id, record_json: row.record_json }));
  }

  async capture(scope: TwinScopeKeyV1): Promise<Cap08S3AuthorityFingerprintV1> {
    const [
      activeLineage,
      latestState,
      latestCheckpoint,
      latestForecast,
      latestForecastProjection,
      latestScenario,
      latestScenarioProjection,
      modelActivations,
    ] = await Promise.all([
      this.oneRowV1("twin_active_lineage_index_v1", scope, "CAP08_S3_AUTHORITY_ACTIVE_LINEAGE_CARDINALITY"),
      this.oneRowV1("twin_state_latest_index_v1", scope, "CAP08_S3_AUTHORITY_STATE_CARDINALITY"),
      this.oneRowV1("twin_runtime_checkpoint_latest_index_v1", scope, "CAP08_S3_AUTHORITY_CHECKPOINT_CARDINALITY"),
      this.oneRowV1("twin_forecast_success_latest_index_v1", scope, "CAP08_S3_AUTHORITY_FORECAST_CARDINALITY"),
      this.latestForecastProjectionV1(scope),
      this.oneRowV1("twin_scenario_latest_index_v1", scope, "CAP08_S3_AUTHORITY_SCENARIO_CARDINALITY"),
      this.latestScenarioProjectionV1(scope),
      this.modelActivationsV1(scope),
    ]);
    const basis = {
      scope: structuredClone(scope),
      active_lineage: activeLineage,
      latest_state: latestState,
      latest_checkpoint: latestCheckpoint,
      latest_successful_forecast: latestForecast,
      latest_successful_forecast_projection: latestForecastProjection,
      latest_scenario: latestScenario,
      latest_scenario_projection: latestScenarioProjection,
      model_activations: modelActivations,
    };
    return {
      schema_version: "geox_mcft_cap08_s3_authority_fingerprint_v1",
      ...basis,
      digest: semanticHashV1(basis),
    };
  }

  async assertUnchanged(before: Cap08S3AuthorityFingerprintV1): Promise<Cap08S3AuthorityFingerprintV1> {
    const after = await this.capture(before.scope);
    if (after.digest !== before.digest) throw new Error("CAP08_S3_ACTIVE_CONFIG_OR_MODEL_CHANGED_DURING_PROVIDER_PHASE");
    return after;
  }
}
