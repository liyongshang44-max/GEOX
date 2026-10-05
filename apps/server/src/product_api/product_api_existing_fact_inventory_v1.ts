import { createProductApiReadOnlyPoolV1 } from "./product_api_public_runtime_v1.js";

const SCOPE = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t4r1",
} as const;

async function safeQuery(pool: ReturnType<typeof createProductApiReadOnlyPoolV1>, name: string, sql: string, params: unknown[]) {
  try {
    const result = await pool.query(sql, params);
    return { name, status: "OK", row_count: result.rows.length, rows: result.rows };
  } catch (error) {
    return { name, status: "UNAVAILABLE", error: error instanceof Error ? error.message : String(error), row_count: 0, rows: [] };
  }
}

async function main(): Promise<void> {
  const url = String(process.env.GEOX_PRODUCT_DATABASE_URL ?? "").trim();
  if (!url) throw new Error("GEOX_PRODUCT_DATABASE_URL_REQUIRED");
  const pool = createProductApiReadOnlyPoolV1(url);
  try {
    const session = await safeQuery(pool, "session",
      `SELECT current_user, pg_catalog.current_setting('transaction_read_only') AS transaction_read_only`, []);

    const fieldIndex = await safeQuery(pool, "field_index",
      `SELECT field_id, COALESCE(field_name,name) AS field_name, area_ha, updated_ts_ms
         FROM public.field_index_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4`,
      [SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id]);

    const geometry = await safeQuery(pool, "field_polygon",
      `SELECT field_id, polygon_geojson_json IS NOT NULL AS has_geojson, area_m2, created_ts_ms, updated_ts_ms
         FROM public.field_polygon_v1
        WHERE tenant_id=$1 AND field_id=$2
        ORDER BY updated_ts_ms DESC NULLS LAST LIMIT 10`,
      [SCOPE.tenant_id,SCOPE.field_id]);

    const factTypes = await safeQuery(pool, "facts_by_type_for_field",
      `SELECT record_json::jsonb->>'type' AS fact_type,
              COUNT(*)::int AS fact_count,
              MAX(occurred_at) AS latest_occurred_at
         FROM public.facts
        WHERE (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,field_id}')=$4
            OR record_json::jsonb::text LIKE $5
          )
        GROUP BY record_json::jsonb->>'type'
        ORDER BY fact_count DESC, fact_type ASC
        LIMIT 200`,
      [SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id, `%${SCOPE.field_id}%`]);

    const blineTypes = [
      "decision_recommendation_v1","approval_request_v1","approval_decision_v1",
      "operation_plan_v1","ao_act_task_v0","ao_act_dispatch_v1","ao_act_receipt_v1",
      "evidence_artifact_v1","acceptance_result_v1","operation_report_v1"
    ];
    const bline = await safeQuery(pool, "bline_fact_inventory",
      `SELECT record_json::jsonb->>'type' AS fact_type,
              fact_id,
              occurred_at,
              record_json::jsonb#>>'{payload,field_id}' AS field_id,
              COALESCE(record_json::jsonb#>>'{payload,operation_plan_id}',record_json::jsonb#>>'{payload,operation_id}') AS operation_ref,
              COALESCE(record_json::jsonb#>>'{payload,status}',record_json::jsonb#>>'{payload,state}',record_json::jsonb#>>'{payload,verdict}') AS declared_state
         FROM public.facts
        WHERE (record_json::jsonb->>'type')=ANY($1::text[])
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
          AND (record_json::jsonb#>>'{payload,project_id}')=$3
          AND (record_json::jsonb#>>'{payload,group_id}')=$4
          AND (
            (record_json::jsonb#>>'{payload,field_id}')=$5
            OR record_json::jsonb::text LIKE $6
          )
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 100`,
      [blineTypes,SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id,`%${SCOPE.field_id}%`]);

    const asExecuted = await safeQuery(pool, "as_executed",
      `SELECT as_executed_id, operation_plan_id, task_id, receipt_id, field_id
         FROM public.as_executed_record_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
        LIMIT 50`,
      [SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id]);

    const memory = await safeQuery(pool, "field_memory",
      `SELECT memory_id, operation_id, formal_acceptance_id, created_at, occurred_at, trust_level, customer_visible_memory
         FROM public.field_memory_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
        ORDER BY COALESCE(created_at,occurred_at) DESC NULLS LAST LIMIT 50`,
      [SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id]);

    const operationState = await safeQuery(pool, "operation_state",
      `SELECT operation_id, operation_plan_id, task_id, receipt_id, final_status, status, action_type
         FROM public.operation_state_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
        LIMIT 50`,
      [SCOPE.tenant_id,SCOPE.project_id,SCOPE.group_id,SCOPE.field_id]);

    const alerts = await safeQuery(pool, "alerts",
      `SELECT event_id, status, metric, raised_ts_ms
         FROM public.alert_event_index_v1
        WHERE tenant_id=$1 AND object_id=$2
        ORDER BY raised_ts_ms DESC NULLS LAST LIMIT 50`,
      [SCOPE.tenant_id,SCOPE.field_id]);

    console.log("PRODUCT_API_EXISTING_FACT_INVENTORY_V1="+JSON.stringify({
      schema_version:"product_api_existing_fact_inventory_v1",
      authority_ceiling:"READ_ONLY_NON_AUTHORITATIVE_DIAGNOSTIC",
      production_mutation:false,
      scope:SCOPE,
      results:[session,fieldIndex,geometry,factTypes,bline,asExecuted,memory,operationState,alerts],
    }));
    setInterval(()=>undefined,60_000);
  } finally {
    await pool.end().catch(()=>undefined);
  }
}
void main().catch((e)=>{console.error("PRODUCT_API_EXISTING_FACT_INVENTORY_V1_FAILED",e);process.exit(1);});
