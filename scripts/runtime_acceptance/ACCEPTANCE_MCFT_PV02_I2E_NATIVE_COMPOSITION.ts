// I1 end-to-end integration: real MQTT worker, real PostgreSQL, actual native
// Evidence Ingress. Fixture provisioning only; never seed a telemetry/evidence fact.
import assert from "node:assert/strict";
import { composeCustomerNativeRuntimeV1 } from "../../apps/server/src/runtime/twin_runtime/customer_native_runtime_composer_v1.js";
import type { CustomerScalarRuntimeConfigV1 } from "../../apps/server/src/domain/twin_runtime/customer_scalar_runtime_config_v1.js";
import type { CustomerScalarObservationV1,SyntheticRootZoneOperatorV1 } from "../../apps/server/src/domain/soil_water/customer_scalar_assimilation_v1.js";
import type { CustomerForecastForcingPointV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { Pool } from "pg";
import mqtt from "mqtt";
import { freezeCustomerSoilEvidenceV1, type CustomerSoilMeasurementBindingV1 } from "../../apps/server/src/runtime/twin_runtime/customer_soil_evidence_ingress_v1.js";
import type { ShadowOnlineBoundaryV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
const require=createRequire(import.meta.url);
const {provisionDeviceIdentityFixture}=require("../acceptance/p1_device_identity_fixture.cjs");
const needed=(name:string)=>{const v=process.env[name];if(!v)throw Error(name+"_REQUIRED");return v;};
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
async function main(){
  // Explicitly isolated CI/test fixture; never run against a customer database.
  assert.equal(process.env.MCFT_I1_TEST_ONLY,"1");
  const fixtureUrl=needed("DATABASE_URL");
  const readUrl=needed("MCFT_I1_READ_DATABASE_URL");
  const mqttUrl=needed("MCFT_I1_MQTT_URL");
  assert.equal(new URL(fixtureUrl).hostname,"127.0.0.1");
  assert.equal(new URL(fixtureUrl).pathname,"/geox_pv02_i1_test");
  assert.equal(new URL(readUrl).pathname,"/geox_pv02_i1_test");
  assert.equal(new URL(readUrl).hostname,"127.0.0.1");
  assert.equal(new URL(mqttUrl).hostname,"127.0.0.1");
  const tag=randomUUID().replace(/-/g,"");
  const scope:TwinScopeKeyV1={tenant_id:"i1_test_t_"+tag,project_id:"i1_test_p_"+tag,group_id:"i1_test_g_"+tag,
    field_id:"i1_test_field_"+tag,season_id:"i1_test_season_"+tag,zone_id:"i1_test_zone_"+tag};
  const good="i1_test_sensor_"+tag, unbound="i1_test_unbound_"+tag;
  const fixtures=new Map<string,{secret:string}>();
  const pool=new Pool({connectionString:readUrl});
  let broker:ReturnType<typeof mqtt.connect>|undefined;
  try {
    for(const id of [good,unbound]) fixtures.set(id,await provisionDeviceIdentityFixture({databaseUrl:fixtureUrl,tenant:scope,deviceId:id,fieldId:scope.field_id}));
    const bind=(await pool.query("SELECT bound_ts_ms FROM device_binding_index_v1 WHERE tenant_id=$1 AND device_id=$2",[scope.tenant_id,good])).rows;
    assert.equal(bind.length,1);
    const b:CustomerSoilMeasurementBindingV1={scope,device_id:good,binding_id:"i1_test_measurement_"+tag,dataset_id:"i1_test_dataset_"+tag,
      installation_ref:"i1_test_installation_"+tag,location_ref:"i1_test_point_"+tag,field_bound_ts_ms:Number(bind[0].bound_ts_ms),
      effective_from:new Date(Number(bind[0].bound_ts_ms)).toISOString(),effective_until:new Date(Date.now()+3600000).toISOString(),
      measurement_depth_mm:150,test_only:true};
    const who=(await pool.query("SELECT current_user AS name")).rows[0].name;
    assert.equal(who,"geox_runtime_v1","native evidence read uses existing runtime role, not DB owner");
    const acl=(await pool.query(`SELECT has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
      r.rolsuper AS superuser,r.rolbypassrls AS bypassrls,
      pg_get_userbyid(c.relowner) AS relation_owner,
      has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
      has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
      has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
      has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,
      has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate,
      has_table_privilege(current_user,c.oid,'SELECT WITH GRANT OPTION') AS grant_select
      FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE r.rolname=current_user AND n.nspname='public' AND c.relname='field_sensing_summary_stage1_v1'`)).rows[0];
    assert.ok(acl);
    for(const key of ["schema_create","database_create","superuser","bypassrls","can_truncate","grant_select"])assert.equal(acl[key],false,key);
    for(const key of ["can_select","can_insert","can_update","can_delete"])assert.equal(acl[key],true,key);
    assert.notEqual(acl.relation_owner,who);

    broker=mqtt.connect(mqttUrl,{username:needed("MCFT_I1_MQTT_USERNAME"),password:needed("MCFT_I1_MQTT_PASSWORD"),
      reconnectPeriod:0,connectTimeout:10000});
    await new Promise<void>((resolve,reject)=>{broker!.once("connect",resolve);broker!.once("error",reject);});
    const cases=[
      {label:"normal_first",device:good,value:25,unit:"%VWC",observation:true},
      {label:"hard_range",device:good,value:150,unit:"%VWC",observation:true},
      {label:"non_numeric",device:good,value:"not_numeric",unit:"%VWC",observation:false},
      {label:"missing_value",device:good,value:null,unit:"%VWC",observation:false},
      {label:"wrong_unit",device:good,value:25,unit:"mm",observation:true},
      {label:"missing_support",device:unbound,value:25,unit:"%VWC",observation:true},
      {label:"normal_last",device:good,value:31,unit:"%VWC",observation:true},
    ];
    const results=[];
    for(const c of cases){
      await sleep(20);
      const ts=Date.now();
      const rawId="tel_"+sha([scope.tenant_id,c.device,"soil_moisture",ts].join("|"));
      const payload=JSON.stringify({metric:"soil_moisture",value:c.value,unit:c.unit,ts_ms:ts,credential:fixtures.get(c.device)!.secret});
      const topic="telemetry/"+scope.tenant_id+"/"+c.device;
      await new Promise<void>((resolve,reject)=>broker!.publish(topic,payload,{qos:1},e=>e?reject(e):resolve()));
      let row:any;
      for(let attempt=0;attempt<120;attempt++){
        const rows=(await pool.query(`SELECT r.record_json AS raw,o.fact_id AS observation_id,o.record_json AS observation
          FROM facts r LEFT JOIN facts o ON o.record_json->>'type'='device_observation_v1'
          AND o.record_json#>>'{payload,source_fact_id}'=r.fact_id WHERE r.fact_id=$1`,[rawId])).rows;
        if(rows.length===1&&(!c.observation||rows[0].observation_id)){row=rows[0];break;}
        await sleep(250);
      }
      assert.ok(row,"MQTT fact missing: "+c.label);
      assert.equal(Boolean(row.observation_id),c.observation,c.label);
      assert.equal(row.raw.payload.value,c.value);
      assert.equal(row.raw.payload.unit,c.unit);
      assert.equal(row.raw.payload.field_binding.project_id,scope.project_id);
      assert.equal(row.raw.payload.field_binding.group_id,scope.group_id);
      assert.equal(row.raw.payload.field_binding.field_id,scope.field_id);
      if(c.observation){
        assert.equal(row.observation.entity.tenant_id,scope.tenant_id);
        assert.equal(row.observation.entity.project_id,scope.project_id);
        assert.equal(row.observation.entity.group_id,scope.group_id);
        assert.equal(row.observation.entity.field_id,scope.field_id);
        assert.deepEqual(row.observation.payload.ingress_physical_qc,row.raw.payload.ingress_physical_qc);
      }
      results.push({label:c.label,raw_fact_id:rawId,observation_fact_id:row.observation_id??null,
        physical_qc:row.raw.payload.ingress_physical_qc.physical_qc,observed_at:new Date(ts).toISOString()});
    }
    const now=new Date().toISOString();
    const boundary:ShadowOnlineBoundaryV1={scope,slot_id:"O00",logical_time:now,scheduler_wall_clock_observed_at:now,interval_seconds:3600};
    const receipt=await freezeCustomerSoilEvidenceV1({pool,boundary,bindings:[b],test_only:true});
    const accepted=results.filter(x=>x.label.startsWith("normal"));
    assert.deepEqual(receipt.frozen.selected.map(x=>x.evidence_ref).sort(),accepted.map(x=>x.observation_fact_id).sort());
    assert.equal(receipt.records.length,2);
    assert.deepEqual(receipt.records.map(x=>x.canonical_payload.value),[0.25,0.31]);
    for(const record of receipt.records){
      assert.equal(record.canonical_payload.measurement_depth_mm,150);
      assert.equal(record.canonical_payload.direct_root_zone_equivalence,false);
      assert.equal(record.is_simulated,true);
      assert.equal(record.formal_eligible,false);
    }
    const reason:Record<string,string>={hard_range:"PHYSICAL_QC_ABOVE_HARD_MAX",non_numeric:"PHYSICAL_QC_NON_NUMERIC_VALUE",
      missing_value:"PHYSICAL_QC_MISSING_VALUE",wrong_unit:"PHYSICAL_QC_UNIT_UNQUALIFIED",missing_support:"CUSTOMER_MEASUREMENT_SUPPORT_UNBOUND"};
    assert.equal(receipt.rejected.length,5);
    for(const r of results.filter(x=>!x.label.startsWith("normal"))){
      assert.equal(receipt.rejected.find(x=>x.raw_fact_id===r.raw_fact_id)?.reason,reason[r.label],r.label);
    }
    const other=await freezeCustomerSoilEvidenceV1({pool,boundary:{...boundary,scope:{...scope,tenant_id:"other_"+tag}},bindings:[],test_only:true});
    assert.equal(other.frozen.selected.length,0);
    assert.equal(other.rejected.length,0);
    await assert.rejects(()=>freezeCustomerSoilEvidenceV1({pool,boundary:{...boundary,scope:{...scope,tenant_id:"other_"+tag}},bindings:[b],test_only:true}),/CUSTOMER_MEASUREMENT_BINDING_INVALID/);

    // Existing I1 MQTT fixture produced actual raw and observation facts above.
    // Model time is explicitly advanced to the next hour for the isolated test,
    // not a real operational tick. The same real fact identities are consumed.
    const hourEnd=new Date(Math.ceil(Date.parse(now)/3600000)*3600000).toISOString();
    const hourStart=new Date(Date.parse(hourEnd)-3600000).toISOString();
    const nextHour=new Date(Date.parse(hourEnd)+3600000).toISOString();
    const until=new Date(Date.parse(hourEnd)+75*3600000).toISOString();
    const param=(value:string,definition:string)=>({value,definition,source_ref:"test:fixture-"+definition});
    const config:CustomerScalarRuntimeConfigV1={
      schema_version:"mcft_customer_scalar_runtime_config_v1",test_only:true,
      scope:{tenant_id:scope.tenant_id,project_id:scope.project_id,group_id:scope.group_id!,field_id:scope.field_id,season_id:scope.season_id!,zone_id:scope.zone_id!},
      effective_from:hourStart,effective_until:until,crop_stage_code:"TEST_STAGE",crop_context_ref:"test:crop",kc_decimal:"1.000000",
      support:{kind:"SINGLE_EFFECTIVE_ROOT_ZONE",soil_type:"synthetic-homogeneous",support_ref:"test:root-support"},
      hydraulic:{root_depth_mm:param("400.000000","root-depth-mm"),field_capacity_fraction:param("0.280000","fc"),wilting_point_fraction:param("0.100000","pwp"),saturation_fraction:param("0.440000","sat")},
      dynamics:{runoff_fraction:"0.100000",drainage_coefficient_per_hour:"0.200000",structural_process_stddev_mm_per_hour:"0.100000",rainfall_relative_stddev:"0.100000",crop_et_relative_stddev:"0.100000",executed_irrigation_relative_stddev:"0.100000"},
      dynamics_source_ref:"test:controlled-process",parameter_uncertainty:"UNKNOWN_NOT_PROPAGATED"};
    const future=(issue:string):CustomerForecastForcingPointV1[]=>Array.from({length:72},(_,i)=>({
      horizon_hour:i+1,interval_start:new Date(Date.parse(issue)+i*3600000).toISOString(),
      interval_end:new Date(Date.parse(issue)+(i+1)*3600000).toISOString(),target_time:new Date(Date.parse(issue)+(i+1)*3600000).toISOString(),
      precipitation_assumption_mm:i===5?"5.000000":"0.000000",et0_assumption_mm:"0.100000",crop_stage_code:config.crop_stage_code,kc:config.kc_decimal,
      weather_source_ref:"test:forecast-rain-"+i,et0_source_ref:"test:forecast-et0-"+i,issued_at:issue,available_at:issue}));
    const historical=(start:string,end:string)=>({interval_start:start,interval_end:end,available_at:end,rainfall_mm:"10.000000",et0_mm:"1.000000",
      rainfall_source_ref:"test:rain",et0_source_ref:"test:et0",irrigation_zero_source_ref:"test:known-zero-irrigation"});
    const base={pool,boundary:{...boundary,logical_time:hourEnd,scheduler_wall_clock_observed_at:hourEnd},
      bindings:[b],customer_config:config,initialization:{kind:"WEAK_BOOTSTRAP" as const},historical:historical(hourStart,hourEnd),future:future(hourEnd)};
    const a=await composeCustomerNativeRuntimeV1(base);
    assert.equal(a.retained_observations.length,2);
    assert.deepEqual(a.selected_evidence_refs.sort(),accepted.map(x=>x.observation_fact_id).sort());
    assert.equal(a.assimilation,null);assert.equal(a.forecast.source_state_kind,"PRIOR_DRIVEN_NO_ASSIMILATION");
    const obs:CustomerScalarObservationV1={test_only:true,scope:config.scope,source_record_id:"test:synthetic-root-mean",binding_id:"test:synthetic-root-binding",
      observed_at:hourEnd,available_at:hourEnd,value_fraction:Number(a.propagated.published_state.root_zone_vwc_fraction.mean)+0.001,
      quality_status:"PASS",support:{kind:"SYNTHETIC_ROOT_ZONE_MEAN",root_zone_depth_mm:"400.000000",support_ref:config.support.support_ref}};
    const operator:SyntheticRootZoneOperatorV1={test_only:true,kind:"SYNTHETIC_ROOT_ZONE_MEAN_H1_V1",binding_id:obs.binding_id,
      support_ref:config.support.support_ref,observation_variance:0.0001,variance_source_ref:"test:controlled-variance",effective_from:hourStart,effective_until:until};
    const bRun=await composeCustomerNativeRuntimeV1({...base,synthetic_root_mean:{observation:obs,operator}});
    assert.equal(bRun.assimilation?.status,"APPLIED_SYNTHETIC_ROOT_ZONE_MEAN");
    assert.equal(bRun.forecast.source_state_kind,"SYNTHETIC_ROOT_ZONE_MEAN_ASSIMILATED");
    for(const run of [a,bRun]){assert.equal(run.forecast.points.length,72);assert.ok(run.forecast.points.every(p=>p.mass_balance_error_mm==="0.000000"));assert.equal(run.formal_eligible,false);}
    const continuation=await composeCustomerNativeRuntimeV1({...base,boundary:{...base.boundary,logical_time:nextHour,scheduler_wall_clock_observed_at:nextHour},initialization:{kind:"CONTINUATION",previous:bRun.state},historical:historical(hourEnd,nextHour),future:future(nextHour)});
    assert.equal(continuation.previous.state_ref,bRun.state.state_ref);
    await assert.rejects(()=>composeCustomerNativeRuntimeV1({...base,boundary:{...base.boundary,logical_time:nextHour,scheduler_wall_clock_observed_at:nextHour},initialization:{kind:"CONTINUATION",previous:{...bRun.state,state_ref:"test:tampered"}},historical:historical(hourEnd,nextHour),future:future(nextHour)}),/STATE_IDENTITY_MISMATCH/);
    await assert.rejects(()=>composeCustomerNativeRuntimeV1({...base,future:[]}),/EXACT_72_POINTS/);
    const composed={status:"PASS_I2E_MQTT_NATIVE_COMPOSER_TEST_ONLY",a,b:bRun,continuation};
    mkdirSync("acceptance-output",{recursive:true});writeFileSync("acceptance-output/MCFT_PV02_I2E_NATIVE_COMPOSITION.json",JSON.stringify(composed,null,2)+"\n");
    console.log(JSON.stringify({status:composed.status,observations:a.retained_observations.map(x=>({ref:x.source_record_id,value:x.value_fraction,depth:x.measurement_depth_mm,reason:x.reason})),
      a:{storage:a.propagated.published_state.root_zone_storage_mm.mean,points:a.forecast.points.length,final:a.forecast.aggregates.final_storage_mm,hash:a.composition_hash},
      b:{storage:bRun.state.schema_version==="mcft_customer_assimilated_scalar_state_v1"?bRun.state.storage_mm:null,points:bRun.forecast.points.length,final:bRun.forecast.aggregates.final_storage_mm,hash:bRun.composition_hash},
      continuation:{prior:continuation.previous.state_ref,storage:continuation.propagated.published_state.root_zone_storage_mm.mean},persisted:false}));
    const report={status:"PASS_CUSTOMER_MQTT_TO_NATIVE_EVIDENCE_INGRESS_TEST_ONLY",scope,binding:b,read_role:who,
      cases:results,native_ingress:receipt,projection_acl:acl,other_tenant_selected:0,physical_started:false,root_zone_prediction:false};
    mkdirSync("acceptance-output",{recursive:true});
    writeFileSync("acceptance-output/MCFT_PV02_I1_NATIVE_MQTT.json",JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  } finally {
    if(broker)broker.end(true);
    await pool.end();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
