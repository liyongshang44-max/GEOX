// MCFT-CAP-09 Phase5 qualification-only live A0 raw capture.
//
// This helper captures real provider bytes and emits a data-only SHA-bound fixture for
// the existing qualification Evidence process. GFS selection/completeness is delegated
// to the product GfsNomadsLiveProviderV1 + GfsNomadsRawBundleComposerV1 path. No canonical
// Evidence, Twin state, scheduler, database, or production ownership mutation occurs here.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as waitTimeoutV1 } from "node:timers/promises";

import type {
  RawEvidenceRetentionInputV1,
  RawEvidenceRetentionPortV1,
  RawEvidenceRetentionReceiptV1,
  VerifiedRawEvidenceProvenanceV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  fetchKbsVariate25SoilRawV1,
  KbsVariate25SoilEvidenceDecoderV1,
} from "../provider/kbs_variate25_soil_provider_v1.js";
import {
  ControlledHttpsByteClientV1,
} from "../provider/https_external_evidence_transport_v1.js";
import {
  MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1,
  GfsNomadsLiveProviderV1,
  candidateGfsCyclesV1,
  gfsDirectoryUrlV1,
  gfsLeadWindowV1,
  gfsPgrb2NamesV1,
  gfsSfluxNamesV1,
  parseGfsDirectoryInventoryV1,
  parseGfsSfluxIndexV1,
  type GfsCycleSelectionV1,
  type GfsDirectoryInventoryV1,
  type GfsNomadsRawObjectV1,
} from "../provider/gfs_nomads_live_provider_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "../provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
  type Phase5ControlledFixtureManifestV1,
  type Phase5ControlledFixtureManifestResponseV1,
} from "./mcft_cap09_phase5_evidence_runtime_qualification_v1.js";

const SUBJECT_RE=/^[0-9a-f]{40}$/;
const HOUR_MS=3_600_000;
const ROLLING_GFS_TARGET_COUNT=24;
const MIN_CAPTURE_RUNWAY_MINUTES=30;
const SOIL_WINDOW_SETTLE_MINUTES=10;
const SAME_REQUEST_MAX_ATTEMPTS=2;
const SAME_REQUEST_RETRY_DELAY_MS=2_000;
let sameRequestRetryCount=0;

