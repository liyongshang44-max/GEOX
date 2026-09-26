import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RawEvidenceRetentionPortV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import { GfsNomadsRawBundleComposerV1 } from "../../apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
  gfsPgrb2NamesV1,
  gfsSfluxNamesV1,
  type GfsNomadsRawObjectV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";
import { KbsRawHourlyPublicationSnapshotInspectorV1 } from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_RESOURCE_SANITY_V1_RESULT.json");
const TARGET="2026-08-27T12:00:00.000Z";
const CYCLE="2026-08-27T06:00:00Z";
const SUPPORT=6;
const LEAD_END=78;
const GFS_GRIB_BYTES=128*1024;
const GFS_ITERATIONS=3;
const KBS_PARSE_ITERATIONS=10;
const KBS_REJECTION_ITERATIONS=25;
const MB=1024*1024;

type Sample={rss:number;heapUsed:number;external:number;arrayBuffers:number;fdCount:number|null;tempRootCount:number};

function sha256(bytes:Uint8Array):string{
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function fdCount():number|null{
  try{return fs.readdirSync("/proc/self/fd").length;}catch{return null;}
}
function tempRootCount():number{
  return fs.readdirSync(os.tmpdir()).filter(name=>name.startsWith("mcft-cap09-gfs-bundle-")||name.startsWith("mcft-cap09-kbs-publication-")).length;
}
function gc():void{
  const fn=(globalThis as typeof globalThis & {gc?:()=>void}).gc;
  if(fn)fn();
}
function sample():Sample{
  gc();
  const m=process.memoryUsage();
  return {rss:m.rss,heapUsed:m.heapUsed,external:m.external,arrayBuffers:m.arrayBuffers,fdCount:fdCount(),tempRootCount:tempRootCount()};
}
function raw(kind:GfsNomadsRawObjectV1["kind"],identity:string,bytes:Uint8Array,contentType:string):GfsNomadsRawObjectV1{
  return {kind,identity,sha256:sha256(bytes),response:{status:kind==="GFS_SFLUX_EXACT_GRIB_MESSAGE"?206:200,final_locator:`https://nomads.ncep.noaa.gov/${encodeURIComponent(identity)}`,content_type:contentType,response_headers:{},retrieved_at:"2026-08-27T11:50:00.000Z",bytes}};
}
function directoryBytes():Uint8Array{
  const rows:string[]=[];
  for(let lead=SUPPORT;lead<=LEAD_END;lead+=1){
    for(const name of [...gfsPgrb2NamesV1(CYCLE,lead),...gfsSfluxNamesV1(CYCLE,lead)]){
      rows.push(`<a href="${name}">${name}</a> 27-Aug-2026 11:00 1K`);
    }
  }
  return new TextEncoder().encode(rows.join("\n"));
}
function idxBytes(lead:number):Uint8Array{
  return new TextEncoder().encode([
    `1:0:d=2026082706:DSWRF:surface:${lead} hour fcst:`,
    `2:100:d=2026082706:TMP:surface:${lead} hour fcst:`,
  ].join("\n"));
}
function gribBytes(seed:number):Uint8Array{
  const body=Buffer.alloc(GFS_GRIB_BYTES,seed%251);
  Buffer.from("GRIB","ascii").copy(body,0);
  Buffer.from("7777","ascii").copy(body,body.length-4);
  return new Uint8Array(body);
}
function kbsRaw(rows=5000):Buffer{
  const header="datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
  const body:string[]=[];
  for(let i=0;i<rows;i+=1){
    const hour=String(i%24).padStart(2,"0");
    body.push(`2026-08-13 ${hour}:00:00,150.0,2.5,1.8,24.0,0.2`);
  }
  return Buffer.from(header+body.join("\n")+"\n","utf8");
}

async function oneGfs(iteration:number):Promise<{bundleBytes:number;memberCount:number}>{
  const retention:RawEvidenceRetentionPortV1={
    async retainRawEvidence(input){
      return {retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",retention_ref:`s3-private://fdg/${input.raw_sha256.slice(7)}`,retained_sha256:input.raw_sha256,retained_bytes:input.raw_bytes,retained_at:"2026-08-27T11:50:01.000Z",externally_publishable:false};
    },
  };
  const provider={
    provider_id:MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
    async selectLatestCompleteCycle(_tick:string,retainThenParse:(raw:GfsNomadsRawObjectV1)=>Promise<unknown>){
      const d=raw("GFS_DIRECTORY_LISTING",CYCLE,directoryBytes(),"text/html");
      await retainThenParse(d);
      return {cycle:CYCLE,lead_start:7,lead_end:LEAD_END,support_lead:SUPPORT,directory_sha256:d.sha256,rejected_cycles:[]};
    },
    async fetchPgrb2FilteredRaw(_cycle:string,lead:number){return raw("GFS_PGRB2_FILTER_RESPONSE",`${CYCLE}|F${String(lead).padStart(3,"0")}`,gribBytes(lead+iteration),"application/octet-stream");},
    async fetchSfluxIndexRaw(_cycle:string,lead:number){return raw("GFS_SFLUX_IDX",`${CYCLE}|F${String(lead).padStart(3,"0")}`,idxBytes(lead),"text/plain");},
    async fetchSfluxMessageRaw(_cycle:string,lead:number){return raw("GFS_SFLUX_EXACT_GRIB_MESSAGE",`${CYCLE}|F${String(lead).padStart(3,"0")}`,gribBytes(lead+100+iteration),"application/octet-stream");},
  };
  let clockOrdinal=0;
  const composer=new GfsNomadsRawBundleComposerV1({
    provider,
    retention,
    clock:()=>new Date(clockOrdinal++===0?"2026-08-27T11:49:59.000Z":"2026-08-27T11:51:00.000Z"),
  });
  const result=await composer.compose({target_logical_time:TARGET,request_id_prefix:`fdg-resource-${iteration}`});
  const bundleBytes=result.raw_bundle_bytes;
  const memberCount=result.members.length;
  assert.equal(fs.existsSync(result.bundle_file_path),true);
  result.cleanup();
  assert.equal(fs.existsSync(result.bundle_file_path),false);
  return {bundleBytes,memberCount};
}

async function main():Promise<void>{
  if(!(globalThis as typeof globalThis & {gc?:()=>void}).gc){
    throw new Error("FDG_RESOURCE_SANITY_REQUIRES_EXPOSE_GC");
  }
  const before=sample();
  const gfsSamples:Sample[]=[];
  const bundleBytes:number[]=[];
  for(let i=0;i<GFS_ITERATIONS;i+=1){
    const result=await oneGfs(i);
    assert.equal(result.memberCount,1+(LEAD_END-SUPPORT+1)*3);
    bundleBytes.push(result.bundleBytes);
    await new Promise(resolve=>setTimeout(resolve,25));
    gfsSamples.push(sample());
  }
  const afterGfs=sample();

  const inspector=new KbsRawHourlyPublicationSnapshotInspectorV1();
  const valid=kbsRaw();
  const kbsSamples:Sample[]=[];
  for(let i=0;i<KBS_PARSE_ITERATIONS;i+=1){
    const inventory=await inspector.inspectSnapshot({
      raw_bytes:valid,
      available_at:"2026-08-13T20:00:00.000Z",
    });
    assert.equal(inventory.parsed_row_count,5000);
    if(i===KBS_PARSE_ITERATIONS-1)kbsSamples.push(sample());
  }

  const oversized=Buffer.from('"'+"x".repeat(131_073)+'"\n'+valid.toString("utf8"),"utf8");
  for(let i=0;i<KBS_REJECTION_ITERATIONS;i+=1){
    await assert.rejects(
      ()=>inspector.inspectSnapshot({raw_bytes:oversized,available_at:"2026-08-13T20:00:00.000Z"}),
      /MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE/,
    );
  }
  await new Promise(resolve=>setTimeout(resolve,25));
  const after=sample();

  const rssDelta=after.rss-before.rss;
  const heapDelta=after.heapUsed-before.heapUsed;
  const externalDelta=after.external-before.external;
  const fdDelta=before.fdCount===null||after.fdCount===null?null:after.fdCount-before.fdCount;
  const peakRss=Math.max(before.rss,...gfsSamples.map(x=>x.rss),...kbsSamples.map(x=>x.rss),after.rss);
  const peakRssDelta=peakRss-before.rss;

  assert.equal(after.tempRootCount,before.tempRootCount,"FDG_RESOURCE_TEMP_ROOT_LEAK");
  if(fdDelta!==null)assert.ok(fdDelta<=8,`FDG_RESOURCE_FD_GROWTH:${fdDelta}`);
  assert.ok(rssDelta<=96*MB,`FDG_RESOURCE_FINAL_RSS_DELTA_TOO_HIGH:${rssDelta}`);
  assert.ok(heapDelta<=32*MB,`FDG_RESOURCE_FINAL_HEAP_DELTA_TOO_HIGH:${heapDelta}`);
  assert.ok(externalDelta<=64*MB,`FDG_RESOURCE_FINAL_EXTERNAL_DELTA_TOO_HIGH:${externalDelta}`);
  assert.ok(peakRssDelta<=192*MB,`FDG_RESOURCE_PEAK_RSS_DELTA_TOO_HIGH:${peakRssDelta}`);

  const proof={
    schema_version:"geox_mcft_cap09_failure_discovery_resource_sanity_v1",
    status:"PASS",
    tier:"FAST_SANITY_NOT_FINAL_RESOURCE_ENVELOPE",
    gfs_iterations:GFS_ITERATIONS,
    gfs_lead_count:LEAD_END-SUPPORT+1,
    gfs_member_payload_bytes:GFS_GRIB_BYTES,
    gfs_bundle_bytes:bundleBytes,
    kbs_complete_table_parse_iterations:KBS_PARSE_ITERATIONS,
    kbs_rows_per_parse:5000,
    kbs_oversized_rejection_iterations:KBS_REJECTION_ITERATIONS,
    baseline:before,
    after_gfs:afterGfs,
    final:after,
    rss_delta_bytes:rssDelta,
    heap_used_delta_bytes:heapDelta,
    external_delta_bytes:externalDelta,
    fd_delta:fdDelta,
    peak_rss_delta_bytes:peakRssDelta,
    temp_root_leak:false,
    full_gfs_3x_live_acquisition_proven:false,
    exact_p0h_raw_100x_replay_proven:false,
    full_resource_envelope_complete:false,
    final_24h_admitted:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
