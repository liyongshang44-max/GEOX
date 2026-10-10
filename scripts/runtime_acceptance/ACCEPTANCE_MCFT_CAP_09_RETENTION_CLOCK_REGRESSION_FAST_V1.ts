import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  resolveRetentionVerificationTimeAfterClockRegressionV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_RETENTION_CLOCK_REGRESSION_FAST_V1_RESULT.json");
const RAW=Buffer.from("fdg-clock-regression-fixture","utf8");
const RAW_SHA=`sha256:${createHash("sha256").update(RAW).digest("hex")}`;
const RETRIEVED="2026-09-25T12:03:38.000Z";
const RETRIEVED_MS=Date.parse(RETRIEVED);

async function main():Promise<void>{
  let recoveringIndex=0;
  let recoveringMonotonic=0;
  const recoveringWaits:number[]=[];
  const recoveringWall=[
    RETRIEVED_MS-3_000,
    RETRIEVED_MS-1_000,
    RETRIEVED_MS+5,
  ];
  const recovered=await resolveRetentionVerificationTimeAfterClockRegressionV1({
    retrieved_at:RETRIEVED,
    source_family:"RAW_HOURLY_WEATHER",
    raw_sha256:RAW_SHA,
    clock:()=>new Date(recoveringWall[Math.min(recoveringIndex++,recoveringWall.length-1)]!),
    max_wait_ms:5_000,
    poll_ms:1_000,
    async wait(milliseconds){recoveringWaits.push(milliseconds);recoveringMonotonic+=milliseconds;},
    monotonic_now_ms:()=>recoveringMonotonic,
  });
  assert.equal(Date.parse(recovered)>=RETRIEVED_MS,true);
  assert.deepEqual(recoveringWaits,[1_000,1_000]);

  let persistentMonotonic=0;
  const persistentWaits:number[]=[];
  let persistentError:unknown=null;
  try{
    await resolveRetentionVerificationTimeAfterClockRegressionV1({
      retrieved_at:RETRIEVED,
      source_family:"RAW_HOURLY_WEATHER",
      raw_sha256:RAW_SHA,
      clock:()=>new Date(RETRIEVED_MS-3_000),
      max_wait_ms:2_000,
      poll_ms:1_000,
      async wait(milliseconds){persistentWaits.push(milliseconds);persistentMonotonic+=milliseconds;},
      monotonic_now_ms:()=>persistentMonotonic,
    });
  }catch(error){persistentError=error;}
  assert(persistentError instanceof Error);
  assert.match(
    persistentError.message,
    /^EA5C1_RETENTION_VERIFICATION_BEFORE_RETRIEVAL:delta_ms=3000:source_family=RAW_HOURLY_WEATHER:raw_sha256=sha256:[0-9a-f]{64}$/,
  );
  assert.deepEqual(persistentWaits,[1_000,1_000]);

  let backwardMonotonicCalls=0;
  await assert.rejects(
    ()=>resolveRetentionVerificationTimeAfterClockRegressionV1({
      retrieved_at:RETRIEVED,
      source_family:"RAW_HOURLY_WEATHER",
      raw_sha256:RAW_SHA,
      clock:()=>new Date(RETRIEVED_MS-3_000),
      max_wait_ms:2_000,
      poll_ms:1_000,
      async wait(){},
      monotonic_now_ms:()=>backwardMonotonicCalls++===0?100:50,
    }),
    /EA5C1_RETENTION_MONOTONIC_CLOCK_INVALID/,
  );

  const proof={
    schema_version:"geox_mcft_cap09_retention_clock_regression_fast_v1",
    status:"PASS",
    product_barrier_function_used:true,
    no_postgres_required:true,
    no_s3_required:true,
    no_network_required:true,
    transient_wall_clock_regression_recovers:true,
    provider_retrieved_at_rewritten:false,
    persistent_regression_fails_closed:true,
    persistent_regression_stable_failure_token:true,
    monotonic_clock_regression_fails_closed:true,
    recovering_waits_ms:recoveringWaits,
    persistent_waits_ms:persistentWaits,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
