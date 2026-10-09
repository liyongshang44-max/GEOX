"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const {buildArm,effectivePolicy,verifyOwnerBinding}=require("./MCFT_CAP_09_AM22_START_CHAIN_V2.cjs");
const {LEGACY,canonical,digest}=require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const {verifyExecutionQualification}=require("./MCFT_CAP_09_AM22_EXECUTION_QUALIFICATION_V2.cjs");
const {preparationCommands,a0Commands,runStep}=require("./RUN_MCFT_CAP_09_AM22_CUTOVER_ARM_A0_V2.cjs");
let cases=0;const check=fn=>{fn();cases++;},hash="sha256:"+"b".repeat(64),subject="a".repeat(40);
const c={subject_sha:subject,epoch_id:"am22_unit_epoch",current_crop_authority_sha256:hash,qualified_envelope_sha256:hash,retirement_receipt_sha256:hash,clock:{database_now_utc:"2026-10-08T05:30:00.000Z",a0:"2026-10-08T06:00:00.000Z",o00:"2026-10-08T07:00:00.000Z",o23:"2026-10-09T06:00:00.000Z"}};
const store={transaction_read_only:true,formal_database_name:LEGACY.database,all_table_rows_zero:true,public_base_table_count:29,public_routine_count:2};
const h5={status:"PASS",deployment_subject_sha:subject,formal_v5_arm_ready:true,exact_one_live_fenced_owner_per_runtime_role_reverified:true};
const handoff={schema_version:"geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2",deployment_subject_sha:subject,activation_fence_time:"2026-10-08T05:30:00.000Z",formal_a0_logical_time:c.clock.a0,formal_o00_logical_time:c.clock.o00,formal_o23_logical_time:c.clock.o23};
check(()=>{const arm=buildArm(c,store,handoff,h5,"2026-10-08T05:35:00.000Z");const {arm_identity_hash,...body}=arm;assert.equal(arm_identity_hash,digest(body));assert.equal(arm.arm_issuer,"AM22_V2");assert.equal(arm.fixed_36_hour_lead_used,false);assert.equal(arm.readiness_deadline,arm.a0);});
for(const bad of [{...h5,status:"FAIL"},{...h5,deployment_subject_sha:"f".repeat(40)},{...h5,exact_one_live_fenced_owner_per_runtime_role_reverified:false}])check(()=>assert.throws(()=>buildArm(c,store,handoff,bad,"2026-10-08T05:35:00.000Z"),/FRESH_H5_REQUIRED/));
for(const bad of [{...handoff,schema_version:"geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1"},{...handoff,formal_a0_logical_time:"2026-10-10T05:00:00.000Z"}])check(()=>assert.throws(()=>buildArm(c,store,bad,h5,"2026-10-08T05:35:00.000Z"),/V2_HANDOFF_CLOCK_MISMATCH/));
for(const bad of [{...store,all_table_rows_zero:false},{...store,transaction_read_only:false},{...store,public_base_table_count:28}])check(()=>assert.throws(()=>buildArm(c,bad,handoff,h5,"2026-10-08T05:35:00.000Z"),/FRESH_PRISTINE_STORE_REQUIRED/));
for(const now of ["2026-10-08T05:20:00.000Z","2026-10-08T06:00:00.000Z"])check(()=>assert.throws(()=>buildArm(c,store,handoff,h5,now),/SAME_UTC_HOUR_CUTOVER_ARM_REQUIRED/));
const pair=crypto.generateKeyPairSync("ed25519"),other=crypto.generateKeyPairSync("ed25519");
const root={execution_qualification_rule:"DETACHED_ED25519_EXACT_MAIN_HOST_IMAGE_EVIDENCE_V2",execution_qualification_signing_public_key_pem:pair.publicKey.export({type:"spki",format:"pem"}),production_start_authorized:false};
const body={schema_version:"geox_mcft_cap09_am22_detached_execution_qualification_v2",status:"PASS",synthetic:false,issued_at_database_utc:"2026-10-08T05:00:00.000Z",expires_at_database_utc:"2026-10-09T05:00:00.000Z",complete_pre_a0_measurement_qualified:true,new_handoff_arm_a0_chain_qualified:true,qualified_subject_sha:subject,qualified_host_id:LEGACY.host,qualified_image_id:hash,qualified_envelope_sha256:hash,approved_current_crop_authority_sha256:hash,production_start_authorized:true};
const cert={...body,signature_base64:crypto.sign(null,Buffer.from(canonical(body)),pair.privateKey).toString("base64")};
check(()=>assert.equal(verifyExecutionQualification(root,cert,"2026-10-08T05:30:00.000Z").production_start_authorized,false));
for(const bad of [{...cert,qualified_subject_sha:"f".repeat(40)},{...cert,signature_base64:""}])check(()=>assert.throws(()=>verifyExecutionQualification(root,bad,"2026-10-08T05:30:00.000Z"),/SIGNATURE_INVALID/));
check(()=>assert.throws(()=>verifyExecutionQualification({...root,execution_qualification_signing_public_key_pem:other.publicKey.export({type:"spki",format:"pem"})},cert,"2026-10-08T05:30:00.000Z"),/SIGNATURE_INVALID/));
for(const now of ["2026-10-08T04:59:59.000Z","2026-10-09T05:00:00.000Z"])check(()=>assert.throws(()=>verifyExecutionQualification(root,cert,now),/CERTIFICATE_FUTURE_OR_EXPIRED/));
check(()=>assert.throws(()=>verifyExecutionQualification({...root,execution_qualification_signing_public_key_pem:null},cert,"2026-10-08T05:30:00.000Z"),/GOVERNED_PUBLIC_KEY_REQUIRED/));
check(()=>assert.throws(()=>effectivePolicy(),/EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED/));
const binding={subject_sha:subject,host_id:LEGACY.host,image_id:hash};
const t={status:"PASS",container_running:true,container_image_id:hash,expected_host_id:LEGACY.host};
const role={t1:t,t2:t,renewal:{status:"PASS",same_effective_owner:true,same_container_instance:true,same_image_id:true}};
const owner={status:"PASS",subject_main_sha:subject,actual_host_id:LEGACY.host,authorized_image_id:hash,blockers:[],evidence_runtime:role,twin_runtime_scheduler:role};
check(()=>assert.equal(verifyOwnerBinding(owner,binding),owner));
check(()=>assert.throws(()=>verifyOwnerBinding({...owner,authorized_image_id:"sha256:"+"f".repeat(64)},binding),/LIVE_OWNER_EXECUTION_BINDING_MISMATCH/));
check(()=>assert.throws(()=>verifyOwnerBinding({...owner,evidence_runtime:{...role,renewal:{...role.renewal,same_effective_owner:false}}},binding),/LIVE_OWNER_RENEWAL_REQUIRED/));
check(()=>assert.deepEqual(preparationCommands("input","rearm","out").map(x=>path.basename(x.file)),["RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V2.cjs","ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V2.cjs","RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts"]));
check(()=>assert.deepEqual(a0Commands("out").map(x=>path.basename(x.file)),["RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION_V2.cjs","RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V2.cjs"]));
check(()=>{const source=fs.readFileSync(path.join(__dirname,"RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V2.cjs"),"utf8");assert.ok(!source.includes('"build","geox-mcft-cap09-evidence-runtime-v1"'));assert.ok(!source.includes('"down"'));assert.match(source,/"--pull","never"/);});
for(const file of ["RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V2.cjs","ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V2.cjs","RUN_MCFT_CAP_09_AM22_CUTOVER_ARM_A0_V2.cjs","RUN_MCFT_CAP_09_AM22_EVIDENCE_OWNER_ENTRY_V2.cjs"]){check(()=>{const result=cp.spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:"utf8"});assert.notEqual(result.status,0);assert.match(result.stderr,/EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED/);});}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"am22-chain-unit-"));
try{fs.writeFileSync(path.join(tmp,"unit.started.json"),"{}");check(()=>assert.throws(()=>runStep({file:path.join(tmp,"unit.cjs"),args:[]},tmp,100),/PARTIAL_OR_PRIOR_OPERATION/));}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const gov=require("../governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs");
const after=JSON.parse(fs.readFileSync(path.join(__dirname,"../../",gov.QCP),"utf8"));
const before=structuredClone(after);before.checks.pop();delete before.dependency_resolvers.AM22_START_CHAIN_ENGINEERING_ONLY_V2;
const p=JSON.parse(fs.readFileSync(path.join(__dirname,"../../",gov.POLICY),"utf8"));
const mutable=[gov.QCP,gov.PRIOR,gov.RETIRE,gov.BOUNDARY],changes=gov.PATHS.map(rel=>({rel,status:mutable.includes(rel)?"M":"A"}));
check(()=>gov.validateBoundary(changes,p,before,after));
check(()=>assert.throws(()=>gov.validateBoundary([...changes,{rel:"unknown/provider.ts",status:"A"}],p,before,after),/UNKNOWN_PATH/));
check(()=>assert.throws(()=>gov.validateBoundary([...changes,{rel:gov.POLICY,status:"M"}],p,before,after),/UNKNOWN_PATH/));
check(()=>assert.throws(()=>gov.validateBoundary(changes,{...p,production_start_authorized:true},before,after),/AUTHORITY_ESCALATION/));
check(()=>{const altered=structuredClone(after);altered.checks[0].owner="changed";assert.throws(()=>gov.validateBoundary(changes,p,before,altered),/PREDECESSOR_QCP_CHANGED/);});
check(()=>{const altered=structuredClone(after);altered.dependency_resolvers.AM22_START_CHAIN_ENGINEERING_ONLY_V2.paths.push("unknown.ts");assert.throws(()=>gov.validateBoundary(changes,p,before,altered),/RESOLVER_CHANGED/);});
console.log(JSON.stringify({status:"PASS",cases,unit_fixtures_only:true,real_host_cutover:false,real_host_full_preparation_measurement:false,production_database_write_count:0,service_stop_count:0,a0_execution:false}));
// The adopted 36-case engineering boundary above remains intact. These cases
// separately qualify only the private-repository current-main transport fix.
const transportBefore=fs.readFileSync(path.join(__dirname,"../../",gov.TRANSPORT_WORKFLOW),"utf8").replace(gov.TRANSPORT_AFTER,gov.TRANSPORT_BEFORE);
const transportAfter=transportBefore.replace(gov.TRANSPORT_BEFORE,gov.TRANSPORT_AFTER);
const transportChanges=gov.TRANSPORT_PATHS.map(rel=>({rel,status:"M"}));
let transportCases=0;const transportCheck=fn=>{fn();transportCases++;};
transportCheck(()=>gov.validateTransportBoundary(transportChanges,transportBefore,transportAfter));
transportCheck(()=>assert.throws(()=>gov.validateTransportBoundary([...transportChanges,{rel:gov.POLICY,status:"M"}],transportBefore,transportAfter),/UNKNOWN_PATH/));
transportCheck(()=>assert.throws(()=>gov.validateTransportBoundary(transportChanges.map(x=>({...x,status:"D"})),transportBefore,transportAfter),/EXISTING_PATH_ONLY/));
transportCheck(()=>assert.throws(()=>gov.validateTransportBoundary(transportChanges,transportBefore,transportAfter.replace("17 5 * * *","0 0 * * *")),/ONLY_AUTHENTICATED_MAIN_READ_ALLOWED/));
transportCheck(()=>assert.throws(()=>gov.validateTransportBoundary(transportChanges,transportBefore,transportAfter.replace("persist-credentials: false","persist-credentials: true")),/ONLY_AUTHENTICATED_MAIN_READ_ALLOWED/));
transportCheck(()=>assert.throws(()=>gov.validateTransportBoundary(transportChanges,transportBefore,transportAfter.replace("architecture_effective!==false","architecture_effective!==true")),/ONLY_AUTHENTICATED_MAIN_READ_ALLOWED/));
if(process.platform!=="win32"){
 const shellDir=fs.mkdtempSync(path.join(os.tmpdir(),"am22-main-read-"));
 try{
  const subjectSha="a".repeat(40),otherSha="b".repeat(40),marker=path.join(shellDir,"adjudicator-called");
  const workflowScript=transportAfter.split("      - name: Adjudicate current protected-main successor-chain effectiveness\n")[1].split("      - name: Run fresh persistent lifecycle qualification\n")[0].split("        run: |\n")[1].split(/\r?\n/).map(x=>x.startsWith("          ")?x.slice(10):x).join("\n").replaceAll("${{ github.sha }}",subjectSha);
  const commands={gh:'#!/bin/sh\nif [ "$TEST_API_FAIL" = "1" ]; then exit 1; fi\nprintf "%s\\n" "$TEST_API_SHA"\n',git:'#!/bin/sh\nif [ "$3" = "origin/main" ]; then printf "%s\\n" "$TEST_CHECKOUT_SHA"; else printf "%s\\n" "$TEST_HEAD_SHA"; fi\n',node:'#!/bin/sh\nprintf "CALLED\\n" > "$TEST_MARKER"\n'};
  for(const [name,body] of Object.entries(commands))fs.writeFileSync(path.join(shellDir,name),body,{mode:0o700});
  for(const scenario of [{pass:true},{pass:false,TEST_API_SHA:otherSha},{pass:false,TEST_HEAD_SHA:otherSha},{pass:false,TEST_API_FAIL:"1"}])transportCheck(()=>{
   fs.rmSync(marker,{force:true});
   const result=cp.spawnSync("bash",["-c",workflowScript],{encoding:"utf8",env:{...process.env,PATH:shellDir+path.delimiter+process.env.PATH,GITHUB_REPOSITORY:"fixture/private-repo",TEST_MARKER:marker,TEST_API_SHA:subjectSha,TEST_CHECKOUT_SHA:subjectSha,TEST_HEAD_SHA:subjectSha,...scenario}});
   if(scenario.pass){assert.equal(result.status,0,result.stderr);assert.ok(fs.existsSync(marker));}else{assert.notEqual(result.status,0);assert.ok(!fs.existsSync(marker));}
  });
 }finally{fs.rmSync(shellDir,{recursive:true,force:true});}
}
console.log(JSON.stringify({status:"PASS",transport_cases:transportCases,scope:"AUTHENTICATED_MAIN_READ_ONLY",fresh_authority_generated:false,production_effect:false}));
// Public trust-key adoption is independent of host qualification and authority activation.
const keyBefore=JSON.parse(cp.execFileSync("git",["show",gov.KEY_BASE+":"+gov.POLICY],{cwd:path.resolve(__dirname,"../.."),encoding:"utf8"}));
const keyAfter={...keyBefore,execution_qualification_rule:"DETACHED_ED25519_EXACT_MAIN_HOST_IMAGE_EVIDENCE_V2",execution_qualification_signing_public_key_pem:gov.KEY_PEM};
const keyChanges=gov.KEY_PATHS.map(rel=>({rel,status:"M"}));
let keyCases=0;const keyCheck=fn=>{fn();keyCases++;};
keyCheck(()=>gov.validateKeyBoundary(keyChanges,keyBefore,keyAfter));
keyCheck(()=>assert.throws(()=>gov.validateKeyBoundary([...keyChanges,{rel:"apps/server/src/unknown.ts",status:"M"}],keyBefore,keyAfter),/EXACT_PATH_SET_REQUIRED/));
keyCheck(()=>assert.throws(()=>gov.validateKeyBoundary(keyChanges.slice(1),keyBefore,keyAfter),/EXACT_PATH_SET_REQUIRED/));
keyCheck(()=>assert.throws(()=>gov.validateKeyBoundary(keyChanges.map(x=>({...x,status:"D"})),keyBefore,keyAfter),/EXISTING_PATH_ONLY/));
for(const field of ["complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified","production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed"])keyCheck(()=>assert.throws(()=>gov.validateKeyBoundary(keyChanges,keyBefore,{...keyAfter,[field]:true}),/TRUST_FIELDS_ONLY/));
for(const mutated of [{...keyAfter,status:"EFFECTIVE_ON_PROTECTED_MAIN"},{...keyAfter,extra_authorization:true},{...keyAfter,execution_qualification_rule:"CALLER_SUPPLIED_KEY"},{...keyAfter,execution_qualification_signing_public_key_pem:pair.publicKey.export({type:"spki",format:"pem"})}])keyCheck(()=>assert.throws(()=>gov.validateKeyBoundary(keyChanges,keyBefore,mutated),/TRUST_FIELDS_ONLY/));
keyCheck(()=>assert.throws(()=>verifyExecutionQualification(keyAfter,cert,"2026-10-08T05:30:00.000Z"),/SIGNATURE_INVALID/));
keyCheck(()=>assert.deepEqual(p,keyAfter));
keyCheck(()=>assert.throws(()=>effectivePolicy(),/EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED/));
console.log(JSON.stringify({status:"PASS",key_adoption_cases:keyCases,public_key_sha256:gov.KEY_DIGEST,host_private_key_accessed:false,execution_certificate_issued:false,production_effect:false}));
