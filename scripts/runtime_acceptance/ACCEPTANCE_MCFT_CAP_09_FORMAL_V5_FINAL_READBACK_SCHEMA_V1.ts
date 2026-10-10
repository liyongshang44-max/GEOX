import assert from "node:assert/strict";

import { Pool } from "pg";

const EXPECTED:Record<string,string[]>={
  facts:["fact_id","source","record_json"],
  twin_shadow_online_scheduler_slot_v1:["slot_id","logical_time","state","fencing_token","tick_ref","health_ref","terminal_at"],
  twin_terminal_tick_uniqueness_v1:["logical_time","source_tick_object_id","record_set_id","aggregate_determinism_hash"],
  twin_shadow_online_scheduler_cursor_v1:["schedule_start_logical_time","next_slot_index","next_slot_id","next_logical_time","last_terminal_slot_id","last_terminal_logical_time","last_fencing_token"],
  twin_state_latest_index_v1:["state_object_id","logical_time","determinism_hash"],
  twin_runtime_checkpoint_latest_index_v1:["checkpoint_object_id","logical_time","determinism_hash"],
  twin_runtime_health_latest_index_v1:["health_object_id","operation_status","logical_time","determinism_hash"],
  twin_forecast_result_latest_index_v1:["forecast_object_id","logical_time","determinism_hash"],
  twin_runtime_lease_v1:["lease_owner","fencing_token","expires_at"],
  twin_external_formal_forcing_base_cursor_v1:["subject_sha","first_required_base","last_required_base","last_contiguous_eligible_base","next_missing_required_base","completed"],
  twin_external_formal_forcing_base_target_v1:[
    "subject_sha","base_target_t","causal_deadline","state","fencing_token","producer_run_id","promotion_run_id","candidate_artifact_digest",
    "weather_fact_id","weather_source_record_hash","weather_record_semantic_hash",
    "et0_fact_id","et0_source_record_hash","et0_record_semantic_hash",
    "soil_fact_id","soil_source_record_hash","soil_record_semantic_hash",
    "post_commit_db_readback_at","formal_visible_attested_at","failure_class",
  ],
  twin_external_formal_forcing_controller_lease_v1:[
    "subject_sha","lifecycle_state","lease_owner","fencing_token","lease_expires_at","terminal_at","terminal_reason",
  ],
};

async function main():Promise<void>{
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("FORMAL_V5_FINAL_SCHEMA_SMOKE_DATABASE_URL_REQUIRED");
  const pool=new Pool({connectionString:url,max:1,application_name:"mcft-cap09-formal-v5-final-schema-smoke"});
  try{
    for(const [table,expected] of Object.entries(EXPECTED)){
      const rows=(await pool.query<{column_name:string}>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position`,
        [table],
      )).rows.map((row)=>row.column_name);
      assert.ok(rows.length>0,"FORMAL_V5_FINAL_SCHEMA_TABLE_REQUIRED:"+table);
      for(const column of expected){
        assert.ok(rows.includes(column),"FORMAL_V5_FINAL_SCHEMA_COLUMN_REQUIRED:"+table+":"+column);
      }
    }
    process.stdout.write(JSON.stringify({
      schema_version:"geox_mcft_cap09_formal_v5_final_readback_schema_smoke_v1",
      status:"PASS",
      validated_table_count:Object.keys(EXPECTED).length,
      validated_column_count:Object.values(EXPECTED).reduce((n,row)=>n+row.length,0),
      database_write_count:0,
      mcft_cap09_completed:false,
    },null,2)+"\n");
  }finally{
    await pool.end();
  }
}
main().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
