import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { DATABASE_EVIDENCE_INGRESS_CONFIG_V1, PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ShadowOnlineBoundaryV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_S2_POSTGRESQL_ACCEPTANCE_RESULT.json");
const SRC="mcft_cap09_s2_canonical_epistemic_compatibility_v1";
const scope:TwinScopeKeyV1={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"fieldA",season_id:"seasonA",zone_id:"zoneA"};
const boundary:ShadowOnlineBoundaryV1={scope,slot_id:"O10",logical_time:"2026-08-05T10:00:00.000Z",scheduler_wall_clock_observed_at:"2026-08-05T10:00:02.000Z",interval_seconds:3600};
type RT="soil_moisture_observation_v1"|"observed_rainfall_v1"|"historical_et0_estimate_v1"|"future_weather_assumption_v1"|"future_et0_assumption_v1";
type Opt={ing?:string;avail?:string;value?:number;origin?:string;quality?:string;omitQuality?:boolean;zone?:string;hash?:string;formal?:boolean;sim?:boolean;level?:string;lane?:string;epistemic?:string};
const sha=(v:unknown)=>`sha256:${crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex")}`;
const eventField=(t:RT)=>t==="soil_moisture_observation_v1"?"observed_at":t==="observed_rainfall_v1"||t==="historical_et0_estimate_v1"?"interval_end":"issued_at";
const canonicalEpistemic=(t:RT)=>t==="historical_et0_estimate_v1"?"ESTIMATED":t.startsWith("future_")?"ASSUMED":"OBSERVED";
function rec(id:string,t:RT,event:string,o:Opt={}):CanonicalReplayEvidenceRecordV1{
  const canonical_payload={value:o.value??1,record_type:t};
  const source_payload:Record<string,unknown>={acceptance:true};
  if(o.formal!==undefined)source_payload.formal_eligible=o.formal;
  if(o.sim!==undefined)source_payload.is_simulated=o.sim;
  if(o.level)source_payload.evidence_level=o.level;
  if(o.lane)source_payload.source_lane=o.lane;
  const ing=o.ing??event,avail=o.avail??ing;
  const r:CanonicalReplayEvidenceRecordV1={...scope,zone_id:o.zone??scope.zone_id,dataset_id:"cap09_s2_pg_acceptance_v3",source_record_id:id,source_record_hash:o.hash??sha({id,canonical_payload}),record_type:t,binding_id:`binding:${t}`,origin_source_kind:"CONTROLLED_DATABASE_EVIDENCE",origin_source_id:o.origin??`source:${t}`,epistemic_class:o.epistemic??canonicalEpistemic(t),available_to_runtime_at:avail,role_time:{[eventField(t)]:event,ingested_at:ing},quality:{status:o.quality??"PASS"},source_payload,canonical_payload,source_unit:"unitless",canonical_unit:"unitless",conversion_rule:{rule_id:"IDENTITY_V1"},limitations:[]};
  if(o.omitQuality)delete (r as unknown as Record<string,unknown>).quality;
  return r;
}
async function insert(pool:Pool,fact:string,r:CanonicalReplayEvidenceRecordV1){
  await pool.query(`INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)`,[fact,r.available_to_runtime_at,SRC,JSON.stringify({type:r.record_type,payload:r})]);
}
async function reset(pool:Pool){
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT,"docker/postgres/init/001_schema.sql"),"utf8"));
}
async function count(pool:Pool){return (await pool.query<{n:number}>("SELECT count(*)::int n FROM facts WHERE source=$1",[SRC])).rows[0].n;}
function canonicalFuture(kind:"weather"|"et0",id:string,issued:string,available:string){
  return buildCap04FutureForcingSnapshotV1({kind,logical_time:boundary.logical_time,issued_at:issued,available_to_runtime_at:available,source_record_id:id,seed:17,scope_override:scope});
}
async function seed(pool:Pool){
  const soil=rec("soil-0910","soil_moisture_observation_v1","2026-08-05T09:10:00.000Z",{ing:"2026-08-05T09:11:00.000Z",value:18.2,origin:"soil-sensor-1"});
  const weather=canonicalFuture("weather","weather-canonical-assumed","2026-08-05T09:40:00.000Z","2026-08-05T09:41:00.000Z");
  const futureEt0=canonicalFuture("et0","et0-canonical-assumed","2026-08-05T09:50:00.000Z","2026-08-05T09:51:00.000Z");
  assert.equal(weather.epistemic_class,"ASSUMED");
  assert.equal(futureEt0.epistemic_class,"ASSUMED");
  const rows:[string,CanonicalReplayEvidenceRecordV1][]=[
    ["f01",soil],["f02",structuredClone(soil)],
    ["f03",rec("rain-0930","observed_rainfall_v1","2026-08-05T09:30:00.000Z",{ing:"2026-08-05T09:31:00.000Z",origin:"weather-1"})],
    ["f04",weather],
    ["f05",rec("et0-historical-estimated-0945","historical_et0_estimate_v1","2026-08-05T09:45:00.000Z",{ing:"2026-08-05T09:46:00.000Z",quality:"LIMITED",origin:"et0-1",epistemic:"ESTIMATED"})],
    ["f06",futureEt0],
    ["f07",rec("soil-out-of-order-0920","soil_moisture_observation_v1","2026-08-05T09:20:00.000Z",{ing:"2026-08-05T09:55:00.000Z",avail:"2026-08-05T09:56:00.000Z",origin:"soil-2"})],
    ["f08",rec("after-boundary","soil_moisture_observation_v1","2026-08-05T10:05:00.000Z",{ing:"2026-08-05T09:58:00.000Z",avail:"2026-08-05T10:06:00.000Z"})],
    ["f09",rec("late-ingested","observed_rainfall_v1","2026-08-05T09:35:00.000Z",{ing:"2026-08-05T10:02:00.000Z",avail:"2026-08-05T09:59:00.000Z"})],
    ["f10",rec("late-available","soil_moisture_observation_v1","2026-08-05T09:36:00.000Z",{ing:"2026-08-05T09:37:00.000Z",avail:"2026-08-05T10:03:00.000Z"})],
    ["f11",rec("quality-fail","soil_moisture_observation_v1","2026-08-05T09:25:00.000Z",{ing:"2026-08-05T09:26:00.000Z",quality:"FAIL"})],
    ["f12",rec("open-start","soil_moisture_observation_v1","2026-08-05T09:00:00.000Z",{ing:"2026-08-05T09:01:00.000Z",avail:"2026-08-05T09:58:00.000Z"})],
    ["f13",rec("wrong-scope","soil_moisture_observation_v1","2026-08-05T09:25:00.000Z",{ing:"2026-08-05T09:26:00.000Z",zone:"zoneB"})],
    ["f14",rec("simulated-debug","soil_moisture_observation_v1","2026-08-05T09:24:00.000Z",{ing:"2026-08-05T09:25:00.000Z",formal:false,sim:true,level:"DEBUG",lane:"SIMULATED_DEV_ONLY"})],
    ["f15",rec("missing-quality","soil_moisture_observation_v1","2026-08-05T09:26:00.000Z",{ing:"2026-08-05T09:27:00.000Z",omitQuality:true})],
    ["f16",rec("future-noncanonical-alias","future_weather_assumption_v1","2026-08-05T09:42:00.000Z",{ing:"2026-08-05T09:43:00.000Z",epistemic:"FUTURE_ASSUMPTION",origin:"forecast-alias"})],
    ["f17",rec("historical-et0-wrong-observed","historical_et0_estimate_v1","2026-08-05T09:47:00.000Z",{ing:"2026-08-05T09:48:00.000Z",epistemic:"OBSERVED",origin:"et0-wrong"})]
  ];
  for(const [fact,record] of rows)await insert(pool,fact,record);
}
async function main(){
  if(process.env.MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE!=="1")throw new Error("SET_MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE_1");
  const url=process.env.DATABASE_URL;if(!url)throw new Error("DATABASE_URL_REQUIRED");
  const db=decodeURIComponent(new URL(url).pathname.slice(1));
  if(!/(mcft|cap.*09|s2|acceptance|test)/i.test(db))throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${db}`);
  const pool=new Pool({connectionString:url});
  const sql:string[]=[];
  try{
    await reset(pool);await seed(pool);
    const logging={async connect(){const c=await pool.connect();return{async query(q:string,v?:unknown[]){sql.push(q);return c.query(q,v)},release(){c.release()}}}};
    const adapter=new PostgresEvidenceIngressAdapterV1(logging as never,DATABASE_EVIDENCE_INGRESS_CONFIG_V1);
    const before=await count(pool);
    const first=await adapter.freezeEligibleEvidence({boundary});
    const second=await adapter.freezeEligibleEvidence({boundary});
    assert.deepEqual(second,first,"DETERMINISTIC_REPEATED_FREEZE_REQUIRED");
    assert.equal(await count(pool),before,"ADAPTER_MUST_NOT_WRITE_FACTS");
    assert.equal(first.selected.length,6);
    assert.equal(first.excluded.length,9);
    assert.deepEqual(first.outside_window_evidence_refs,["open-start"]);
    assert.deepEqual(first.out_of_order_evidence_refs,["soil-out-of-order-0920"]);
    assert.equal(first.coverage_ratio_decimal,"1.000000");
    assert.equal(first.freshest_observed_at,"2026-08-05T09:45:00.000Z","FUTURE_FORCING_MUST_NOT_MASK_ACTUAL_FRESHNESS");
    assert.equal(first.maximum_gap_seconds,900);
    assert.equal(first.eligible_future_forcing_count,2);
    const refs=new Set(first.selected.map(x=>x.evidence_ref));
    assert(refs.has("weather-canonical-assumed")&&refs.has("et0-canonical-assumed"),"CAP04_CANONICAL_ASSUMED_FUTURE_FORCING_REQUIRED");
    assert(refs.has("et0-historical-estimated-0945"),"CANONICAL_ESTIMATED_HISTORICAL_ET0_REQUIRED");
    assert(!refs.has("future-noncanonical-alias")&&!refs.has("historical-et0-wrong-observed"),"NONCANONICAL_EPISTEMIC_CLASS_MUST_FAIL_CLOSED");
    assert(!refs.has("wrong-scope"));assert(!refs.has("simulated-debug"));assert(!refs.has("missing-quality"));
    const reasons=new Map<string,number>();for(const x of first.excluded)reasons.set(x.reason,(reasons.get(x.reason)??0)+1);
    assert.equal(reasons.get("DUPLICATE_SUPERSEDED"),1);assert.equal(reasons.get("QUALITY_INELIGIBLE"),5);
    const selects=sql.filter(q=>/FROM facts/i.test(q));
    assert.equal(sql.filter(q=>/^BEGIN TRANSACTION READ ONLY$/i.test(q)).length,2);assert.equal(selects.length,2);
    for(const q of selects){assert.match(q,/season_id\}' = \$5/);assert.match(q,/zone_id\}' = \$6/);assert.match(q,/occurred_at > \$8::timestamptz/);assert.doesNotMatch(q,/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);}
    await insert(pool,"f18",rec("soil-0910","soil_moisture_observation_v1","2026-08-05T09:10:00.000Z",{ing:"2026-08-05T09:12:00.000Z",value:99,origin:"soil-sensor-1",hash:sha("different")}));
    await assert.rejects(()=>adapter.freezeEligibleEvidence({boundary}),/EVIDENCE_IDENTITY_CONFLICT:soil-0910/);
    await pool.query("DELETE FROM facts WHERE fact_id='f18'");
    const a=rec("semantic-a","soil_moisture_observation_v1","2026-08-05T09:12:00.000Z",{ing:"2026-08-05T09:13:00.000Z",value:20,origin:"semantic-source"});
    const b=rec("semantic-b","soil_moisture_observation_v1","2026-08-05T09:12:00.000Z",{ing:"2026-08-05T09:14:00.000Z",value:21,origin:"semantic-source"});
    await insert(pool,"f19",a);await insert(pool,"f20",b);
    await assert.rejects(()=>adapter.freezeEligibleEvidence({boundary}),/CONFLICTING_DUPLICATE_OBSERVATION/);
    await pool.query("DELETE FROM facts WHERE fact_id=ANY($1::text[])",[["f19","f20"]]);
    const cs={...scope,zone_id:"zoneCluster"};const cb={...boundary,scope:cs};
    const clustered=[
      rec("c1","soil_moisture_observation_v1","2026-08-05T09:05:00.000Z",{ing:"2026-08-05T09:06:00.000Z",zone:"zoneCluster"}),
      rec("c2","observed_rainfall_v1","2026-08-05T09:10:00.000Z",{ing:"2026-08-05T09:11:00.000Z",zone:"zoneCluster"}),
      rec("c3","historical_et0_estimate_v1","2026-08-05T09:20:00.000Z",{ing:"2026-08-05T09:21:00.000Z",zone:"zoneCluster",epistemic:"ESTIMATED"}),
      rec("c4","future_weather_assumption_v1","2026-08-05T09:50:00.000Z",{ing:"2026-08-05T09:51:00.000Z",zone:"zoneCluster",epistemic:"ASSUMED"})
    ];
    for(const [index,record] of clustered.entries())await insert(pool,`c${index}`,record);
    const cluster=await adapter.freezeEligibleEvidence({boundary:cb});
    assert.equal(cluster.coverage_ratio_decimal,"0.500000");assert.equal(cluster.covered_interval_bucket_count,1);assert.equal(cluster.actual_observation_count,3);assert.equal(cluster.freshest_observed_at,"2026-08-05T09:20:00.000Z");
    assert.deepEqual(await adapter.freezeEligibleEvidence({boundary}),first);
    const result={status:"PASS",acceptance_mode:"REAL_POSTGRESQL_ISOLATED_FACTS_READBACK",selected_count:first.selected.length,excluded_count:first.excluded.length,outside_window_count:first.outside_window_evidence_refs.length,out_of_order_count:first.out_of_order_evidence_refs.length,eligible_future_forcing_count:first.eligible_future_forcing_count,exact_duplicate_deduplicated:true,same_ref_conflict_rejected:true,semantic_duplicate_conflict_rejected:true,interval_bucket_coverage_proven:true,clustered_interval_coverage_ratio:cluster.coverage_ratio_decimal,trust_flags_fail_closed:true,missing_quality_fail_closed:true,actual_observation_freshness_only:true,six_key_scope_sql_verified:true,open_start_closed_end_verified:true,read_only_transaction_verified:true,repeated_freeze_deterministic:true,cap04_canonical_future_forcing_epistemic_compatibility_proven:refs.has("weather-canonical-assumed")&&refs.has("et0-canonical-assumed"),canonical_historical_et0_epistemic_compatibility_proven:refs.has("et0-historical-estimated-0945"),noncanonical_epistemic_class_rejected:!refs.has("future-noncanonical-alias")&&!refs.has("historical-et0-wrong-observed"),database_write_performed:false,scheduler_loop_executed:false,canonical_write_performed:false,future_evidence_leakage:false};
    fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
  }finally{await pool.end();}
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:String(error instanceof Error?error.message:error)},null,2)+"\n");console.error(error);process.exitCode=1;});
