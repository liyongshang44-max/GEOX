#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");

function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function canonicalIso(value,code){
  const text=String(value??"").trim();
  const t=Date.parse(text);
  if(!Number.isFinite(t)||new Date(t).toISOString()!==text)fail(code,text);
  return text;
}
function sha256(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex")}
function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined}
function graduate(candidate,cert,certDigest){
  if(candidate.schema_version!=="geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || candidate.status!=="PASS"
    || candidate.qualification_outcome!=="CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"){
    fail("EFFECTIVE_CURRENT_CROP_CANDIDATE_REQUIRED");
  }
  if(candidate.architecture_effective!==false||candidate.runtime_consumption_authorized!==false){
    fail("EFFECTIVE_CURRENT_CROP_INPUT_MUST_BE_UNGRADUATED");
  }
  const life=candidate.lifecycle||{};
  if(life.domain_state!=="ACTIVE"||life.authority_status!=="RESOLVED"||life.authority_validity!=="VALID"
    || life.authority_mode!=="GOVERNED_PERSISTENT_STATE"||life.active_consumable_candidate!==true){
    fail("EFFECTIVE_CURRENT_CROP_LIFECYCLE_NOT_CONSUMABLE");
  }
  const bio=candidate.biological_stage||{};
  if(!bio.resolved_biological_stage)fail("EFFECTIVE_CURRENT_CROP_BIOLOGICAL_STAGE_UNRESOLVED");
  if(bio.epistemic_class!=="DIRECT_OBSERVED_PHENOLOGY"&&bio.observed_biological_stage_claimed!==false){
    fail("EFFECTIVE_CURRENT_CROP_DERIVED_OBSERVED_CLAIM_FORBIDDEN");
  }
  if(!candidate.crop_water_use_stage)fail("EFFECTIVE_CURRENT_CROP_WATER_USE_STAGE_UNRESOLVED");
  const kc=candidate.crop_model_parameter||{};
  if(kc.parameter!=="Kc"||kc.stage_code!==candidate.crop_water_use_stage
    || typeof kc.value!=="number"||!Number.isFinite(kc.value)||kc.production_effective!==false){
    fail("EFFECTIVE_CURRENT_CROP_KC_AUTHORITY_INVALID");
  }
  if(!/^sha256:[0-9a-f]{64}$/.test(String(candidate.evidence_digest??""))){
    fail("EFFECTIVE_CURRENT_CROP_EVIDENCE_DIGEST_REQUIRED");
  }
  if(cert.schema_version!=="geox_dt02_biological_stage_authority_effectiveness_v1"
    || cert.amendment_id!=="DT02-AMENDMENT-03"||cert.status!=="EFFECTIVE"||cert.effective!==true){
    fail("EFFECTIVE_CURRENT_CROP_ARCHITECTURE_CERTIFICATE_REQUIRED");
  }
  const issued=Date.parse(canonicalIso(cert.issued_at,"EFFECTIVE_CURRENT_CROP_CERT_ISSUED_AT_INVALID"));
  const asOf=Date.parse(canonicalIso(bio.authority_as_of,"EFFECTIVE_CURRENT_CROP_STAGE_AS_OF_INVALID"));
  const forward=Number(bio.forward_stability_hours);
  if(!Number.isInteger(forward)||forward<=0||forward>48)fail("EFFECTIVE_CURRENT_CROP_FORWARD_STABILITY_INVALID");
  if(issued<asOf)fail("EFFECTIVE_CURRENT_CROP_CERT_PRECEDES_STAGE_AUTHORITY");
  if(issued>asOf+forward*3600000)fail("EFFECTIVE_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_GRADUATION");
  const horizon=Date.parse(canonicalIso(life.horizon_end_utc,"EFFECTIVE_CURRENT_CROP_LIFECYCLE_HORIZON_INVALID"));
  if(issued>horizon)fail("EFFECTIVE_CURRENT_CROP_LIFECYCLE_HORIZON_EXPIRED");

  const out=JSON.parse(JSON.stringify(candidate));
  out.architecture_effective=true;
  out.runtime_consumption_authorized=true;
  out.graduation={
    status:"EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
    amendment_id:"DT02-AMENDMENT-03",
    architecture_effectiveness_sha256:certDigest,
    protected_main_sha:cert.protected_main_sha,
    graduated_at:cert.issued_at
  };
  return out;
}
function selftest(){
  const cert={
    schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id:"DT02-AMENDMENT-03",status:"EFFECTIVE",effective:true,
    protected_main_sha:"1".repeat(40),issued_at:"2026-09-03T05:00:00.000Z"
  };
  const candidate={
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective:false,runtime_consumption_authorized:false,
    lifecycle:{domain_state:"ACTIVE",authority_status:"RESOLVED",authority_validity:"VALID",
      authority_mode:"GOVERNED_PERSISTENT_STATE",active_consumable_candidate:true,
      horizon_end_utc:"2026-11-24T03:59:59.999Z"},
    biological_stage:{epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,authority_as_of:"2026-09-03T04:00:00.000Z",
      forward_stability_hours:30},
    crop_water_use_stage:"LATE",
    crop_model_parameter:{parameter:"Kc",stage_code:"LATE",value:0.6,production_effective:false},
    evidence_digest:"sha256:"+"a".repeat(64),
    runtime_start_authorized:false,production_owner_activation_authorized:false,
    formal_v5_authorized:false,a0_authorized:false,o00_o23_authorized:false
  };
  const out=graduate(candidate,cert,"sha256:"+"b".repeat(64));
  if(out.architecture_effective!==true||out.runtime_consumption_authorized!==true
    ||out.evidence_digest!==candidate.evidence_digest||out.crop_model_parameter.production_effective!==false
    ||out.runtime_start_authorized!==false){
    fail("EFFECTIVE_CURRENT_CROP_SELFTEST_FAILED");
  }
  let stale=false;
  try{
    graduate({...candidate,biological_stage:{...candidate.biological_stage,authority_as_of:"2026-09-01T00:00:00.000Z"}},cert,"sha256:"+"b".repeat(64));
  }catch(error){stale=String(error.message||error).includes("STAGE_AUTHORITY_STALE_AT_GRADUATION")}
  if(!stale)fail("EFFECTIVE_CURRENT_CROP_STALE_SELFTEST_FAILED");
  console.log(JSON.stringify({status:"PASS",selftest:true}));
}
function main(){
  if(process.argv.includes("--selftest"))return selftest();
  const candidatePath=String(arg("--candidate")??"").trim();
  const certPath=String(arg("--architecture-effectiveness")??"").trim();
  const outPath=String(arg("--out")??"").trim();
  if(!candidatePath||!certPath||!outPath)fail("EFFECTIVE_CURRENT_CROP_ARGUMENTS_REQUIRED");
  const candidateBytes=fs.readFileSync(candidatePath);
  const certBytes=fs.readFileSync(certPath);
  const candidate=JSON.parse(candidateBytes.toString("utf8"));
  const cert=JSON.parse(certBytes.toString("utf8"));
  const out=graduate(candidate,cert,sha256(certBytes));
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
  console.log(JSON.stringify(out));
}
try{main()}catch(error){console.error(error instanceof Error?error.message:String(error));process.exit(1)}
