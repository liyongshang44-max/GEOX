import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  HttpsExternalEvidenceTransportV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  McftCap09ProductionEvidenceFailureClassifierV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_TRANSPORT_MATRIX_V1_RESULT.json");
const REQUESTED="2026-09-26T00:00:00.000Z";
const ENDPOINT="https://lter.kbs.msu.edu/datatables/13.csv";

function request(){
  return {
    request_id:"fdg-transport",
    provider_id:"KBS_LTER",
    source_family:"RAW_HOURLY_WEATHER",
    locator:ENDPOINT,
    allowed_final_hosts:["lter.kbs.msu.edu"],
    use_policy_ref:"FDG_NON_AUTHORITY",
    requested_at:REQUESTED,
    expected_content_type_prefixes:["text/csv","text/plain","application/octet-stream"],
    limitations:["QUALIFICATION_ONLY"],
  };
}
function fakeResponse(input:{
  status:number;
  body?:Uint8Array|string;
  contentType?:string;
  url?:string;
}):Response{
  const bytes=typeof input.body==="string"
    ? Buffer.from(input.body,"utf8")
    : Buffer.from(input.body??[]);
  return {
    status:input.status,
    url:input.url??ENDPOINT,
    headers:new Headers({"content-type":input.contentType??"text/csv"}),
    async arrayBuffer(){
      return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
    },
  } as unknown as Response;
}
async function classifyTransport(fetchImpl:typeof fetch,maxBytes=1024):Promise<string>{
  const transport=new HttpsExternalEvidenceTransportV1({
    fetch_impl:fetchImpl,
    clock:()=>new Date("2026-09-26T00:00:01.000Z"),
    user_agent:"GEOX-FDG/1",
    max_raw_bytes:maxBytes,
    timeout_ms:1_000,
    require_final_path_match:true,
    error_prefix:"KBS_RAW_HOURLY",
  });
  try{
    await transport.fetchRawEvidence(request());
    return "SUCCESS";
  }catch(error){
    return new McftCap09ProductionEvidenceFailureClassifierV1().classify(error);
  }
}

async function main():Promise<void>{
  const classifier=new McftCap09ProductionEvidenceFailureClassifierV1();
  const results:Record<string,string>={};

  results.timeout=await classifyTransport((async()=>{throw Object.assign(new Error("request timeout"),{code:"ETIMEDOUT"});}) as typeof fetch);
  results.tcp_reset=await classifyTransport((async()=>{throw Object.assign(new Error("socket reset"),{code:"ECONNRESET"});}) as typeof fetch);
  results.tls_handshake_timeout=await classifyTransport((async()=>{throw Object.assign(new Error("TLS handshake timeout"),{code:"ERR_TLS_HANDSHAKE_TIMEOUT"});}) as typeof fetch);
  results.truncated_terminated=await classifyTransport((async()=>{throw Object.assign(new TypeError("terminated"),{cause:{code:"UND_ERR_SOCKET"}});}) as typeof fetch);
  results.provider_429=await classifyTransport((async()=>fakeResponse({status:429,body:"rate limited"})) as typeof fetch);
  results.provider_503=await classifyTransport((async()=>fakeResponse({status:503,body:"unavailable"})) as typeof fetch);
  results.unexpected_content_type=await classifyTransport((async()=>fakeResponse({status:200,body:"<html>oops</html>",contentType:"text/html"})) as typeof fetch);
  results.empty_body=await classifyTransport((async()=>fakeResponse({status:200,body:new Uint8Array(),contentType:"text/csv"})) as typeof fetch);
  results.oversized_body=await classifyTransport((async()=>fakeResponse({status:200,body:Buffer.alloc(17,1),contentType:"text/csv"})) as typeof fetch,16);
  results.identity_drift=await classifyTransport((async()=>fakeResponse({status:200,body:"x",contentType:"text/csv",url:"https://lter.kbs.msu.edu/datatables/other.csv"})) as typeof fetch);
  results.tls_certificate_invalid=await classifyTransport((async()=>{throw Object.assign(new Error("certificate has expired"),{code:"CERT_HAS_EXPIRED"});}) as typeof fetch);

  results.minio_503=classifier.classify(new Error("EA5C1_S3_HEAD_STATUS_503:Service Unavailable"));
  results.minio_429=classifier.classify(new Error("EA5C1_S3_PUT_STATUS_429:Too Many Requests"));
  results.minio_403=classifier.classify(new Error("EA5C1_S3_HEAD_STATUS_403:Access Denied"));

  for(const key of ["timeout","tcp_reset","tls_handshake_timeout","truncated_terminated","provider_429","provider_503","minio_503","minio_429"]){
    assert.equal(results[key],"RETRYABLE",`FDG_TRANSPORT_RETRYABLE_REQUIRED:${key}`);
  }
  for(const key of ["unexpected_content_type","empty_body","oversized_body"]){
    assert.equal(results[key],"ATTEMPT_REJECTED",`FDG_TRANSPORT_ATTEMPT_REJECTED_REQUIRED:${key}`);
  }
  for(const key of ["identity_drift","tls_certificate_invalid","minio_403"]){
    assert.equal(results[key],"PROCESS_FATAL",`FDG_TRANSPORT_PROCESS_FATAL_REQUIRED:${key}`);
  }

  const proof={
    schema_version:"geox_mcft_cap09_failure_discovery_transport_matrix_v1",
    status:"PASS",
    case_count:Object.keys(results).length,
    results,
    retryable_transport_faults_proven:true,
    provider_payload_shape_rejected_without_process_fatal:true,
    redirect_identity_boundary_remains_process_fatal:true,
    tls_certificate_boundary_remains_process_fatal:true,
    private_store_transient_status_retryable:true,
    private_store_auth_failure_process_fatal:true,
    external_network_request_count:0,
    authority_effect:false,
    production_effect:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
