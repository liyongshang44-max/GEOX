"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const chain=require("./MCFT_CAP_09_AM22_START_CHAIN_V2.cjs");
const value=name=>process.argv.slice(2).find(x=>x.startsWith(name+"="))?.slice(name.length+1);
try{
 chain.effectivePolicy();
 chain.req(!process.env.CI&&!process.env.GITHUB_ACTIONS,"LOCAL_HOST_REQUIRED");
 chain.req(process.argv.includes("--operator-authorized"),"OPERATOR_AUTHORIZATION_REQUIRED");
 chain.req(value("--input")&&value("--materialized-zero-rearm-proof")&&value("--out"),"ARM_ARGUMENTS_REQUIRED");
 const input=chain.json(path.resolve(value("--input")));
 const store=chain.readOnlyStore(),c=chain.candidate(input,store.database_now_utc);
 const runtimeRoot=path.join(os.homedir(),".geox","mcft-cap09","runtime",c.subject_sha);
 const handoff=chain.json(path.join(runtimeRoot,"formal-v5-evidence-runtime-handoff-authority.json"));
 // Existing H5 performs independent live lease/container/image renewal verification.
 cp.execFileSync(process.execPath,[path.join(__dirname,"VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs"),"--materialized-zero-rearm-proof="+path.resolve(value("--materialized-zero-rearm-proof")),"--expected-subject="+c.subject_sha],{cwd:chain.ROOT,stdio:"inherit"});
 cp.execFileSync(process.execPath,[path.join(chain.ROOT,"scripts/governance_acceptance/AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs"),"enforce"],{cwd:chain.ROOT,stdio:"inherit"});
 const h5=chain.json(path.join(chain.ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1_RESULT.json"));
 chain.verifyOwnerBinding(chain.json(path.join(chain.ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json")),input.binding);
 const fresh=chain.readOnlyStore();
 const arm=chain.buildArm(c,fresh,handoff,h5,fresh.database_now_utc);
 chain.immutable(path.resolve(value("--out")),arm);
 console.log(JSON.stringify({status:"PASS",arm_identity_hash:arm.arm_identity_hash,arm_issuer:arm.arm_issuer,arm_path:path.resolve(value("--out")),a0:arm.a0,o00:arm.o00,o23:arm.o23,database_write_count:0,service_stop_count:0,a0_execution:false},null,2));
}catch(error){console.error(/^AM22_|^FORMAL_ARM_/.test(error.message)?error.message:"AM22_ARM_ISSUANCE_FAILED");process.exitCode=1;}
