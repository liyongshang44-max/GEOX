import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const {validateQualificationAuthorityV1}=require("./qualification_execution_authority_gate_v1.cjs") as {validateQualificationAuthorityV1(authority:Record<string,unknown>,input:Record<string,string>):{module_path:string}};
const {validatePortBundleV1,validateCreatedPortsV1}=require("./workflow_port_bundle_contract_v1.cjs") as {validatePortBundleV1(bundle:unknown):(input:Record<string,unknown>)=>Promise<Record<string,unknown>>|Record<string,unknown>;validateCreatedPortsV1(ports:unknown):Record<string,unknown>};
const {executeRunAQualificationHarnessV1}=require("../mcft_cap08_s6_run_a_qualification/qualification_harness_v1.cjs") as {executeRunAQualificationHarnessV1(input:Record<string,unknown>):Promise<Record<string,unknown>>};
const ROOT=path.resolve(__dirname,"../../..");
const WORKFLOW_PATH=".github/workflows/mcft-cap-08-s6-run-a-qualification-database-execution-v2.yml";
const ENTRYPOINT_PATH="scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v2.ts";
const GATE_PATH="scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_execution_authority_gate_v1.cjs";

async function main():Promise<void>{
  const exactSubjectSha=String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA??"").trim();
  const runLabel="RUN_A";
  const operationalRunInstanceId=String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID??"").trim();
  const authorityPath=String(process.env.MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY??"").trim();
  if(!authorityPath)throw new Error("NORMALIZED_QUALIFICATION_AUTHORITY_REQUIRED");
  const authority=JSON.parse(fs.readFileSync(path.resolve(authorityPath),"utf8")) as Record<string,any>;
  const validated=validateQualificationAuthorityV1(authority,{exactSubjectSha,runLabel,operationalRunInstanceId});
  assert.equal(execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim(),exactSubjectSha,"QUALIFICATION_V2_EXECUTION_SUBJECT_CHECKOUT");
  assert.equal(execFileSync("git",["rev-parse",`HEAD:${validated.module_path}`],{cwd:ROOT,encoding:"utf8"}).trim(),authority.port_bundle_blob_sha,"QUALIFICATION_V2_PORT_BUNDLE_BLOB_DRIFT");
  assert.equal(execFileSync("git",["rev-parse",`HEAD:${WORKFLOW_PATH}`],{cwd:ROOT,encoding:"utf8"}).trim(),authority.qualification_workflow_blob_sha,"QUALIFICATION_V2_WORKFLOW_BLOB_DRIFT");
  assert.equal(execFileSync("git",["rev-parse",`HEAD:${ENTRYPOINT_PATH}`],{cwd:ROOT,encoding:"utf8"}).trim(),authority.qualification_entrypoint_blob_sha,"QUALIFICATION_V2_ENTRYPOINT_BLOB_DRIFT");
  assert.equal(execFileSync("git",["rev-parse",`HEAD:${GATE_PATH}`],{cwd:ROOT,encoding:"utf8"}).trim(),authority.qualification_gate_blob_sha,"QUALIFICATION_V2_GATE_BLOB_DRIFT");
  const imported=require(path.join(ROOT,validated.module_path));
  const createPortsV2=validatePortBundleV1(imported);
  const ports=validateCreatedPortsV1(await createPortsV2({authority,exactSubjectSha,runLabel,operationalRunInstanceId,root:ROOT}));
  const result=await executeRunAQualificationHarnessV1({input:{exactSubjectSha,runLabel,operationalRunInstanceId},ports,executionAuthority:authority});
  const out=path.join(ROOT,"acceptance-output/MCFT_CAP_08_S6_RUN_A_DATABASE_QUALIFICATION_RESULT.json");
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify({status:result.status,evidence_class:result.evidence_class,run_label:runLabel,exact_subject_sha:exactSubjectSha,hard_acceptance_eligible:false},null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
