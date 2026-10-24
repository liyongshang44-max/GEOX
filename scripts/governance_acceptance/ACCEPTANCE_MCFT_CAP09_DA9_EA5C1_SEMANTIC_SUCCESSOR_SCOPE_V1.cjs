"use strict";
// New DA9 EA5C1 semantic successor: prove current protected-main byte-preservation,
// without impersonating the original predecessor-only EA5C1 authority acceptance.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),BASE="2b63652297bb285f21c4d4c63c37d247d009142c";
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
const files=Object.freeze([
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_SUCCESSOR_REPLAY_COMPLETE_INGRESS_V1.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.cjs",
  ".github/workflows/mcft-cap-09-ea5c1-durable-raw-restricted-ingress.yml"
]);
const forbidden=["MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_STAGE","MCFT_CAP09_ADOPTION_REQUEST","GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL","GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL"];
for(const k of forbidden)assert(!process.env[k],"EA5C1_SUCCESSOR_AUTHORIZED_RUNTIME_ENV_FORBIDDEN:"+k);
const head=git("rev-parse","HEAD");
assert(/^[a-f0-9]{40}$/.test(head));assert.equal(git("merge-base",BASE,head),BASE,"ADOPTED_BASE_NOT_ANCESTOR");
const scoped=require("./VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs").scope();
assert.equal(scoped.status,"ISOLATED_SEMANTIC_DELTA_PINNED_NOT_QCP_PASS");
assert.equal(scoped.subject_sha,head);
const bindings=files.map(file=>{
 const old=git("rev-parse",BASE+":"+file),fresh=git("rev-parse",head+":"+file);
 assert.equal(fresh,old,"EA5C1_ADOPTED_SOURCE_CHANGED_REQUIRES_SEPARATE_REVIEW:"+file);
 return {path:file,adopted_blob:old,current_blob:fresh,match:true};
});
const raw=bindings.find(x=>x.path.endsWith("s3_compatible_raw_evidence_retention_adapter_v1.ts"));
assert.equal(raw.adopted_blob,"9f9067058f2339937de5ddcf3940ce32eac3ce66","EA5C1_CURRENT_ADOPTED_RAW_NOT_PINNED");
assert.notEqual(raw.adopted_blob,"dfa2c10266a5079842012426aed175851d30ca44","EA5C1_HISTORICAL_RAW_MUST_NOT_BE_INHERITED");
const receipt={schema_version:"geox_mcft_cap09_da9_ea5c1_semantic_successor_scope_v1",
 status:"PASS",proof_subject_sha:head,base_sha:BASE,source_bindings:bindings,
 current_ea5c1_source_preserved_against_adopted_main:true,
 historical_ea5c1_predecessor_only_gate_purposely_not_promoted:true,
 isolated_frozen_retention_delta_pinned:true,
 mandatory_real_pg_s3_ea5c1_acceptance_still_required:true,
 historical_authority_requalified:false,production_authorized:false,
 production_write_performed:false,provider_calls:0,permit_signed:false,permit_consumed:false,
 third_attempt_authorized:false};
const dest=path.join(ROOT,"acceptance-output/MCFT_CAP09_DA9_EA5C1_SEMANTIC_SUCCESSOR_SCOPE_RESULT.json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(receipt,null,2)+"\n",{flag:"wx",mode:0o600});
console.log(JSON.stringify({status:receipt.status,proof_subject_sha:head,source_files:files.length,
 adopted_same_blob:true,historical_gate_inherited:false,permit_signed:false,production_authorized:false}));
