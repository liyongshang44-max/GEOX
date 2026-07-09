// apps/server/src/persistence/twin_runtime/postgres_projection_rebuilder_v1.ts
// Purpose: delete and rebuild the six MCFT-CAP-01 A0 projections from the persisted nine-object canonical fact set.
// Boundary: A0-only projection recovery; no canonical fact mutation, continuation tick, restart scheduler, equations, or alternate State semantics.

import type { Pool } from "pg";
import { buildA0ProjectionRowsV1 } from "../../projections/twin_runtime/projection_rebuilder_v1.js";
import type { A0ProjectionRebuildPortV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";
import { PostgresRuntimeRepositoryV1 } from "./postgres_runtime_repository_v1.js";

function factId(objectId: string): string { return `fact_${objectId}`; }
function scopeValues(scope: TwinScopeKeyV1): unknown[] { return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id]; }

export class PostgresProjectionRebuilderV1 implements A0ProjectionRebuildPortV1 {
  constructor(private readonly pool: Pool) {}

  async rebuildA0Projections(recordSetId: string): Promise<{ rebuilt_projection_count: 6 }> {
    const repository = new PostgresRuntimeRepositoryV1(this.pool);
    const recordSet = await repository.readBootstrapRecordSet(recordSetId);
    if (!recordSet) throw new Error("A0_RECORD_SET_NOT_FOUND");
    const rows = buildA0ProjectionRowsV1(recordSet.members.map((object) => ({ fact_id: factId(object.object_id), object })));
    const state = recordSet.members.find((member) => member.object_type === "twin_state_estimate_v1");
    if (!state || !state.group_id || !state.season_id || !state.zone_id) throw new Error("A0_REBUILD_SCOPE_INCOMPLETE");
    const scope: TwinScopeKeyV1 = { tenant_id: state.tenant_id, project_id: state.project_id, group_id: state.group_id, field_id: state.field_id, season_id: state.season_id, zone_id: state.zone_id };
    const values = scopeValues(scope);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const table of ["twin_active_lineage_index_v1","twin_state_history_projection_v1","twin_state_latest_index_v1","twin_forecast_result_latest_index_v1","twin_runtime_checkpoint_latest_index_v1","twin_runtime_health_latest_index_v1"]) {
        await client.query(`DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values);
      }
      await client.query("INSERT INTO twin_active_lineage_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)", [...values,rows.active_lineage.active_lineage_ref,rows.active_lineage.activation_authority_kind,rows.active_lineage.activation_authority_ref]);
      await client.query("INSERT INTO twin_state_history_projection_v1 (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)", [rows.state_history.state_object_id,...values,rows.state_history.lineage_id,rows.state_history.revision_id,rows.state_history.logical_time,rows.state_history.determinism_hash,JSON.stringify(rows.state_history.canonical_payload),rows.state_history.source_fact_id]);
      await client.query("INSERT INTO twin_state_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)", [...values,rows.state_latest.state_object_id,rows.state_latest.lineage_id,rows.state_latest.revision_id,rows.state_latest.logical_time,rows.state_latest.determinism_hash,rows.state_latest.source_fact_id]);
      await client.query("INSERT INTO twin_forecast_result_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)", [...values,rows.forecast_result_latest.forecast_object_id,rows.forecast_result_latest.forecast_status,rows.forecast_result_latest.logical_time,rows.forecast_result_latest.determinism_hash,rows.forecast_result_latest.source_fact_id]);
      await client.query("INSERT INTO twin_runtime_checkpoint_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)", [...values,rows.checkpoint_latest.checkpoint_object_id,rows.checkpoint_latest.lineage_id,rows.checkpoint_latest.revision_id,rows.checkpoint_latest.logical_time,rows.checkpoint_latest.determinism_hash,rows.checkpoint_latest.source_fact_id]);
      await client.query("INSERT INTO twin_runtime_health_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)", [...values,rows.runtime_health_latest.health_object_id,rows.runtime_health_latest.operation_status,rows.runtime_health_latest.logical_time,rows.runtime_health_latest.determinism_hash,rows.runtime_health_latest.source_fact_id]);
      await client.query("COMMIT");
      return { rebuilt_projection_count: 6 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
