"use strict";
// One-time source-only cutover, not a live admission or a replacement Trust contract.
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const BASE="8facaba79eaf42d9b9c854c091ae3a7319d455f8",BRANCH="mcft/r4285-one-time-physical-cutover-20261127",REPO="liyongshang44-max/GEOX",C6D="c6d666b4addaf71610bf3135c9380bb2b6ee5069";
const PRIOR=Object.freeze({pr:3781,base:"16fe4dbd03e75acf0209ca3daa906d8c2956b01f",head:"8544c0ac45ccca0456eeb2fa7eb18a3944d796fd",qcp:45460124937,job:138680299793,ci:45460124545,artifact:14952738947,zip:"62a036624aab3ceb67d5fc8eeeac73e13894368d0ddc02b69823a43c760c5441"});
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",CURRENT="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1",RESOLVER="CAP09_R4285_ONE_TIME_PHYSICAL_CUTOVER_V1_EXACT_PATHS";
const WIRING=new Set([
  ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_ONE_TIME_CUTOVER_V1.cjs"
]);
// Each additional non-wiring file is reviewed and bound as a Git tree entry.
const reviewedFiles = Object.freeze({
  ".github/workflows/mcft-cap-09-phase6-runtime-independence.yml": "100644 blob cba4c14a61ff61c6c74f2fa77ae46628b6f58985",
  ".github/workflows/mcft-cap-09-phase3-evidence-runtime-persistence.yml": "100644 blob 50e1532dc62e2f087d24a8f1d23bf13b40d167b9",
  "apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.ts": "100644 blob 5e558f4f1474da89e48c2eaccfc9e63a733136b6",
  "apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts": "100644 blob 4ace3d0b008535967bf7f4b83878d438c37386c0",
  "apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.ts": "100644 blob 0347849d88ec743a46004947bcf82e549c7f0951",
  "apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.ts": "100644 blob 6bae6158f7d1311b008d1fe95cf531614cae4165",
  "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py": "100644 blob a8fc2fda2af3259e6ba8106d5e060985fdcf8832",
  "apps/server/src/external_evidence/provider/run_scientific_python_v1.ts": "100644 blob a6b374b3e1e82e60730c268b94be4b5d87188989",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs": "100644 blob 2c727689fd3ce4ac8c88c584c076f07283ce69f9",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_SCIENTIFIC_CHILD_ISOLATION_V1.ts": "100644 blob 5ec846a9aad619ad0e0af60bd1edb63e4ed50f35",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs": "100644 blob 167c3e51ac0fd02164ba7b0006174a506f1c3940"
});
const PATHS=Object.freeze([...WIRING, ...Object.keys(reviewedFiles)].sort());
const CURRENT_V13_WORKFLOW_BLOB="fc60f5b79392f080c349f39b7c72b1115b5246dd";
const DA9_REVIEW="DA9_SIGNED_COMPOSER_V2_PHASE3_FROZEN_RUNTIME_REVIEW_ONLY";
const SCOPED=Object.freeze([...new Set([...require("./VERIFY_MCFT_CAP09_R4285_FORMAL_BUDGET_SUCCESSOR_V4.cjs").SCOPED,DA9_REVIEW])]);
// Fresh native execution evidence for the reviewed isolation candidate. The
// final control-plane successor must prove the exact same dependency bytes;
// neither the older historical digest nor an unrelated workflow is accepted.
const NATIVE_SOURCE="3ba47200ad8a20263b4c8e7b134198f1657e18f9";
const NATIVE_ROWS=Object.freeze({
 PHASE2_EVIDENCE_PROVIDER_MODULES:{
  run:45963683265,job:140387182171,artifact:15181492721,zip:"315bf8444fb833220ab86c43764522599c7027fe514aad081cd3d6fc747e0d6b",name:"mcft-cap-09-ea5c2b1-",jobName:"ea5c2b1-live-kbs-soil-ingress-executor",
  steps:["Install exact repository dependencies","Validate Phase2 successor boundary without rewriting historical EA5C2B1 authority","Prove KBS Raw Hourly product core preserves Amendment-11 late authority","Prove focused KBS Raw Hourly product adapter and decoder boundary","Prove post-COMMIT visibility gates EvidenceSupplyCursor advance","Execute live KBS source through frozen EA3 and EA5C1 pipeline against CI-only stores","Verify CI raw store remains private","Verify EA5C2B1 nonclaims"]
 },
 PHASE3_EVIDENCE_RUNTIME_FOUNDATION:{
  run:45963683049,job:140387180795,artifact:15182166865,zip:"c357ae78e289020d1a6ff829799d9e2ae0b951bd95c714bf59f22935d1722a2c",name:"mcft-cap09-phase3-evidence-persistence-",jobName:"postgres-evidence-persistence",
  steps:["Install exact repository dependencies","Install pinned GFS scientific stack and prove product decoder","Apply Phase3 Evidence persistence schema only","Prove durable Evidence lease and supply cursor semantics","Prove retained KBS snapshot historical-prefix comparison","Prove reusable verified retained-raw replay primitive","Prove product GFS raw bundle composition","Prove durable private candidate and retained-raw I/O","Prove Evidence Runtime database ACL separation","Prove deployable Evidence Runtime composition","Prove scientific subprocess isolation and cleanup","Prove Phase3 persistence boundary has no Twin runtime or cadence ownership","Upload Phase3 Evidence persistence proof"]
 },
 PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION:{
  run:45963683204,job:140387182029,artifact:15182625900,zip:"09dbd7d80372478c72e90d68ce7d0702f52782415af0578d189f52fa2be34f13",name:"mcft-cap09-phase7-candidate-promotion-composition-",jobName:"candidate-promotion-composition",
  steps:["Checkout exact subject","Require exact stacked predecessor and zero production activation","Typecheck candidate/promotion composition graph","Prove reusable verified retained-raw replay primitive","Run real private candidate to PostgreSQL fenced promotion qualification","Validate composition machine proof","Upload Phase7 candidate/promotion composition proof"]
 }
});
function verifyNativeArtifact({api,git,root,def,id,native,head,now,headTree}){
 const n=NATIVE_ROWS[id];assert(n);
 assert.equal(git("merge-base",NATIVE_SOURCE,head),NATIVE_SOURCE,"CUTOVER_NATIVE_ANCESTRY");
 const nativeAuthority=JSON.parse(git("show",NATIVE_SOURCE+":"+Q));
 assert.deepEqual(def,nativeAuthority.checks.find(x=>x.check_id===id),"CUTOVER_NATIVE_CHECK_DEFINITION_CHANGED:"+id);
 for(const resolver of def.resolver_ids)assert.deepEqual(nativeAuthority.dependency_resolvers[resolver],JSON.parse(git("show",head+":"+Q)).dependency_resolvers[resolver],"CUTOVER_NATIVE_RESOLVER_CHANGED:"+resolver);
 // The only additional change admitted by this evidence route is this
 // verifier itself. Later candidates must explicitly re-evaluate this lease.
 assert.deepEqual(git("diff","--name-only",NATIVE_SOURCE,head).split(/\r?\n/).filter(Boolean),[".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml","scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_ONE_TIME_CUTOVER_V1.cjs"],"CUTOVER_NATIVE_NON_QUALIFICATION_DELTA");
 const helper="apps/server/src/external_evidence/provider/run_scientific_python_v1.ts";
 const depPaths=[...new Set([...def.resolver_ids.flatMap(x=>now.resolved[x].paths),helper,def.execution_workflow])].sort();
 const projection=depPaths.map(p=>{assert(native.has(p)&&native.get(p)===headTree.get(p),"CUTOVER_NATIVE_DEPENDENCY_CHANGED:"+p);return [p,headTree.get(p)];});
 const run=api("actions/runs/"+n.run);
 assert(run.id===n.run&&run.head_sha===NATIVE_SOURCE&&run.run_attempt===1&&run.event==="pull_request"&&run.path===def.execution_workflow&&run.status==="completed"&&run.conclusion==="success","CUTOVER_NATIVE_RUN:"+id);
 const job=api("actions/runs/"+n.run+"/attempts/1/jobs?per_page=100").jobs.find(x=>x.id===n.job);
 assert(job&&job.name===n.jobName&&job.conclusion==="success","CUTOVER_NATIVE_JOB:"+id);
 for(const name of n.steps)assert(job.steps.some(x=>x.name===name&&x.conclusion==="success"),"CUTOVER_NATIVE_STEP:"+id+":"+name);
 const art=api("actions/artifacts/"+n.artifact);
 assert(art.id===n.artifact&&!art.expired&&art.digest==="sha256:"+n.zip&&art.name===n.name+NATIVE_SOURCE&&art.workflow_run.id===n.run&&art.workflow_run.head_sha===NATIVE_SOURCE,"CUTOVER_NATIVE_ARTIFACT:"+id);
 assert(Date.parse(job.started_at)<=Date.parse(art.created_at)&&Date.parse(art.created_at)<=Date.parse(job.completed_at),"CUTOVER_NATIVE_ARTIFACT_TIME:"+id);
 const zip=api("actions/artifacts/"+n.artifact+"/zip",true);assert.equal(sha(zip),n.zip,"CUTOVER_NATIVE_ZIP:"+id);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-native-source-"));let receipts=[];
 try{
  const file=path.join(dir,"proof.zip");fs.writeFileSync(file,zip);
  const names=cp.execFileSync("unzip",["-Z1",file],{encoding:"utf8",timeout:10000}).trim().split(/\r?\n/);
  assert.equal(names.length,{PHASE2_EVIDENCE_PROVIDER_MODULES:4,PHASE3_EVIDENCE_RUNTIME_FOUNDATION:20,PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION:2}[id]);
  assert.equal(new Set(names).size,names.length);
  const docs={};
  for(const name of names){assert(/^MCFT_CAP_09_[A-Z0-9_]+\.json$/.test(name),"CUTOVER_NATIVE_ZIP_MEMBER");const raw=cp.execFileSync("unzip",["-p",file,name],{timeout:10000,maxBuffer:1024*1024});const d=JSON.parse(raw.toString("utf8"));assert.equal(d.status,"PASS","CUTOVER_NATIVE_MACHINE_STATUS:"+name);docs[name]=d;receipts.push({name,sha256:sha(raw)});}
  if(id==="PHASE2_EVIDENCE_PROVIDER_MODULES"){
   const d=docs["MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1_RESULT.json"];
   assert(d&&d.candidate_sha===NATIVE_SOURCE&&d.governed_base_sha===BASE&&d.later_provider_evolution_requalified_by_current_workflow===true&&d.formal_database_mutation===false&&d.formal_v5_armed===false);
   const k=docs["MCFT_CAP_09_KBS_RAW_HOURLY_PRODUCT_ADAPTER_V1_RESULT.json"];
   assert(k&&k.exact_t_decode_proved===true&&k.rainfall_evidence_draft_proved===true&&k.historical_et0_evidence_draft_proved===true&&k.formal_v5_armed===false);
  }else if(id==="PHASE3_EVIDENCE_RUNTIME_FOUNDATION"){
   for(const name of ["MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_PERSISTENCE_V1_RESULT.json","MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_ACL_V1_RESULT.json","MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_COMPOSITION_V1_RESULT.json","MCFT_CAP_09_PHASE3_GFS_RAW_BUNDLE_COMPOSER_V1_RESULT.json"])assert(docs[name]&&docs[name].formal_v5_armed===false);
  }else{
   const d=docs["MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1_RESULT.json"];
   assert(d&&d.subject_sha===NATIVE_SOURCE&&d.real_postgres_fenced_promotion===true&&d.exact_three_facts_single_fenced_transaction===true&&d.promotion_did_not_advance_cursor===true&&d.cursor_advanced_only_after_attestation===true&&d.production_owner_activation===false&&d.formal_v5_armed===false&&d.o00_started===false);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 return {native_source_subject:NATIVE_SOURCE,native_run:n.run,native_job:n.job,native_artifact:n.artifact,native_zip_sha256:n.zip,machine_receipts:receipts,dependency_count:projection.length,dependency_projection_sha256:sha(Buffer.from(JSON.stringify(projection))),native_source_projection_exact:true,historical_digest_reused:false};
}
const AFFECTED=new Set(["CAP09_R4285_HOST_EXACT_SOURCE_ADMISSION_V1","CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1",CURRENT]);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");

function auditAm19SourcePartition({root,head,git,catalog,planner,now,headTree}){
 const t0="18fa562804124f69f5a64f0fa549bdf69c656ea3",contractPath="scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json";
 const historic=catalog(t0),contract=JSON.parse(git("show",t0+":"+contractPath)),current=JSON.parse(git("show",head+":"+contractPath));
 assert.deepEqual(current,contract,"CUTOVER_AM19_HISTORICAL_CONTRACT_CHANGED");
 assert.equal(contract.github_actions_execution,"FORBIDDEN");
 assert.equal(contract.historical_producer_subject_sha,"91d2f518efc5c4c7796c398dabd12801949a9289");
 const controlled=[contract.historical_runner_ref,contract.controlled_adapter_ref,contract.persistence_free_ref];
 const original=[contract.rehydration_source_ref];
 const historicalControl=[contractPath,contract.rehydration_ref,contract.historical_logical_epoch_descriptor_ref,contract.rehydration_host_compatibility_bridge_ref,contract.qualification_runner_ref,contract.database_provisioner_ref,contract.successor_profile_ref,contract.reconciliation_verifier_ref,contract.successor_preflight_ref,contract.design_reconciliation_binding_ref,contract.crop_preflight_ref,contract.historical_crop_preflight_source_ref].filter(Boolean);
 const scientific=["apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py","apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py","apps/server/src/external_evidence/provider/run_scientific_python_v1.ts"];
 const oldRoot=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-am19-partition-"));
 let added=false;
 const compare=(a,b,extra=[])=>{
  const ap=[...new Set([...a.paths,...extra])].sort(),bp=[...new Set([...b.paths,...extra])].sort();
  const projection=bp.map(p=>[p,headTree.get(p)??null]);
  return {historical_count:ap.length,current_count:bp.length,missing_historical:a.missing,missing_current:b.missing,added:bp.filter(p=>!ap.includes(p)),removed:ap.filter(p=>!bp.includes(p)),changed:bp.filter(p=>historic.get(p)!==headTree.get(p)),current_projection_sha256:sha(Buffer.from(JSON.stringify(projection)))};
 };
 try{
  git("worktree","add","--detach",oldRoot,t0);added=true;
  assert.equal(cp.execFileSync("git",["rev-parse","HEAD"],{cwd:oldRoot,encoding:"utf8"}).trim(),t0);
  const control=compare(planner.buildImportClosure(oldRoot,controlled),planner.buildImportClosure(root,controlled));
  const rehydration=compare(planner.buildImportClosure(oldRoot,original),planner.buildImportClosure(root,original),scientific);
  const historicalControlChanged=historicalControl.filter(p=>!historic.has(p)||historic.get(p)!==headTree.get(p));
  const full=now.resolved.LEGACY_AM19_PERSISTENT_24T.paths;
  const producerTree=catalog(contract.historical_producer_subject_sha);
  const producerRefs=[contract.rehydration_source_ref,contract.rehydration_provider_helper_ref,contract.rehydration_ea4_dependency_ref,"apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.ts","apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py"];
  return {status:"DEPENDENCY_PARTITION_REVIEW_ONLY",historical_t0_subject:t0,current_subject:head,controlled_persistent_partition:control,current_ordinary_rehydration_partition:rehydration,full_qcp_changed:full.filter(p=>historic.get(p)!==headTree.get(p)),historical_control_changed:historicalControlChanged,historical_producer_subject:contract.historical_producer_subject_sha,historical_producer_source_entries:producerRefs.map(p=>[p,producerTree.get(p)??null]),historical_rehydration_execution:"DETACHED_PINNED_PRODUCER_WORKTREE",github_historical_execution_authorized:false,current_source_persistent_24t_executed:false,qualification_pass:false};
 }finally{if(added)git("worktree","remove","--force",oldRoot);else fs.rmdirSync(oldRoot);}
}

function verify({ROOT:root,args,authority,plan,changed,stage}){
 let am19Partition=null;
 const git=(...a)=>cp.execFileSync("git",a,{cwd:root,encoding:"utf8",timeout:60000,maxBuffer:32*1024*1024}).trim();
 const bytes=(ref,p)=>cp.execFileSync("git",["show",ref+":"+p],{cwd:root,timeout:60000,maxBuffer:32*1024*1024});
 const api=(p,binary=false)=>{const b=cp.execFileSync("gh",["api","repos/"+REPO+"/"+p],{cwd:root,timeout:90000,maxBuffer:32*1024*1024});return binary?b:JSON.parse(b);};
 const sameMain=()=>assert.equal(api("git/ref/heads/main").object.sha,BASE,"CUTOVER_MAIN_CHANGED");
 const catalog=ref=>new Map(git("ls-tree","-r","-z",ref).split("\0").filter(Boolean).map(line=>{const i=line.indexOf("\t");assert(i>0);return [line.slice(i+1),line.slice(0,i)];}));
 try{
  assert.equal(process.version,"v20.20.2");assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");assert.equal(args.base,BASE);
  assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8")),ep=event.pull_request;
  assert.equal(event.repository?.full_name,REPO);assert(Number.isSafeInteger(ep?.number)&&ep.number>0);assert.equal(ep.base.ref,"main");assert.equal(ep.base.sha,BASE);assert.equal(ep.head.sha,args.head);assert.equal(ep.head.ref,BRANCH);assert.equal(ep.head.repo.full_name,REPO);
  const live=api("pulls/"+ep.number);assert(live.state==="open"&&!live.merged&&live.head.sha===args.head&&live.base.sha===BASE&&live.head.ref===BRANCH&&live.head.repo.full_name===REPO,"CUTOVER_CURRENT_PR_ID");
  sameMain();assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",BASE,args.head),BASE);assert.equal(git("merge-base",C6D,BASE),C6D);
  assert.equal(git("diff","--name-only"),"");assert.equal(git("diff","--cached","--name-only"),"");
  assert.deepEqual(git("diff","--name-only",BASE,args.head).split(/\r?\n/).filter(Boolean).sort(),PATHS,"CUTOVER_EXACT_DELTA");assert.deepEqual([...changed].sort(),PATHS);
  assert.equal(plan.status,"PASS");for(const k of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[k],[]);
  assert(plan.decisions.every(x=>!["UNKNOWN","FORBIDDEN"].includes(x.status)),"CUTOVER_PLAN_UNRESOLVED");
  const old=JSON.parse(bytes(C6D,Q)),baseQ=JSON.parse(bytes(BASE,Q)),next=structuredClone(old);
  assert.deepEqual(baseQ,old,"CUTOVER_PRODUCT_QCP_CHANGED");assert.equal(old.checks.length,74);assert.equal(old.checks[73].check_id,CURRENT);
  next.dependency_resolvers[RESOLVER]={kind:"EXACT_PATH_SET",paths:[...PATHS]};next.checks[73].resolver_ids.push(RESOLVER);next.checks[73].requalification_triggers.push(RESOLVER);
  assert.deepEqual(authority,next,"CUTOVER_EXACT_QCP_EXTENSION");
  const pre="scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs";
  assert.equal(bytes(args.head,pre).toString("utf8").replace("  // BEGIN ONE_TIME_R4285_CUTOVER_PROOF\n  const cutoverModule=stage===\"SUCCESSOR_SUBJECT_PRE_MERGE\"&&args.base===\"8facaba79eaf42d9b9c854c091ae3a7319d455f8\"&&process.env.GITHUB_HEAD_REF===\"mcft/r4285-one-time-physical-cutover-20261127\"\n    ? require(\"./VERIFY_MCFT_CAP09_R4285_ONE_TIME_CUTOVER_V1.cjs\"):null;\n  const cutoverProof=cutoverModule?cutoverModule.verify({ROOT,args,authority,plan,changed,stage}):null;\n  // END ONE_TIME_R4285_CUTOVER_PROOF\n","").replace("    // BEGIN ONE_TIME_R4285_CUTOVER_ROUTE\n    if(cutoverProof&&cutoverModule.SCOPED.includes(decision.check_id)&&!cutoverProof.native_checks?.includes(decision.check_id)){\n      const row=cutoverProof.rows?.[decision.check_id];const ok=cutoverProof.status===\"PASS\"&&!!row;\n      result=ok?row:{check_id:decision.check_id,applicability:decision.status,status:\"FAIL\",reason_code:cutoverProof.reason_code,current_source:cutoverProof,permit_consumed:false,stages:0};\n      if(!ok)blockers.push({blocker_class:\"ONE_TIME_R4285_EXACT_SOURCE_HOLD\",check_id:decision.check_id,detail:cutoverProof});\n      results.push(result);continue;\n    }\n    // END ONE_TIME_R4285_CUTOVER_ROUTE\n",""),bytes(BASE,pre).toString("utf8"),"CUTOVER_OTHER_PREFLIGHT_CHANGE");
  for(const f of [".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"]){
   if(f===".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml"){assert.equal(git("rev-parse",args.head+":"+f),CURRENT_V13_WORKFLOW_BLOB,"CUTOVER_CURRENT_V13_WORKFLOW_CHANGED");continue;}
   assert.equal(bytes(args.head,f).toString("utf8").split(" || (github.event.pull_request.base.sha == '8facaba79eaf42d9b9c854c091ae3a7319d455f8' && github.head_ref == 'mcft/r4285-one-time-physical-cutover-20261127' && github.event.pull_request.head.repo.full_name == github.repository)").join("").split(" || { [ \"${{ github.event.pull_request.base.sha }}\" = \"8facaba79eaf42d9b9c854c091ae3a7319d455f8\" ] && [ \"${{ github.head_ref }}\" = \"mcft/r4285-one-time-physical-cutover-20261127\" ] && [ \"${{ github.event.pull_request.head.repo.full_name }}\" = \"${{ github.repository }}\" ]; }").join(""),bytes(BASE,f).toString("utf8"),"CUTOVER_OTHER_WORKFLOW_CHANGE:"+f);
  }
  // Native historical evidence; the historical Subject is not represented as current main.
  const pr=api("pulls/"+PRIOR.pr),merge=api("git/commits/"+C6D),source=api("git/commits/"+PRIOR.head);
  assert(pr.merged===true&&pr.state==="closed"&&pr.merge_commit_sha===C6D&&pr.base.sha===PRIOR.base&&pr.head.sha===PRIOR.head&&pr.head.repo.full_name===REPO,"CUTOVER_PRIOR_PR");
  assert.deepEqual(merge.parents.map(x=>x.sha),[PRIOR.base,PRIOR.head]);assert.equal(merge.tree.sha,source.tree.sha);
  for(const [id,name,file] of [[PRIOR.qcp,"mcft-cap-09-qualification-control-plane-v1",".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml"],[PRIOR.ci,"ci",".github/workflows/ci.yml"]]){
   const r=api("actions/runs/"+id);
   assert(r.id===id&&r.head_sha===PRIOR.head&&r.run_attempt===1&&r.name===name&&r.path===file&&r.event==="pull_request"&&r.status==="completed"&&r.conclusion==="success","CUTOVER_PRIOR_NATIVE_RUN");
   assert(Array.isArray(r.pull_requests)&&(!r.pull_requests.length||r.pull_requests.some(x=>x.number===PRIOR.pr)));
  }
  const job=api("actions/runs/"+PRIOR.qcp+"/attempts/1/jobs?per_page=100").jobs.find(x=>x.id===PRIOR.job);
  assert(job?.name==="applicability-and-blocker-inventory"&&job.conclusion==="success","CUTOVER_PRIOR_QCP_JOB");
  const art=api("actions/artifacts/"+PRIOR.artifact);
  assert(!art.expired&&art.name==="mcft-cap09-qualification-control-plane-"+PRIOR.head&&art.workflow_run.id===PRIOR.qcp&&art.workflow_run.head_sha===PRIOR.head&&art.digest==="sha256:"+PRIOR.zip,"CUTOVER_PRIOR_ARTIFACT");
  assert(Date.parse(job.started_at)<=Date.parse(art.created_at)&&Date.parse(art.created_at)<=Date.parse(job.completed_at),"CUTOVER_PRIOR_ARTIFACT_TIME");
  const zip=api("actions/artifacts/"+PRIOR.artifact+"/zip",true);assert.equal(sha(zip),PRIOR.zip);
  const raw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw(zip),machine=JSON.parse(raw.toString("utf8").replace(/^\uFEFF/,""));
  require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs").checkQcp74(machine,old,PRIOR.head,PRIOR.base);
  const priorRows=new Map(machine.results.map(x=>[x.check_id,x]));
  const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"),previousRoot=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-cutover-prior-"));
  let before,added=false;
  try{
   git("worktree","add","--detach",previousRoot,C6D);added=true;
   before=require(path.join(previousRoot,"scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs")).resolveDependencyResolvers(previousRoot,old);
  }finally{if(added)git("worktree","remove","--force",previousRoot);else fs.rmdirSync(previousRoot);}
  const now=planner.resolveDependencyResolvers(root,authority);
  assert.deepEqual(before.errors,[],"CUTOVER_PRIOR_RESOLVER_ERRORS");assert.deepEqual(now.errors,[],"CUTOVER_CURRENT_RESOLVER_ERRORS");
  const c6=catalog(C6D),baseTree=catalog(BASE),headTree=catalog(args.head),nativeTree=catalog(NATIVE_SOURCE);
  for(const [p,entry] of Object.entries(reviewedFiles)){
   assert.equal(headTree.get(p),entry,"CUTOVER_REVIEWED_FILE_CHANGED:"+p);
  }
  const changedResolvers = new Map();
  for(const id of Object.keys(old.dependency_resolvers)){
   const b=before.resolved[id].paths,n=now.resolved[id].paths;
   // Only the reviewed new interpreter helper may enter an existing import closure.
   const helper = "apps/server/src/external_evidence/provider/run_scientific_python_v1.ts";
   assert.deepEqual(n.filter(p=>!WIRING.has(p) && (p!==helper || b.includes(p))),b.filter(p=>!WIRING.has(p)),"CUTOVER_RESOLVER_SET_CHANGED:"+id);
   const differences = n.filter(p=>!WIRING.has(p) && c6.get(p)!==headTree.get(p));
   if(differences.length) changedResolvers.set(id,differences);
   for(const p of b){
    assert(c6.has(p)&&baseTree.has(p)&&headTree.has(p),"CUTOVER_DEPENDENCY_MISSING:"+p);
    assert.equal(c6.get(p),baseTree.get(p),"CUTOVER_PRODUCT_DEPENDENCY_CHANGED:"+p);
    if(!WIRING.has(p) && !Object.hasOwn(reviewedFiles,p))assert.equal(c6.get(p),headTree.get(p),"CUTOVER_EXECUTION_DEPENDENCY_CHANGED:"+p);
   }
  }
  am19Partition=auditAm19SourcePartition({root,head:args.head,git,catalog,planner,now,headTree});
  console.log("R4285_AM19_PARTITION_REVIEW="+JSON.stringify(am19Partition));
  const nativeJob=api("actions/runs/"+process.env.GITHUB_RUN_ID+"/jobs?per_page=100").jobs.find(x=>x.name==="applicability-and-blocker-inventory");
  for(const n of ["Prove central applicability semantics","Prove generation, durable-anchor, and dependency-digest semantics","Resolve immutable qualification evidence references","Attest exact QCP source identity after historical diagnostics"])
   assert(nativeJob?.steps.some(s=>s.name===n&&s.conclusion==="success"),"CUTOVER_CONTROL_STEP:"+n);
  const tests=[];for(const [f,extra] of [
   ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_FORMAL_BUDGET_V4.test.cjs",[]],
   ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs",[]],
   ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs",[]],
   ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_V2_PERMIT_WINDOW.test.cjs",[]],
   ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_WINDOWS_HOST_V1.test.cjs",["--test-name-pattern","Host accepts|Host rejects|no incomplete|run and nonce|original scientific stages retain|Windows Host refuses|expired static|forged Stage Ticket"]]
  ]){
   const r=cp.spawnSync(process.execPath,["--test",...extra,f],{cwd:root,encoding:"utf8",timeout:150000,maxBuffer:8*1024*1024});
   assert.equal(r.status,0,"CUTOVER_CURRENT_TEST:"+f+":"+String(r.stdout||"").slice(-1200));tests.push({file:f,exit_code:r.status,stdout_sha256:sha(Buffer.from(r.stdout||""))});
  }
  const rows={},nativeChecks=[];
  for(const id of SCOPED){
   const def=authority.checks.find(x=>x.check_id===id),decision=plan.decisions.find(x=>x.check_id===id),previous=priorRows.get(id);
   assert(def&&decision&&previous&&["PASS","NOT_APPLICABLE"].includes(previous.status),"CUTOVER_PRIOR_ROW:"+id);
   const deps=[...new Set(def.resolver_ids.flatMap(r=>now.resolved[r].paths))].sort();
   const changedRuntime = [...new Set(def.resolver_ids.flatMap(r=>changedResolvers.get(r) || []))].sort();
   if(Object.hasOwn(NATIVE_ROWS,id)){
    const proof=verifyNativeArtifact({api,git,root,def,id,native:nativeTree,head:args.head,now,headTree});
    rows[id]={check_id:id,applicability:decision.status,status:"PASS",reason_code:"CURRENT_ISOLATION_SOURCE_NATIVE_PROOF_EXACT_DEPENDENCY_SUCCESSOR",source_base:BASE,source_head:args.head,dependency_digest:decision.dependency_digest,...proof,historical_qualification_reissued:false,signatures_transferred:false,permit_consumed:false,host_started:false,formal_six_stages:0};
    continue;
   }
   if(id===DA9_REVIEW){
    assert.equal(previous.status,"PASS","CUTOVER_DA9_PRIOR_REVIEW_REQUIRED");
    assert.equal(changedRuntime.length,0,"CUTOVER_DA9_OWN_SCOPE_CHANGED");
    const historical=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-da9-historical-"));let added=false,output;
    try{
     git("worktree","add","--detach",historical,C6D);added=true;
     assert.equal(cp.execFileSync("git",["rev-parse","HEAD"],{cwd:historical,encoding:"utf8"}).trim(),C6D);
     const rel="scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_SIGNED_V2_QCP_TECHNICAL_ENROLLMENT_V1.cjs";
     const exec=cp.spawnSync(process.execPath,[rel],{cwd:historical,encoding:"utf8",timeout:150000,maxBuffer:8*1024*1024});
     assert.equal(exec.status,0,"CUTOVER_DA9_HISTORICAL_REVIEW:"+String(exec.stderr||"").slice(-700));
     output=JSON.parse(String(exec.stdout).trim());
     assert(output.status==="PASS_CTO_TECHNICAL_SUCCESSOR_QCP_REGISTRATION_ONLY"&&output.negative_tests_pass===10&&output.old_frozen_gate_still_fails===true&&output.formal_qcp_qualified===false&&output.permit===false&&output.production===false);
    }finally{if(added)git("worktree","remove","--force",historical);else fs.rmdirSync(historical);}
    rows[id]={check_id:id,applicability:decision.status,status:"PASS",reason_code:"HISTORICAL_DA9_TECHNICAL_REVIEW_RECOMPUTED_IN_ACCEPTED_94_108_SCOPE_ONLY",source_base:BASE,source_head:args.head,historical_review_subject:C6D,dependency_digest:decision.dependency_digest,historical_review:output,current_frozen_runtime_qualified:false,historical_qualification_reissued:false,signatures_transferred:false,permit_consumed:false,host_started:false,formal_six_stages:0};
    continue;
   }
   if(changedRuntime.length){
    nativeChecks.push(id);
    continue;
   }
   const projection=deps.filter(p=>!WIRING.has(p)).map(p=>{assert(headTree.has(p));return [p,headTree.get(p)];});
   rows[id]={check_id:id,applicability:decision.status,status:AFFECTED.has(id)?"PASS":"NOT_APPLICABLE",
    reason_code:AFFECTED.has(id)?"CURRENT_EXACT_CUTOVER_SOURCE_CONTRACT_PASS":"UNCHANGED_HISTORICAL_DEPENDENCY_PROJECTION_NO_REISSUE",
    source_base:BASE,source_head:args.head,prior_subject:C6D,prior_qcp_run:PRIOR.qcp,
    prior_status:previous.status,dependency_count:projection.length,dependency_projection_sha256:sha(Buffer.from(JSON.stringify(projection))),
    qualification_wiring_delta:deps.filter(p=>WIRING.has(p)&&c6.get(p)!==headTree.get(p)),
    tests:AFFECTED.has(id)?tests:[],historical_qualification_reissued:false,signatures_transferred:false,permit_consumed:false,host_started:false,formal_six_stages:0};
  }
  sameMain();assert.equal(git("diff","--name-only"),"");assert.equal(git("diff","--cached","--name-only"),"");
  return {status:"PASS",rows,native_checks:nativeChecks,am19_partition_review:am19Partition,source_head_sha:args.head,base_sha:BASE,source_only:true,physical_stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_ONE_TIME_R4285_EXACT_SOURCE",detail:String(e.message||e).slice(0,2000),am19_partition_review:am19Partition,permit_consumed:false,physical_stages:0};}
}
module.exports={BASE,BRANCH,SCOPED,PATHS,verify};
