// Purpose: append the governed local demo facts and rebuildable projections into an explicitly local development database.
// Boundary: no schema destruction, visibility metadata DML, model activation, Runtime source authority, recommendation, approval, dispatch, or CAP-08 authority.

import type { PoolClient } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CREATED_AT, type DemoBundle, type DemoObject, type DemoScope, factId, member } from "./three_surface_local_demo_contract_v1.js";

const SOURCE = "scripts/dev_seed/seed_three_surface_local_demo_v1";

export async function assertRequiredRelations(client: PoolClient): Promise<void> {
  const required = [
    "facts",
    "field_index_v1",
    "field_season_index_v1",
    "twin_fact_visibility_epoch_v1",
    "twin_fact_visibility_index_v1",
    "twin_object_idempotency_index_v1",
    "twin_active_lineage_index_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_state_history_projection_v1",
    "twin_state_latest_index_v1",
    "twin_forecast_run_projection_v1",
    "twin_forecast_result_latest_index_v1",
    "twin_forecast_success_latest_index_v1",
    "twin_scenario_set_projection_v1",
    "twin_scenario_latest_index_v1",
    "twin_forecast_residual_projection_v1",
    "twin_calibration_candidate_projection_v1",
    "twin_shadow_evaluation_projection_v1",
    "twin_runtime_health_latest_index_v1",
  ];
  const result = await client.query<{ relation_name: string; exists: boolean }>(
    `SELECT relation_name, pg_catalog.to_regclass('public.' || relation_name) IS NOT NULL AS exists
       FROM unnest($1::text[]) AS relation_name`,
    [required],
  );
  const missing = result.rows.filter((row) => !row.exists).map((row) => row.relation_name);
  if (missing.length) throw new Error(`LOCAL_DEMO_REQUIRED_SCHEMA_MISSING:${missing.join(",")}`);
  const epoch = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE'",
  );
  if (epoch.rows[0]?.count !== "1") throw new Error(`LOCAL_DEMO_ACTIVE_VISIBILITY_EPOCH_INVALID:${epoch.rows[0]?.count ?? "0"}`);
  const trigger = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM pg_catalog.pg_trigger t
       JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
       JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='facts'
        AND t.tgname='mcft_cap07_fact_visibility_after_insert_v1'
        AND t.tgenabled='O' AND NOT t.tgisinternal`,
  );
  if (trigger.rows[0]?.count !== "1") throw new Error("LOCAL_DEMO_VISIBILITY_TRIGGER_REQUIRED");
}

async function insertCanonicalFact(client: PoolClient, object: DemoObject | CanonicalObjectEnvelopeV1): Promise<void> {
  const id = factId(object.object_id);
  const record = { type: object.object_type, payload: object };
  const existing = await client.query<{ record_json: unknown }>("SELECT record_json FROM public.facts WHERE fact_id=$1", [id]);
  if (existing.rowCount) {
    if (semanticHashV1(existing.rows[0]?.record_json) !== semanticHashV1(record)) {
      throw new Error(`LOCAL_DEMO_CANONICAL_FACT_CONFLICT:${id}`);
    }
    return;
  }
  await client.query(
    "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)",
    [id, object.logical_time, SOURCE, JSON.stringify(record)],
  );
}

export async function seedFieldNavigator(client: PoolClient, scope: DemoScope): Promise<void> {
  const ts = Date.parse(CREATED_AT);
  await client.query(
    `INSERT INTO public.field_index_v1(tenant_id,field_id,name,area_ha,status,created_ts_ms,updated_ts_ms)
     VALUES($1,$2,$3,$4,'ACTIVE',$5,$5)
     ON CONFLICT (tenant_id,field_id) DO UPDATE SET
       name=EXCLUDED.name, area_ha=EXCLUDED.area_ha, status=EXCLUDED.status, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [scope.tenant_id, scope.field_id, "MCFT C8 Controlled Replay Field", 2.048848, ts],
  );
  await client.query(
    `INSERT INTO public.field_season_index_v1(tenant_id,field_id,season_id,name,crop,start_date,end_date,status,created_ts_ms,updated_ts_ms)
     VALUES($1,$2,$3,$4,'corn','2026-06-01','2026-06-30','ACTIVE',$5,$5)
     ON CONFLICT (tenant_id,field_id,season_id) DO UPDATE SET
       name=EXCLUDED.name, crop=EXCLUDED.crop, start_date=EXCLUDED.start_date,
       end_date=EXCLUDED.end_date, status=EXCLUDED.status, updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [scope.tenant_id, scope.field_id, scope.season_id, "2026 C8 Corn Replay Season", ts],
  );
}

export async function persistRootAndForecasts(client: PoolClient, bundle: DemoBundle): Promise<void> {
  const { scope, runtime_config: config, root } = bundle;
  const lineage = member(root, "twin_runtime_lineage_v1");
  const checkpoint = member(root, "twin_runtime_checkpoint_v1");
  const posterior = member(root, "twin_state_estimate_v1");
  const currentForecast = member(root, "twin_forecast_run_v1");
  const rootObjects: CanonicalObjectEnvelopeV1[] = [config, ...root.members];
  const optionalObjects: DemoObject[] = [
    bundle.prior_state,
    bundle.successful_forecast,
    bundle.scenario,
    bundle.residual,
    bundle.calibration_candidate,
    bundle.shadow_evaluation,
  ];
  for (const object of [...rootObjects, ...optionalObjects]) await insertCanonicalFact(client, object);

  const memberHashes = Object.fromEntries(root.members.map((object) => [object.object_id, object.determinism_hash]));
  await client.query(
    `INSERT INTO public.twin_object_idempotency_index_v1(
       identity_kind,idempotency_key,semantic_object_id,record_set_id,determinism_hash,identity_basis,
       member_object_ids,member_determinism_hashes
     ) VALUES('A0_RECORD_SET',$1,NULL,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)
     ON CONFLICT (idempotency_key) DO UPDATE SET
       record_set_id=EXCLUDED.record_set_id, determinism_hash=EXCLUDED.determinism_hash,
       identity_basis=EXCLUDED.identity_basis, member_object_ids=EXCLUDED.member_object_ids,
       member_determinism_hashes=EXCLUDED.member_determinism_hashes`,
    [
      root.a0_idempotency_key,
      root.a0_record_set_id,
      root.a0_record_set_determinism_hash,
      JSON.stringify({ local_demo: true, a0_identity_input: root.a0_identity_input }),
      JSON.stringify(root.members.map((object) => object.object_id)),
      JSON.stringify(memberHashes),
    ],
  );

  await client.query(
    `INSERT INTO public.twin_active_lineage_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,
       active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       active_lineage_ref=EXCLUDED.active_lineage_ref,
       activation_authority_kind=EXCLUDED.activation_authority_kind,
       activation_authority_ref=EXCLUDED.activation_authority_ref,
       expected_previous_active_lineage=EXCLUDED.expected_previous_active_lineage`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      lineage.object_id,
      String(lineage.payload.activation_authority_kind || "INITIAL_LINEAGE_DECLARATION"),
      String(lineage.payload.activation_authority_ref || lineage.object_id),
    ],
  );

  await client.query(
    `INSERT INTO public.twin_runtime_checkpoint_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,
       checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       checkpoint_object_id=EXCLUDED.checkpoint_object_id,lineage_id=EXCLUDED.lineage_id,
       revision_id=EXCLUDED.revision_id,logical_time=EXCLUDED.logical_time,
       determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      checkpoint.object_id, checkpoint.lineage_id, checkpoint.revision_id, checkpoint.logical_time,
      checkpoint.determinism_hash, factId(checkpoint.object_id),
    ],
  );

  const stateObjects = [bundle.prior_state, posterior as unknown as DemoObject];
  for (const state of stateObjects) {
    await client.query(
      `INSERT INTO public.twin_state_history_projection_v1(
         state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,
         lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (state_object_id) DO UPDATE SET
         logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,
         canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
      [
        state.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
        state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash,
        JSON.stringify(state.payload), factId(state.object_id),
      ],
    );
  }
  await client.query(
    `INSERT INTO public.twin_state_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,
       logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       state_object_id=EXCLUDED.state_object_id,lineage_id=EXCLUDED.lineage_id,revision_id=EXCLUDED.revision_id,
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      posterior.object_id, posterior.lineage_id, posterior.revision_id, posterior.logical_time,
      posterior.determinism_hash, factId(posterior.object_id),
    ],
  );

  const forecasts = [bundle.successful_forecast, currentForecast as unknown as DemoObject];
  for (const forecast of forecasts) {
    const payload = forecast.payload;
    await client.query(
      `INSERT INTO public.twin_forecast_run_projection_v1(
         forecast_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,
         lineage_id,revision_id,logical_time,forecast_status,source_posterior_ref,source_posterior_hash,
         runtime_config_ref,runtime_config_hash,forcing_window_hash,point_count,determinism_hash,canonical_payload,source_fact_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
       ON CONFLICT (forecast_object_id) DO UPDATE SET
         logical_time=EXCLUDED.logical_time,forecast_status=EXCLUDED.forecast_status,
         point_count=EXCLUDED.point_count,determinism_hash=EXCLUDED.determinism_hash,
         canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
      [
        forecast.object_id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
        forecast.lineage_id, forecast.revision_id, forecast.logical_time, payload.status,
        payload.source_posterior_ref, payload.source_posterior_hash,
        forecast.runtime_config_ref, forecast.runtime_config_hash, payload.forcing_window_hash ?? null,
        Number(payload.point_count ?? (Array.isArray(payload.points) ? payload.points.length : 0)),
        forecast.determinism_hash, JSON.stringify(payload), factId(forecast.object_id),
      ],
    );
  }

  await client.query(
    `INSERT INTO public.twin_forecast_result_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,
       logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       forecast_object_id=EXCLUDED.forecast_object_id,forecast_status=EXCLUDED.forecast_status,
       logical_time=EXCLUDED.logical_time,determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      currentForecast.object_id, currentForecast.payload.status, currentForecast.logical_time,
      currentForecast.determinism_hash, factId(currentForecast.object_id),
    ],
  );
  await client.query(
    `INSERT INTO public.twin_forecast_success_latest_index_v1(
       tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,logical_time,determinism_hash,source_fact_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       forecast_object_id=EXCLUDED.forecast_object_id,logical_time=EXCLUDED.logical_time,
       determinism_hash=EXCLUDED.determinism_hash,source_fact_id=EXCLUDED.source_fact_id`,
    [
      scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id,
      bundle.successful_forecast.object_id, bundle.successful_forecast.logical_time,
      bundle.successful_forecast.determinism_hash, factId(bundle.successful_forecast.object_id),
    ],
  );
}
