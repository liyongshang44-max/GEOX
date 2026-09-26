import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GfsRawBundleEvidenceDecoderV1 } from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import { McftCap09ProductionEvidenceFailureClassifierV1 } from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_GFS_SUBPROCESS_V1_RESULT.json");
const TARGET="2026-08-27T12:00:00.000Z";
const AVAILABLE="2026-08-27T11:59:00.000Z";

function provenance(){
  return {
    request_id:"fdg-gfs",
    provider_id:"MCFT_CAP09_GFS_NOMADS_BUNDLE_PROVIDER_V1",
    source_family:"GFS_RAW_BUNDLE_72H_V1",
    source_locator:"https://nomads.ncep.noaa.gov/",
    final_locator:"https://nomads.ncep.noaa.gov/",
    content_type:"application/x-tar",
    retrieved_at:AVAILABLE,
    available_at:AVAILABLE,
    raw_sha256:"sha256:"+"0".repeat(64),
    raw_bytes:4,
    retention_ref:"fixture-retained://gfs",
    retained_at:AVAILABLE,
    use_policy_ref:"FDG_NON_AUTHORITY",
  } as const;
}
async function runToken(token:string):Promise<Error & {failure_token?:string;diagnostic_token?:string;code?:string}>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"fdg-gfs-subprocess-"));
  const script=path.join(root,"fail.py");
  fs.writeFileSync(script,`import sys\nsys.stderr.write("RuntimeError: ${token}\\n")\nraise SystemExit(1)\n`);
  try{
    const decoder=new GfsRawBundleEvidenceDecoderV1(TARGET,{python_executable:"python",product_decoder_path:script});
    let failure:unknown=null;
    try{
      await decoder.decodeRetainedEvidence({raw_bytes:Buffer.from("TAR!"),provenance:provenance()});
    }catch(error){failure=error;}
    assert(failure instanceof Error,`GFS_SUBPROCESS_FAILURE_REQUIRED:${token}`);
    return failure as Error & {failure_token?:string;diagnostic_token?:string;code?:string};
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
}
async function main():Promise<void>{
  const classifier=new McftCap09ProductionEvidenceFailureClassifierV1();

  const badGrib=await runToken("MCFT_CAP09_GFS_PGRB2_NOT_GRIB:F006");
  assert.equal(badGrib.name,"GfsRawBundleScientificSubprocessError");
  assert.equal(badGrib.failure_token,"MCFT_CAP09_GFS_PGRB2_NOT_GRIB");
  assert.equal(badGrib.diagnostic_token,"MCFT_CAP09_GFS_PGRB2_NOT_GRIB:F006");
  assert.equal(classifier.classify(badGrib),"ATTEMPT_REJECTED");

  const missingMember=await runToken("MCFT_CAP09_GFS_BUNDLE_MEMBER_REQUIRED:pgrb2/f006.grib2");
  assert.equal(missingMember.failure_token,"MCFT_CAP09_GFS_BUNDLE_MEMBER_REQUIRED");
  assert.equal(classifier.classify(missingMember),"ATTEMPT_REJECTED");

  const targetMismatch=await runToken("MCFT_CAP09_GFS_BUNDLE_TARGET_MISMATCH");
  assert.equal(targetMismatch.failure_token,"MCFT_CAP09_GFS_BUNDLE_TARGET_MISMATCH");
  assert.equal(classifier.classify(targetMismatch),"PROCESS_FATAL");

  const causality=await runToken("MCFT_CAP09_GFS_DECODE_BEFORE_AVAILABLE");
  assert.equal(classifier.classify(causality),"PROCESS_FATAL");

  const unclassified=await runToken("NOT_A_GEOX_TOKEN");
  assert.equal(unclassified.failure_token,"MCFT_CAP09_GFS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED");
  assert.equal(classifier.classify(unclassified),"PROCESS_FATAL");

  const proof={
    schema_version:"geox_mcft_cap09_failure_discovery_gfs_subprocess_v1",
    status:"PASS",
    structured_gfs_subprocess_token_propagation:true,
    bad_grib_attempt_rejected:true,
    missing_bundle_member_attempt_rejected:true,
    bundle_target_mismatch_process_fatal:true,
    decode_before_available_process_fatal:true,
    unclassified_subprocess_is_explicit_and_detectable:true,
    generic_child_process_error_escape:false,
    authority_effect:false,
    production_effect:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
