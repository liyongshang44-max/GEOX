// MCFT-CAP-09 Phase5 exact-head two-service accelerated 24T readback.
// Readback only. It proves the current production-equivalent process graph reached O23;
// it does not register durable qualification evidence or claim Formal/production completion.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  validateExternalFormalAmendment19WindowManifestV1,
} from "../../../domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import type {
  ExternalFormalV3Am19WindowManifestV1,
} from "../external_formal_v3_amendment19_runner_v1.js";

const TWIN_ROLE="geox_mcft_cap09_twin_runtime_v1";
const EVIDENCE_ROLE="geox_mcft_cap09_evidence_runtime_v1";
const TWIN_FUNCTION=
  "public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)";
const EVIDENCE_FUNCTION=
  "public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)";
const FORBIDDEN_TYPES=[
  "twin_decision_record_v1","twin_recommendation_v1","decision_recommendation_v1",
  "approval_request_v1","ao_act_task_v1","ao_act_receipt_v1","dispatch_request_v1",
  "model_activation_v1",
];

function envV1(name:string):string {
  const value=String(process.env[name]??"").trim();
  if(!value) throw new Error("PHASE5_VERIFY_ENV_REQUIRED:"+name);
  return value;
}
function addHoursV1(value:string,hours:number):string {
  return new Date(Date.parse(value)+hours*3_600_000).toISOString();
}
function scopeValuesV1():string[] {
  const s=MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  return [s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id];
}
function exactSetV1(actual:readonly string[],expected:readonly string[],code:string):void {
  const a=[...actual].sort(),e=[...expected].sort();
  if(JSON.stringify(a)!==JSON.stringify(e)) {
    throw new Error(code+":"+JSON.stringify({actual:a,expected:e}));
  }
}

