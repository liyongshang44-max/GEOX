// MCFT-CAP-09 Phase5 qualification-only live A0 raw capture.
//
// This helper captures real provider bytes and emits a data-only SHA-bound fixture for
// the existing qualification Evidence process. GFS selection/completeness is delegated
// to the product GfsNomadsLiveProviderV1 + GfsNomadsRawBundleComposerV1 path. No canonical
// Evidence, Twin state, scheduler, database, or production ownership mutation occurs here.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
  GfsNomadsLiveProviderV1,
  gfsDirectoryUrlV1,
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

function requiredEnvV1(name:string):string {
  const value=String(process.env[name]??"").trim();
  if(!value) throw new Error("PHASE5_CAPTURE_ENV_REQUIRED:"+name);
  return value;
}
function sha256V1(bytes:Uint8Array):string {
  return "sha256:"+createHash("sha256").update(bytes).digest("hex");
}
function nextHourV1(value:string):string {
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error("PHASE5_CAPTURE_TIME_INVALID");
  return new Date((Math.floor(ms/HOUR_MS)+1)*HOUR_MS).toISOString();
}
function addHoursV1(value:string,hours:number):string {
  return new Date(Date.parse(value)+hours*HOUR_MS).toISOString();
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

async function main():Promise<void> {
  const subject=requiredEnvV1("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!SUBJECT_RE.test(subject)) throw new Error("PHASE5_CAPTURE_SUBJECT_SHA_INVALID");
  const root=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_FIXTURE_OUTPUT_ROOT"));
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  for(const entry of fs.readdirSync(root)) {
    fs.rmSync(path.join(root,entry),{recursive:true,force:true});
  }

  const captureStartedAt=new Date().toISOString();
  const a0=nextHourV1(captureStartedAt);

  // Product GFS selection runs first because it is the expensive acquisition. The exact
  // target is already fixed to A0; if acquisition crosses A0, qualification fails rather
  // than changing provider or rewriting timestamps.
  const captureRetention=new LocalPrivateCaptureRetentionV1(root);
  const byteClient=new ControlledHttpsByteClientV1({
    user_agent:"GEOX-MCFT-CAP09-PHASE5-A0-CAPTURE/1",
    max_raw_bytes:250_000_000,
    timeout_ms:120_000,
  });
  const liveProvider=new GfsNomadsLiveProviderV1({byte_client:byteClient});
  const composer=new GfsNomadsRawBundleComposerV1({
    provider:liveProvider,
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
  const cycle=composed.selected_cycle;
  const gfsResponses=captureRetention.captured
    .map(row=>gfsResponseV1(row,a0,cycle))
    .filter((row):row is Phase5ControlledFixtureManifestResponseV1=>row!==null);
  const expectedReplayMemberCount=
    composed.raw_provider_object_count-composed.directory_rejection_count;
  if(gfsResponses.filter(row=>row.kind==="GFS_DIRECTORY").length!==1) {
    throw new Error("PHASE5_CAPTURE_EXACT_SELECTED_GFS_DIRECTORY_REQUIRED");
  }
  if(gfsResponses.length!==expectedReplayMemberCount) {
    throw new Error(`PHASE5_CAPTURE_GFS_REPLAY_MEMBER_COUNT_MISMATCH:${gfsResponses.length}:${expectedReplayMemberCount}`);
  }

  // Soil is acquired after GFS so the selected real observation is inside the strict
  // (A0-1h,A0] bootstrap window without backdating or synthetic substitution.
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
    targets:[{
      target_logical_time:a0,
      requested_at:captureStartedAt,
      request_id_prefix:"phase5.a0",
      source_families:["KBS_SOIL","GFS_BUNDLE"],
      gfs_cycle:cycle,
    }],
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
      ...gfsResponses,
    ],
  };
  fs.writeFileSync(path.join(root,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});

  const proof={
    schema_version:"geox_mcft_cap09_phase5_a0_live_raw_capture_v2",
    status:"PASS",
    subject_sha:subject,
    capture_started_at:captureStartedAt,
    soil_requested_at:soilRequestedAt,
    a0,
    o00:addHoursV1(a0,1),
    o23:addHoursV1(a0,24),
    soil_observed_at:soilObserved,
    soil_retrieved_at:soilRaw.response.retrieved_at,
    soil_raw_sha256:soilSha,
    gfs_selected_cycle:cycle,
    gfs_lead_start:composed.lead_start,
    gfs_lead_end:composed.lead_end,
    gfs_support_lead:composed.support_lead,
    gfs_provider_request_count:composed.provider_request_count,
    gfs_raw_provider_object_count:composed.raw_provider_object_count,
    gfs_directory_rejection_count:composed.directory_rejection_count,
    gfs_replay_raw_object_count:gfsResponses.length,
    gfs_raw_member_chain_sha256:composed.raw_member_chain_sha256,
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
