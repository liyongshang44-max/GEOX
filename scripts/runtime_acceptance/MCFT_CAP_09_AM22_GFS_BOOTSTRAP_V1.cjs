"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const measurement=require("./MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs");
const ROOT=path.resolve(__dirname,"../.."),HOUR=3600000,MEASUREMENT_LEAD_MS=measurement.TIMEOUT_MS,AUTHORITY_MATERIALIZATION_MARGIN_MS=measurement.SAFETY_MARGIN_MS;
const digestFile=file=>"sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const ceilHour=ms=>Math.ceil(ms/HOUR)*HOUR;
function safeRepoRef(ref){
 const value=String(ref??"").trim().replaceAll("\\","/");
 assert.ok(value&&!value.startsWith("/")&&!value.startsWith("./")&&!/^[A-Za-z]:\//.test(value)&&!value.split("/").includes(".."),"AM22_GFS_BOOTSTRAP_STAGE_REF_INVALID");
 const resolved=path.resolve(ROOT,value),relative=path.relative(ROOT,resolved);
 assert.ok(relative&&!relative.startsWith(".."+path.sep)&&!path.isAbsolute(relative)&&fs.existsSync(resolved)&&fs.statSync(resolved).isFile(),"AM22_GFS_BOOTSTRAP_STAGE_REF_NOT_REPOSITORY_FILE");
 return {ref:value,resolved};
}
function selectA0({source_now,budget_ms,stage}){
 const now=Date.parse(source_now);
 assert.ok(Number.isFinite(now)&&new Date(now).toISOString()===source_now,"AM22_GFS_BOOTSTRAP_SOURCE_CLOCK_INVALID");
 assert.ok(Number.isSafeInteger(budget_ms)&&budget_ms>=MEASUREMENT_LEAD_MS,"AM22_GFS_BOOTSTRAP_BUDGET_TOO_SMALL");
 const a0=new Date(ceilHour(now+budget_ms)).toISOString();
 return measurement.stageCoverage(stage,a0,source_now);
}
function compactHour(value){return value.replace(/[-:.]/g,"").replace("000Z","Z").toLowerCase();}
function validateGfsPairRows(rows,a0){
 assert.ok(Array.isArray(rows),"AM22_GFS_BOOTSTRAP_PAIR_ROWS_REQUIRED");
 const exact=rows.filter(r=>r.target_logical_time===a0);
 assert.equal(exact.length,2,"AM22_GFS_BOOTSTRAP_EXACT_PAIR_REQUIRED");
 const byType=new Map(exact.map(r=>[r.record_type,r]));
 assert.equal(byType.size,2,"AM22_GFS_BOOTSTRAP_DUPLICATE_ROLE_FORBIDDEN");
 const weather=byType.get("future_weather_assumption_v1"),et0=byType.get("future_et0_assumption_v1");
 assert.ok(weather&&et0,"AM22_GFS_BOOTSTRAP_WEATHER_ET0_PAIR_REQUIRED");
 for(const row of [weather,et0]){
  assert.equal(row.payload_record_type,row.record_type,"AM22_GFS_BOOTSTRAP_RECORD_TYPE_MISMATCH");
  assert.equal(row.valid_from,a0,"AM22_GFS_BOOTSTRAP_VALID_FROM_TARGET_MISMATCH");
  assert.equal(row.selected_cycle,row.issued_at,"AM22_GFS_BOOTSTRAP_SELECTED_CYCLE_ISSUED_AT_MISMATCH");
  assert.match(String(row.fact_id??""),/^fact_external_evidence_[a-f0-9]{64}$/,"AM22_GFS_BOOTSTRAP_FACT_ID_INVALID");
  assert.match(String(row.raw_source_sha256??""),/^sha256:[a-f0-9]{64}$/,"AM22_GFS_BOOTSTRAP_RAW_DIGEST_INVALID");
  assert.match(String(row.selected_cycle??""),/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/,"AM22_GFS_BOOTSTRAP_CYCLE_INVALID");
  assert.ok(Date.parse(row.available_to_runtime_at)<=Date.parse(row.observed_database_now),"AM22_GFS_BOOTSTRAP_FUTURE_AVAILABILITY_FORBIDDEN");
  assert.ok(Date.parse(row.ingested_at)<=Date.parse(row.observed_database_now),"AM22_GFS_BOOTSTRAP_FUTURE_INGEST_FORBIDDEN");
 }
 const cycleKey=compactHour(weather.selected_cycle),targetKey=compactHour(a0);
 assert.equal(weather.binding_id,"noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1","AM22_GFS_BOOTSTRAP_WEATHER_BINDING_MISMATCH");
 assert.equal(et0.binding_id,"noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1","AM22_GFS_BOOTSTRAP_ET0_BINDING_MISMATCH");
 assert.equal(weather.origin_source_kind,"NOAA_NCEP_NOMADS_GFS","AM22_GFS_BOOTSTRAP_WEATHER_ORIGIN_KIND_MISMATCH");
 assert.equal(et0.origin_source_kind,"NOAA_NCEP_NOMADS_GFS_DERIVED","AM22_GFS_BOOTSTRAP_ET0_ORIGIN_KIND_MISMATCH");
 assert.equal(weather.origin_source_id,"gfs_"+cycleKey+"_pgrb2_0p25_kbs","AM22_GFS_BOOTSTRAP_WEATHER_ORIGIN_ID_MISMATCH");
 assert.equal(et0.origin_source_id,"gfs_"+cycleKey+"_asce_short_reference_et0_kbs","AM22_GFS_BOOTSTRAP_ET0_ORIGIN_ID_MISMATCH");
 assert.equal(weather.source_record_id,"gfs_future_weather_"+cycleKey+"_"+targetKey,"AM22_GFS_BOOTSTRAP_WEATHER_SOURCE_RECORD_MISMATCH");
 assert.equal(et0.source_record_id,"gfs_future_et0_"+cycleKey+"_"+targetKey,"AM22_GFS_BOOTSTRAP_ET0_SOURCE_RECORD_MISMATCH");
 assert.equal(weather.raw_source_sha256,et0.raw_source_sha256,"AM22_GFS_BOOTSTRAP_SAME_RAW_BUNDLE_REQUIRED");
 assert.equal(weather.selected_cycle,et0.selected_cycle,"AM22_GFS_BOOTSTRAP_SAME_CYCLE_REQUIRED");
 return {weather,et0,raw_source_sha256:weather.raw_source_sha256,selected_cycle:weather.selected_cycle};
}
module.exports={ROOT,HOUR,MEASUREMENT_LEAD_MS,AUTHORITY_MATERIALIZATION_MARGIN_MS,digestFile,ceilHour,safeRepoRef,selectA0,validateGfsPairRows};