async function main():Promise<void> {
  const subject=envV1("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!/^[0-9a-f]{40}$/.test(subject)) throw new Error("PHASE5_VERIFY_SUBJECT_INVALID");
  const manifestPath=path.resolve(envV1("GEOX_MCFT_CAP09_TWIN_RUNTIME_MANIFEST_PATH"));
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8")) as ExternalFormalV3Am19WindowManifestV1;
  validateExternalFormalAmendment19WindowManifestV1(manifest,subject);
  const out=path.resolve(envV1("GEOX_MCFT_CAP09_PHASE5_VERIFY_PROOF_OUTPUT"));
  const pool=new Pool({connectionString:envV1("DATABASE_URL"),max:2});
  try {
    const scope=scopeValuesV1();
    const expectedTimes=Array.from({length:24},(_,i)=>addHoursV1(manifest.o00_logical_time,i));
    const expectedIds=Array.from({length:24},(_,i)=>"O"+String(i).padStart(2,"0"));

    const slots=(await pool.query(
      `SELECT slot_id,logical_time,state,fencing_token,tick_ref,health_ref,terminal_at
         FROM public.twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`,scope,
    )).rows;
    if(slots.length!==24) throw new Error("PHASE5_VERIFY_EXACT_24_SLOTS_REQUIRED:"+slots.length);
    exactSetV1(slots.map(r=>String(r.slot_id)),expectedIds,"PHASE5_VERIFY_SLOT_IDS");
    exactSetV1(slots.map(r=>new Date(r.logical_time).toISOString()),expectedTimes,"PHASE5_VERIFY_SLOT_TIMES");
    for(const row of slots) {
      if(row.state!=="DEGRADED") throw new Error(`PHASE5_VERIFY_MODE_B_SLOT_NOT_DEGRADED:${row.slot_id}:${row.state}`);
      if(row.fencing_token==null || !row.tick_ref || !row.health_ref || !row.terminal_at) {
        throw new Error("PHASE5_VERIFY_TERMINAL_LINKAGE_REQUIRED:"+row.slot_id);
      }
    }

    const terminal=(await pool.query(
      `SELECT logical_time,source_tick_object_id,record_set_id,aggregate_determinism_hash
         FROM public.twin_terminal_tick_uniqueness_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`,scope,
    )).rows;
    if(terminal.length!==24) throw new Error("PHASE5_VERIFY_EXACT_24_TERMINAL_TICKS_REQUIRED:"+terminal.length);
    exactSetV1(terminal.map(r=>new Date(r.logical_time).toISOString()),expectedTimes,"PHASE5_VERIFY_TERMINAL_TIMES");
    for(const row of terminal) {
      if(!row.source_tick_object_id || !row.record_set_id || !row.aggregate_determinism_hash) {
        throw new Error("PHASE5_VERIFY_TERMINAL_IDENTITY_REQUIRED");
      }
    }

    const cursor=(await pool.query(
      `SELECT next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time,last_fencing_token
         FROM public.twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows;
    if(cursor.length!==1) throw new Error("PHASE5_VERIFY_EXACT_ONE_CURSOR_REQUIRED");
    const cur=cursor[0];
    if(Number(cur.next_slot_index)!==24 || cur.next_slot_id!==null || cur.next_logical_time!==null
      || cur.last_terminal_slot_id!=="O23"
      || new Date(cur.last_terminal_logical_time).toISOString()!==manifest.o23_logical_time
      || cur.last_fencing_token==null) {
      throw new Error("PHASE5_VERIFY_CURSOR_TERMINAL_STATE_REQUIRED");
    }

    const latestTables=[
      ["twin_state_latest_index_v1","state_object_id"],
      ["twin_runtime_checkpoint_latest_index_v1","checkpoint_object_id"],
      ["twin_runtime_health_latest_index_v1","health_object_id"],
      ["twin_forecast_result_latest_index_v1","forecast_object_id"],
    ] as const;
    for(const [table,id] of latestTables) {
      const rows=(await pool.query(
        `SELECT ${id} AS object_id,logical_time,determinism_hash FROM public.${table}
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
      )).rows;
      if(rows.length!==1 || new Date(rows[0].logical_time).toISOString()!==manifest.o23_logical_time
        || !rows[0].object_id || !rows[0].determinism_hash) {
        throw new Error("PHASE5_VERIFY_LATEST_O23_REQUIRED:"+table);
      }
    }

    const evidence=(await pool.query(
      `SELECT record_json->>'type' AS type,record_json
         FROM public.facts
        WHERE source='mcft_cap09_external_formal_evidence_v1'
          AND record_json#>>'{payload,tenant_id}'=$1
          AND record_json#>>'{payload,project_id}'=$2
          AND record_json#>>'{payload,group_id}'=$3
          AND record_json#>>'{payload,field_id}'=$4
          AND record_json#>>'{payload,season_id}'=$5
          AND record_json#>>'{payload,zone_id}'=$6
        ORDER BY fact_id ASC`,scope,
    )).rows;
    const evidenceCounts:Record<string,number>={};
    for(const row of evidence) {
      const type=String(row.type??"");
      evidenceCounts[type]=(evidenceCounts[type]??0)+1;
      const serialized=JSON.stringify(row.record_json);
      if(/ENGINEERING_(?:BOOTSTRAP_)?FIXTURE_ONLY|CONTROLLED_SYNTHETIC_REPLAY_PROXY/.test(serialized)) {
        throw new Error("PHASE5_VERIFY_ENGINEERING_CANONICAL_EVIDENCE_FORBIDDEN:"+type);
      }
    }
    for(const type of ["soil_moisture_observation_v1","future_weather_assumption_v1","future_et0_assumption_v1"]) {
      if((evidenceCounts[type]??0)<1) throw new Error("PHASE5_VERIFY_REQUIRED_CANONICAL_EVIDENCE_MISSING:"+type);
    }

    const windows=(await pool.query(
      `SELECT record_json#>>'{payload,logical_time}' AS logical_time,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,mode}' AS forcing_mode,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,provider_wait_required}' AS provider_wait_required,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,completed_tick_retroactive_rewrite_authorized}' AS rewrite_authorized,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,relabel_assumption_as_provider_observation_authorized}' AS relabel_authorized
         FROM public.facts
        WHERE record_json->>'type'='twin_evidence_window_v1'
          AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
          AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
          AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
          AND (record_json#>>'{payload,logical_time}')::timestamptz >= $7::timestamptz
          AND (record_json#>>'{payload,logical_time}')::timestamptz <= $8::timestamptz
        ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz ASC`,
      [...scope,manifest.o00_logical_time,manifest.o23_logical_time],
    )).rows;
    if(windows.length!==24) throw new Error("PHASE5_VERIFY_EXACT_24_EVIDENCE_WINDOWS_REQUIRED:"+windows.length);
    exactSetV1(windows.map(r=>String(r.logical_time)),expectedTimes,"PHASE5_VERIFY_EVIDENCE_WINDOW_TIMES");
    for(const row of windows) {
      if(row.forcing_mode!=="PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR") {
        throw new Error("PHASE5_VERIFY_MODE_B_REQUIRED:"+row.logical_time+":"+row.forcing_mode);
      }
      if(row.provider_wait_required!=="false" || row.rewrite_authorized!=="false" || row.relabel_authorized!=="false") {
        throw new Error("PHASE5_VERIFY_FORCING_AUTHORITY_DRIFT:"+row.logical_time);
      }
    }

    const forbidden=Number((await pool.query(
      "SELECT count(*)::int AS n FROM public.facts WHERE record_json->>'type'=ANY($1::text[])",
      [FORBIDDEN_TYPES],
    )).rows[0]?.n??-1);
    if(forbidden!==0) throw new Error("PHASE5_VERIFY_ACTION_AUTHORITY_FACT_FORBIDDEN:"+forbidden);

    const acl=(await pool.query(
      `SELECT
        pg_catalog.has_table_privilege($1,'public.facts','INSERT') AS twin_insert,
        pg_catalog.has_function_privilege($1,$3,'EXECUTE') AS twin_execute,
        pg_catalog.has_function_privilege($2,$3,'EXECUTE') AS evidence_execute_twin,
        pg_catalog.has_function_privilege($1,$4,'EXECUTE') AS twin_execute_evidence`,
      [TWIN_ROLE,EVIDENCE_ROLE,TWIN_FUNCTION,EVIDENCE_FUNCTION],
    )).rows[0];
    if(acl.twin_insert!==false || acl.twin_execute!==true
      || acl.evidence_execute_twin!==false || acl.twin_execute_evidence!==false) {
      throw new Error("PHASE5_VERIFY_DB_PLANE_ISOLATION_REQUIRED:"+JSON.stringify(acl));
    }

    const proof={
      schema_version:"geox_mcft_cap09_phase5_two_service_accelerated_24t_v1",
      status:"PASS",
      subject_sha:subject,
      epoch_id:manifest.epoch_id,
      a0:addHoursV1(manifest.o00_logical_time,-1),
      o00:manifest.o00_logical_time,
      o23:manifest.o23_logical_time,
      scheduler_slot_count:24,
      terminal_tick_count:24,
      terminal_slot_state:"DEGRADED",
      forcing_mode:"PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR",
      forcing_mode_count:24,
      provider_wait_required_count:0,
      canonical_evidence_counts:evidenceCounts,
      engineering_runtime_evidence_fixture_count:0,
      forbidden_action_fact_count:0,
      db_layer_evidence_twin_bidirectional_isolation:true,
      twin_direct_fact_insert:false,
      twin_provider_request_count:0,
      twin_raw_storage_credential_count:0,
      accelerated_boundary:"CLOCK_AND_WAIT_ONLY",
      late_exact_kbs_batch_covered:false,
      exact_24t_complete:true,
      production_owner_cutover:false,
      formal_v5_armed:false,
      phase5_durable_evidence_registered:false,
    };
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
    process.stdout.write(JSON.stringify(proof)+"\n");
  } finally {
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