function requiredEnvV1(name:string):string {
  const value=String(process.env[name]??"").trim();
  if(!value) throw new Error("PHASE5_CAPTURE_ENV_REQUIRED:"+name);
  return value;
}
function sha256V1(bytes:Uint8Array):string {
  return "sha256:"+createHash("sha256").update(bytes).digest("hex");
}
function ceilHourV1(value:string):string {
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error("PHASE5_CAPTURE_TIME_INVALID");
  return new Date(Math.ceil(ms/HOUR_MS)*HOUR_MS).toISOString();
}
function addHoursV1(value:string,hours:number):string {
  return new Date(Date.parse(value)+hours*HOUR_MS).toISOString();
}
function addMinutesV1(value:string,minutes:number):string {
  return new Date(Date.parse(value)+minutes*60_000).toISOString();
}
async function sameRequestRetryV1<T>(
  label:string,
  operation:()=>Promise<T>,
):Promise<T> {
  let lastError:unknown;
  for(let attempt=1;attempt<=SAME_REQUEST_MAX_ATTEMPTS;attempt+=1) {
    try {
      return await operation();
    } catch(error) {
      lastError=error;
      if(attempt>=SAME_REQUEST_MAX_ATTEMPTS) break;
      sameRequestRetryCount+=1;
      process.stderr.write(
        JSON.stringify({
          event:"PHASE5_CAPTURE_SAME_REQUEST_RETRY",
          label,
          attempt,
          max_attempts:SAME_REQUEST_MAX_ATTEMPTS,
          error:error instanceof Error?error.message:String(error),
        })+"\n",
      );
      await waitTimeoutV1(SAME_REQUEST_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
function safeFileV1(value:string):string {
  return value.replace(/[^0-9A-Za-z_.-]+/g,"_");
}

type CapturedRawV1={
  input:RawEvidenceRetentionInputV1;
  file:string;
};

class LocalPrivateCaptureRetentionV1 implements RawEvidenceRetentionPortV1 {
  readonly captured:CapturedRawV1[]=[];
  constructor(private readonly root:string) {}
  async retainRawEvidence(input:RawEvidenceRetentionInputV1):Promise<RawEvidenceRetentionReceiptV1> {
    const actual=sha256V1(input.bytes);
    if(actual!==input.raw_sha256 || input.bytes.byteLength!==input.raw_bytes) {
      throw new Error("PHASE5_CAPTURE_GFS_RAW_IDENTITY_MISMATCH");
    }
    const index=this.captured.length;
    const relative=path.posix.join(
      "gfs",
      String(index).padStart(3,"0")+"_"+safeFileV1(input.source_family)+".bin",
    );
    const absolute=path.join(this.root,...relative.split("/"));
    fs.mkdirSync(path.dirname(absolute),{recursive:true});
    fs.writeFileSync(absolute,Buffer.from(input.bytes),{mode:0o600});
    this.captured.push({input:{...input,bytes:new Uint8Array()},file:relative});
    return {
      retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref:"qualification-private://phase5-capture/"+relative,
      retained_sha256:actual,
      retained_bytes:input.raw_bytes,
      retained_at:input.retrieved_at,
      externally_publishable:false,
    };
  }
}

function gfsResponseV1(
  row:CapturedRawV1,
  target:string,
  cycle:string,
):Phase5ControlledFixtureManifestResponseV1|null {
  const source=row.input.source_family;
  if(source==="GFS_DIRECTORY_LISTING") {
    if(row.input.final_locator!==gfsDirectoryUrlV1(cycle)) return null;
    return {
      kind:"GFS_DIRECTORY",target_logical_time:target,cycle,
      locator:row.input.final_locator,file:row.file,status:200,
      content_type:row.input.content_type||"text/html",
      retrieved_at:row.input.retrieved_at,available_at:row.input.available_at,
      sha256:row.input.raw_sha256,
    };
  }
  const leadMatch=row.input.request_id.match(/:f(\d{3})$/i);
  if(!leadMatch) throw new Error("PHASE5_CAPTURE_GFS_LEAD_IDENTITY_REQUIRED:"+row.input.request_id);
  const lead=Number(leadMatch[1]);
  const kind=source==="GFS_PGRB2_FILTER_RESPONSE" ? "GFS_PGRB2"
    : source==="GFS_SFLUX_IDX" ? "GFS_SFLUX_INDEX"
    : source==="GFS_SFLUX_EXACT_GRIB_MESSAGE" ? "GFS_SFLUX_MESSAGE"
    : null;
  if(!kind) throw new Error("PHASE5_CAPTURE_GFS_SOURCE_FAMILY_UNEXPECTED:"+source);
  return {
    kind,target_logical_time:target,cycle,lead,
    locator:row.input.final_locator,file:row.file,
    status:kind==="GFS_SFLUX_MESSAGE"?206:200,
    content_type:row.input.content_type||"application/octet-stream",
    retrieved_at:row.input.retrieved_at,available_at:row.input.available_at,
    sha256:row.input.raw_sha256,
  };
}


function capturedLeadV1(row:CapturedRawV1):number|null {
  if(row.input.source_family==="GFS_DIRECTORY_LISTING") return null;
  const match=row.input.request_id.match(/:f(\d{3})$/i);
  if(!match) throw new Error("PHASE5_CAPTURE_GFS_LEAD_IDENTITY_REQUIRED:"+row.input.request_id);
  return Number(match[1]);
}

function requireRetrievedByA0V1(raw:GfsNomadsRawObjectV1,a0:string,code:string):void {
  if(Date.parse(raw.response.retrieved_at)>Date.parse(a0)) {
    throw new Error(code+"_RETRIEVED_AFTER_A0");
  }
}

async function retainCapturedGfsRawV1(input:{
  retention:LocalPrivateCaptureRetentionV1;
  raw:GfsNomadsRawObjectV1;
  request_id:string;
  a0:string;
}):Promise<void> {
  requireRetrievedByA0V1(input.raw,input.a0,"PHASE5_CAPTURE_EXTENDED_GFS");
  await input.retention.retainRawEvidence({
    retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id:input.request_id,
    provider_id:"MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_V1",
    source_family:input.raw.kind,
    source_locator:input.raw.response.final_locator,
    final_locator:input.raw.response.final_locator,
    content_type:input.raw.response.content_type||"application/octet-stream",
    retrieved_at:input.raw.response.retrieved_at,
    available_at:input.raw.response.retrieved_at,
    use_policy_ref:MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1,
    raw_sha256:input.raw.sha256,
    raw_bytes:input.raw.response.bytes.byteLength,
    bytes:input.raw.response.bytes,
  });
}

function validateExtendedInventoryAtA0V1(input:{
  inventory:GfsDirectoryInventoryV1;
  cycle:string;
  a0:string;
  support_lead:number;
  lead_end:number;
}):void {
  const a0Ms=Date.parse(input.a0);
  for(let lead=input.support_lead;lead<=input.lead_end;lead+=1) {
    for(const name of [...gfsPgrb2NamesV1(input.cycle,lead),...gfsSfluxNamesV1(input.cycle,lead)]) {
      const rows=input.inventory.get(name)??[];
      if(rows.length!==1 || rows[0]!.size_bytes<=0) {
        throw new Error("PHASE5_CAPTURE_EXTENDED_GFS_INVENTORY_MISSING:"+name);
      }
      if(Date.parse(rows[0]!.availability_upper_bound)>a0Ms) {
        throw new Error("PHASE5_CAPTURE_EXTENDED_GFS_INVENTORY_AFTER_A0:"+name);
      }
    }
  }
}

type ExtendedCycleSelectionV1={
  selection:GfsCycleSelectionV1;
  directory_raw:GfsNomadsRawObjectV1;
  directory_request_count:number;
};

async function selectExtendedCausalCycleV1(input:{
  provider:GfsNomadsLiveProviderV1;
  retention:LocalPrivateCaptureRetentionV1;
  a0:string;
  last_target:string;
}):Promise<ExtendedCycleSelectionV1> {
  const rejected:{cycle:string;reason:string}[]=[];
  let directoryRequestCount=0;
  for(const cycle of candidateGfsCyclesV1(input.a0)) {
    try {
      const raw=await sameRequestRetryV1(
        `directory:${cycle}`,
        ()=>input.provider.fetchDirectoryRaw(cycle),
      );
      directoryRequestCount+=1;
      requireRetrievedByA0V1(raw,input.a0,"PHASE5_CAPTURE_GFS_DIRECTORY");
      await retainCapturedGfsRawV1({
        retention:input.retention,
        raw,
        request_id:`phase5.a0.capture:gfs:extended-directory:${String(directoryRequestCount).padStart(2,"0")}`,
        a0:input.a0,
      });
      const inventory=parseGfsDirectoryInventoryV1(raw.response.bytes);
      const a0Window=gfsLeadWindowV1(input.a0,cycle);
      const lastWindow=gfsLeadWindowV1(input.last_target,cycle);
      validateExtendedInventoryAtA0V1({
        inventory,
        cycle:a0Window.cycle,
        a0:input.a0,
        support_lead:a0Window.support_lead,
        lead_end:lastWindow.lead_end,
      });
      return {
        selection:{
          ...a0Window,
          directory_sha256:raw.sha256,
          rejected_cycles:rejected,
        },
        directory_raw:raw,
        directory_request_count:directoryRequestCount,
      };
    } catch(error) {
      const reason=error instanceof Error?error.message:String(error);
      rejected.push({cycle,reason:reason.slice(0,240)});
    }
  }
  throw new Error("PHASE5_CAPTURE_NO_EXTENDED_CAUSAL_GFS_CYCLE:"+JSON.stringify(rejected));
}

function responsesForTargetV1(input:{
  captured:readonly CapturedRawV1[];
  target:string;
  cycle:string;
}):Phase5ControlledFixtureManifestResponseV1[] {
  const window=gfsLeadWindowV1(input.target,input.cycle);
  const selectedDirectoryRows=input.captured.filter(
    row=>row.input.source_family==="GFS_DIRECTORY_LISTING"
      && row.input.final_locator===gfsDirectoryUrlV1(input.cycle),
  );
  if(selectedDirectoryRows.length<1) throw new Error("PHASE5_CAPTURE_SELECTED_GFS_DIRECTORY_REQUIRED");
  const selectedDirectory=selectedDirectoryRows[selectedDirectoryRows.length-1]!;
  const directoryResponse=gfsResponseV1(selectedDirectory,input.target,input.cycle);
  if(!directoryResponse) throw new Error("PHASE5_CAPTURE_SELECTED_GFS_DIRECTORY_RESPONSE_REQUIRED");
  const responses:Phase5ControlledFixtureManifestResponseV1[]=[directoryResponse];
  const families=[
    "GFS_PGRB2_FILTER_RESPONSE",
    "GFS_SFLUX_IDX",
    "GFS_SFLUX_EXACT_GRIB_MESSAGE",
  ] as const;
  for(let lead=window.support_lead;lead<=window.lead_end;lead+=1) {
    for(const family of families) {
      const rows=input.captured.filter(
        row=>row.input.source_family===family && capturedLeadV1(row)===lead,
      );
      if(rows.length!==1) {
        throw new Error(`PHASE5_CAPTURE_GFS_RAW_CARDINALITY:${family}:F${String(lead).padStart(3,"0")}:${rows.length}`);
      }
      const response=gfsResponseV1(rows[0]!,input.target,input.cycle);
      if(!response) throw new Error("PHASE5_CAPTURE_GFS_RESPONSE_REQUIRED");
      responses.push(response);
    }
  }
  return responses;
}

async function main():Promise<void> {
  const subject=requiredEnvV1("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!SUBJECT_RE.test(subject)) throw new Error("PHASE5_CAPTURE_SUBJECT_SHA_INVALID");
  const root=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_FIXTURE_OUTPUT_ROOT"));
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  for(const entry of fs.readdirSync(root)) {
    fs.rmSync(path.join(root,entry),{recursive:true,force:true});
  }

  const captureStartedAt=new Date().toISOString();
  const a0=ceilHourV1(addMinutesV1(captureStartedAt,MIN_CAPTURE_RUNWAY_MINUTES));
  const rollingTargets=Array.from(
    {length:ROLLING_GFS_TARGET_COUNT},
    (_,index)=>addHoursV1(a0,index),
  );
  const lastRollingTarget=rollingTargets[rollingTargets.length-1]!;

  // Phase5 accelerated 24T must satisfy the frozen Amendment-19 H1-at-each-boundary
  // contract without inventing 24 provider cycles. Select one real GFS cycle that is
  // already complete at A0 through the last rolling target's 72h window, retain every
  // raw object before parse/decode, and later let the unchanged product composer/decoder
  // rebuild one target-anchored 72h pair per rolling Evidence target.
  const captureRetention=new LocalPrivateCaptureRetentionV1(root);
  const byteClient=new ControlledHttpsByteClientV1({
    user_agent:"GEOX-MCFT-CAP09-PHASE5-A0-CAPTURE/1",
    max_raw_bytes:250_000_000,
    timeout_ms:120_000,
  });
  const liveProvider=new GfsNomadsLiveProviderV1({byte_client:byteClient});
  const extendedCycle=await selectExtendedCausalCycleV1({
    provider:liveProvider,
    retention:captureRetention,
    a0,
    last_target:lastRollingTarget,
  });
  const cycle=extendedCycle.selection.cycle;

  const frozenCycleProvider={
    provider_id:liveProvider.provider_id,
    async selectLatestCompleteCycle(
      tick:Date|string,
      retainThenParse:(raw:GfsNomadsRawObjectV1)=>Promise<GfsDirectoryInventoryV1>,
    ):Promise<GfsCycleSelectionV1> {
      if(new Date(tick).toISOString()!==a0) throw new Error("PHASE5_CAPTURE_FROZEN_GFS_TARGET_MISMATCH");
      const inventory=await retainThenParse(extendedCycle.directory_raw);
      const a0Window=gfsLeadWindowV1(a0,cycle);
      validateExtendedInventoryAtA0V1({
        inventory,
        cycle,
        a0,
        support_lead:a0Window.support_lead,
        lead_end:gfsLeadWindowV1(lastRollingTarget,cycle).lead_end,
      });
      return extendedCycle.selection;
    },
    fetchPgrb2FilteredRaw:(selectedCycle:Date|string,lead:number)=>{
      if(new Date(selectedCycle).toISOString().replace(".000Z","Z")!==cycle) {
        throw new Error("PHASE5_CAPTURE_FROZEN_GFS_CYCLE_MISMATCH");
      }
      return sameRequestRetryV1(
        `pgrb2:${new Date(selectedCycle).toISOString()}:f${String(lead).padStart(3,"0")}`,
        ()=>liveProvider.fetchPgrb2FilteredRaw(selectedCycle,lead),
      );
    },
    fetchSfluxIndexRaw:(selectedCycle:Date|string,lead:number,tick:Date|string)=>{
      if(new Date(tick).toISOString()!==a0) throw new Error("PHASE5_CAPTURE_FROZEN_GFS_SFLUX_TARGET_MISMATCH");
      return sameRequestRetryV1(
        `sflux-index:${new Date(selectedCycle).toISOString()}:f${String(lead).padStart(3,"0")}`,
        ()=>liveProvider.fetchSfluxIndexRaw(selectedCycle,lead,tick),
      );
    },
    fetchSfluxMessageRaw:(selectedCycle:Date|string,lead:number,tick:Date|string,selected:Parameters<GfsNomadsLiveProviderV1["fetchSfluxMessageRaw"]>[3])=>{
      if(new Date(tick).toISOString()!==a0) throw new Error("PHASE5_CAPTURE_FROZEN_GFS_SFLUX_TARGET_MISMATCH");
      return sameRequestRetryV1(
        `sflux-message:${new Date(selectedCycle).toISOString()}:f${String(lead).padStart(3,"0")}`,
        ()=>liveProvider.fetchSfluxMessageRaw(selectedCycle,lead,tick,selected),
      );
    },
  };
  const composer=new GfsNomadsRawBundleComposerV1({
    provider:frozenCycleProvider,
    retention:captureRetention,
    clock:()=>new Date(),
  });
  const composed=await composer.compose({
    target_logical_time:a0,
    request_id_prefix:"phase5.a0.capture:gfs",
  });
  if(Date.parse(composed.retrieved_at)>Date.parse(a0)) {
    throw new Error("PHASE5_CAPTURE_GFS_RETRIEVED_AFTER_A0");
  }
  if(composed.selected_cycle!==cycle) throw new Error("PHASE5_CAPTURE_GFS_SELECTED_CYCLE_DRIFT");

  const extendedWindow=gfsLeadWindowV1(lastRollingTarget,cycle);
  let extendedLeadCount=0;
  for(let lead=composed.lead_end+1;lead<=extendedWindow.lead_end;lead+=1) {
    const pgrb2=await sameRequestRetryV1(
      `extended-pgrb2:${cycle}:f${String(lead).padStart(3,"0")}`,
      ()=>liveProvider.fetchPgrb2FilteredRaw(cycle,lead),
    );
    await retainCapturedGfsRawV1({
      retention:captureRetention,
      raw:pgrb2,
      request_id:`phase5.a0.capture:gfs:extended:pgrb2:f${String(lead).padStart(3,"0")}`,
      a0,
    });
    const idxRaw=await sameRequestRetryV1(
      `extended-sflux-index:${cycle}:f${String(lead).padStart(3,"0")}`,
      ()=>liveProvider.fetchSfluxIndexRaw(cycle,lead,a0),
    );
    await retainCapturedGfsRawV1({
      retention:captureRetention,
      raw:idxRaw,
      request_id:`phase5.a0.capture:gfs:extended:sflux-idx:f${String(lead).padStart(3,"0")}`,
      a0,
    });
    const selected=parseGfsSfluxIndexV1(idxRaw.response.bytes,lead);
    const messageRaw=await sameRequestRetryV1(
      `extended-sflux-message:${cycle}:f${String(lead).padStart(3,"0")}`,
      ()=>liveProvider.fetchSfluxMessageRaw(cycle,lead,a0,selected),
    );
    await retainCapturedGfsRawV1({
      retention:captureRetention,
      raw:messageRaw,
      request_id:`phase5.a0.capture:gfs:extended:sflux-message:f${String(lead).padStart(3,"0")}`,
      a0,
    });
    extendedLeadCount+=1;
  }

  const gfsResponsesByTarget=new Map<string,Phase5ControlledFixtureManifestResponseV1[]>();
  for(const target of rollingTargets) {
    gfsResponsesByTarget.set(target,responsesForTargetV1({
      captured:captureRetention.captured,
      target,
      cycle,
    }));
  }
  const a0GfsResponses=gfsResponsesByTarget.get(a0)!;
  if(a0GfsResponses.filter(row=>row.kind==="GFS_DIRECTORY").length!==1) {
    throw new Error("PHASE5_CAPTURE_EXACT_SELECTED_GFS_DIRECTORY_REQUIRED");
  }
  const allCapturedByA0=captureRetention.captured.every(
    row=>Date.parse(row.input.retrieved_at)<=Date.parse(a0)
      && Date.parse(row.input.available_at)<=Date.parse(a0),
  );
  if(!allCapturedByA0) throw new Error("PHASE5_CAPTURE_GFS_RAW_AFTER_A0_FORBIDDEN");

  // Soil is acquired after GFS inside the strict (A0-1h,A0] bootstrap window.
  // If the extended GFS capture finishes before that window opens, qualification may
  // wait for the real soil feed; this is acquisition orchestration only and never a
  // Twin scheduler/provider wait.
  const soilWindowFetchNotBefore=addMinutesV1(addHoursV1(a0,-1),SOIL_WINDOW_SETTLE_MINUTES);
  const soilDelayMs=Date.parse(soilWindowFetchNotBefore)-Date.now();
  if(soilDelayMs>0) await waitTimeoutV1(soilDelayMs);
  const soilRequestedAt=new Date().toISOString();
  if(Date.parse(soilRequestedAt)>=Date.parse(a0)) {
    throw new Error("PHASE5_CAPTURE_NO_CAUSAL_SOIL_WINDOW_REMAINING");
  }
  const soilRaw=await fetchKbsVariate25SoilRawV1({
    request_id:"phase5.a0.capture:soil",
    requested_at:soilRequestedAt,
  });
  if(Date.parse(soilRaw.response.retrieved_at)>Date.parse(a0)) {
    throw new Error("PHASE5_CAPTURE_SOIL_RETRIEVED_AFTER_A0");
  }
  const soilSha=sha256V1(soilRaw.response.bytes);
  const soilProvenance:VerifiedRawEvidenceProvenanceV1={
    request_id:soilRaw.request.request_id,
    provider_id:soilRaw.request.provider_id,
    source_family:soilRaw.request.source_family,
    source_locator:soilRaw.request.locator,
    final_locator:soilRaw.response.final_locator,
    content_type:soilRaw.response.content_type,
    retrieved_at:soilRaw.response.retrieved_at,
    available_at:soilRaw.response.available_at,
    raw_sha256:soilSha,
    raw_bytes:soilRaw.response.bytes.byteLength,
    retention_ref:"qualification-private://phase5-capture/soil.json",
    retained_at:soilRaw.response.retrieved_at,
    use_policy_ref:soilRaw.request.use_policy_ref,
  };
  const soilDrafts=await new KbsVariate25SoilEvidenceDecoderV1().decodeRetainedEvidence({
    raw_bytes:soilRaw.response.bytes,
    provenance:soilProvenance,
  });
  if(soilDrafts.length!==1 || soilDrafts[0]?.role!=="SOIL_MOISTURE_OBSERVATION") {
    throw new Error("PHASE5_CAPTURE_SOIL_PRODUCT_DECODER_REQUIRED");
  }
  const soilObserved=String(soilDrafts[0].role_time.observed_at??"");
  const a0Start=Date.parse(a0)-HOUR_MS;
  if(!(Date.parse(soilObserved)>a0Start && Date.parse(soilObserved)<=Date.parse(a0))) {
    throw new Error("PHASE5_CAPTURE_SOIL_OUTSIDE_A0_OPEN_CLOSED_WINDOW");
  }
  const soilFile="soil.json";
  fs.writeFileSync(path.join(root,soilFile),Buffer.from(soilRaw.response.bytes),{mode:0o600});

  const manifest:Phase5ControlledFixtureManifestV1={
    schema_version:MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
    targets:rollingTargets.map((target,index)=>({
      target_logical_time:target,
      requested_at:captureStartedAt,
      request_id_prefix:`phase5.rolling.${String(index).padStart(2,"0")}`,
      source_families:index===0
        ? ["KBS_SOIL","GFS_BUNDLE"] as const
        : ["GFS_BUNDLE"] as const,
      gfs_cycle:cycle,
    })),
    responses:[
      {
        kind:"KBS_SOIL",
        target_logical_time:a0,
        locator:soilRaw.request.locator,
        file:soilFile,
        status:soilRaw.response.status,
        content_type:soilRaw.response.content_type,
        retrieved_at:soilRaw.response.retrieved_at,
        available_at:soilRaw.response.available_at,
        sha256:soilSha,
      },
      ...rollingTargets.flatMap(target=>gfsResponsesByTarget.get(target)!),
    ],
  };
  fs.writeFileSync(path.join(root,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});

  const gfsNetworkRequestCount=
    extendedCycle.directory_request_count
    +(composed.provider_request_count-1)
    +extendedLeadCount*3;
  const extendedRawChainSha=sha256V1(new TextEncoder().encode(
    captureRetention.captured.map(row=>[
      row.input.source_family,
      row.input.final_locator,
      row.input.raw_sha256,
      row.input.retrieved_at,
    ].join("|")).join("\n"),
  ));
  const proof={
    schema_version:"geox_mcft_cap09_phase5_a0_live_raw_capture_v3",
    status:"PASS",
    subject_sha:subject,
    capture_started_at:captureStartedAt,
    minimum_capture_runway_minutes:MIN_CAPTURE_RUNWAY_MINUTES,
    soil_window_settle_minutes:SOIL_WINDOW_SETTLE_MINUTES,
    same_request_max_attempts:SAME_REQUEST_MAX_ATTEMPTS,
    same_request_retry_count:sameRequestRetryCount,
    cross_cycle_retry_authorized:false,
    soil_requested_at:soilRequestedAt,
    a0,
    o00:addHoursV1(a0,1),
    o23:addHoursV1(a0,24),
    soil_observed_at:soilObserved,
    soil_retrieved_at:soilRaw.response.retrieved_at,
    soil_raw_sha256:soilSha,
    rolling_gfs_target_count:rollingTargets.length,
    rolling_gfs_first_target:rollingTargets[0],
    rolling_gfs_last_target:lastRollingTarget,
    gfs_single_causal_cycle_reused:true,
    gfs_selected_cycle:cycle,
    gfs_lead_start:composed.lead_start,
    gfs_a0_lead_end:composed.lead_end,
    gfs_extended_lead_end:extendedWindow.lead_end,
    gfs_support_lead:composed.support_lead,
    gfs_extended_lead_count:extendedLeadCount,
    gfs_network_request_count:gfsNetworkRequestCount,
    gfs_a0_composer_provider_request_count:composed.provider_request_count,
    gfs_retained_raw_object_count:captureRetention.captured.length,
    gfs_directory_rejection_count:extendedCycle.selection.rejected_cycles.length,
    gfs_manifest_response_alias_count:manifest.responses.filter(row=>row.kind.startsWith("GFS_")).length,
    gfs_raw_member_chain_sha256:composed.raw_member_chain_sha256,
    gfs_extended_raw_chain_sha256:extendedRawChainSha,
    all_gfs_raw_retrieved_by_a0:allCapturedByA0,
    a0_soil_window_exact:true,
    fake_grib_used:false,
    canonical_evidence_write_count:0,
    twin_write_count:0,
    fixture_raw_upload_authorized:false,
  };
  fs.writeFileSync(path.join(root,"capture-proof.json"),JSON.stringify(proof,null,2)+"\n",{mode:0o600});
  process.stdout.write(JSON.stringify(proof)+"\n");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
