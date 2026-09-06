#!/usr/bin/env node
"use strict";
const cp=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const OLD_BASE="e1f8b078bb8459ecb9a77d1fad0d95f4bf143221";
const NEW_BASE="f41dde8d44de95e71748e756e048e0166c1916b7";
const OLD_CANDIDATE_HEAD="0d1c194c44e428ac7af88c44c8125903a2bedce3";
const OLD_QUALIFIED_SUBJECT="93d08e4003370221218471e53a58ad356c34e3b9";
const REPLAYED_QUALIFIED_SUBJECT="9d99ba7832b37651c48c750299587953b210ea2d";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const PLANNER="scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs";
const ARTIFACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PROTECTED-MAIN-LINEAGE-ADVANCEMENT-E1F8-TO-F41D-V1.json";
const PERSISTED_ARTIFACT_BLOB="a4cc74c9927896994d059b3b3716d5602b5bc58c";
const EXPECTED_MERGES=[{"pr":3515,"sha":"ead9d0f0f1c787d75588b4970dd9d315fe28f1fb"},{"pr":3516,"sha":"0267c224d5c0c0524997b724b89cbe03d4e8b299"},{"pr":3517,"sha":"bf5bd1dda29d8fef2ddc21dc758c2126077bf98b"},{"pr":3518,"sha":"f41dde8d44de95e71748e756e048e0166c1916b7"}];
const EXPECTED_CHANGED=[".github/workflows/adr-geox-one-shot-shadow-observer.yml",".github/workflows/adr-geox-postgres-transaction-guarded-shadow.yml",".github/workflows/adr-real-geox-postgres-readonly-shadow-qualification.yml",".github/workflows/adr-real-geox-readonly-shadow-adoption.yml","apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts","scripts/adr_adoption/geox_adr_one_shot_shadow_observer_v1.mjs","scripts/adr_adoption/qualified-consumer-source.v1.json","scripts/adr_adoption/qualify_geox_adr_one_shot_shadow_observer_v1.mjs","scripts/adr_adoption/real_geox_postgres_readonly_shadow_qualification_v1.mjs","scripts/adr_adoption/real_geox_postgres_transaction_guarded_shadow_v1.mjs","scripts/adr_adoption/real_geox_readonly_shadow_adoption_v1.mjs"];

function run(file,args,opts={}){
  const r=cp.spawnSync(file,args,{cwd:opts.cwd||ROOT,encoding:opts.encoding===null?null:"utf8",input:opts.input,stdio:["pipe","pipe","pipe"],windowsHide:true,env:process.env,maxBuffer:128*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0&&!opts.allowFailure){const e=new Error("COMMAND_FAILED:"+file+" "+args.join(" ")+":exit="+r.status);e.stdout=r.stdout||"";e.stderr=r.stderr||"";throw e;}
  return r;
}
function text(file,args,opts={}){return String(run(file,args,opts).stdout||"").trim();}
function sha256(data){return "sha256:"+crypto.createHash("sha256").update(data).digest("hex");}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function diffNames(a,b){const o=text("git",["diff","--name-only",a+".."+b]);return o?o.split(/\r?\n/).filter(Boolean).sort():[];}
function subject(sha){return text("git",["show","-s","--format=%s",sha]);}
function gitShow(sha,rel){return run("git",["show",sha+":"+rel]).stdout;}
function patchId(sha){const patch=run("git",["show","--pretty=format:","--binary",sha],{encoding:null}).stdout;const out=run("git",["patch-id","--stable"],{input:patch,encoding:null}).stdout;return Buffer.from(out||Buffer.alloc(0)).toString("utf8").trim().split(/\s+/)[0]||null;}
function isSha(value){return /^[0-9a-f]{40}$/.test(String(value||""));}

function coreProof(wt){
  const first=text("git",["rev-list","--first-parent","--reverse",OLD_BASE+".."+NEW_BASE]).split(/\r?\n/).filter(Boolean);
  if(!same(first,EXPECTED_MERGES.map(x=>x.sha))) throw new Error("LINEAGE_FIRST_PARENT_MISMATCH");

  const mergeRows=[]; let prev=OLD_BASE;
  for(const row of EXPECTED_MERGES){
    const msg=text("git",["show","-s","--format=%B",row.sha]);
    if(!msg.includes("Merge pull request #"+row.pr)) throw new Error("LINEAGE_MERGE_PR_ID_MISMATCH:"+row.pr);
    mergeRows.push({pr_number:row.pr,merge_sha:row.sha,previous_first_parent_sha:prev,commit_subject:subject(row.sha),changed_paths:diffNames(prev,row.sha)});
    prev=row.sha;
  }

  const changed=diffNames(OLD_BASE,NEW_BASE);
  if(!same(changed,EXPECTED_CHANGED)) throw new Error("LINEAGE_EXTERNAL_CHANGED_PATH_SET_MISMATCH");

  const qOld=gitShow(OLD_BASE,QCP),qNew=gitShow(NEW_BASE,QCP);
  if(qOld!==qNew) throw new Error("LINEAGE_QCP_BYTES_CHANGED");
  const pOld=gitShow(OLD_BASE,PLANNER),pNew=gitShow(NEW_BASE,PLANNER);
  if(pOld!==pNew) throw new Error("LINEAGE_PLANNER_BYTES_CHANGED");

  const authority=JSON.parse(qNew);
  const planner=require(path.join(wt,PLANNER));
  const rr=planner.resolveDependencyResolvers(wt,authority);
  if(rr.errors.length) throw new Error("LINEAGE_RESOLVER_MATERIALIZATION_ERRORS:"+JSON.stringify(rr.errors));

  const cpPaths=new Set(rr.resolved.CONTROL_PLANE_FILES?.paths||[]);
  const allOwned=new Set(Object.values(rr.resolved).flatMap(x=>x.paths||[]));
  const refs=new Set((authority.checks||[]).flatMap(x=>x.authority_refs||[]));
  const cpI=changed.filter(x=>cpPaths.has(x));
  const refI=changed.filter(x=>refs.has(x));
  const depI=changed.filter(x=>allOwned.has(x));
  if(cpI.length||refI.length||depI.length) throw new Error("LINEAGE_MCFT_INTERSECTION:"+JSON.stringify({cpI,refI,depI}));

  const rows=[],changes=[];
  for(const [id,resolved] of Object.entries(rr.resolved).sort(([a],[b])=>a.localeCompare(b))){
    const spec=authority.dependency_resolvers[id];
    const defOld=sha256(Buffer.from(JSON.stringify(spec),"utf8"));
    const defNew=sha256(Buffer.from(JSON.stringify(spec),"utf8"));
    const dOld=planner.dependencyDigestForPaths(wt,OLD_BASE,resolved.paths,false);
    const dNew=planner.dependencyDigestForPaths(wt,NEW_BASE,resolved.paths,false);
    if(dOld.missing.length||dNew.missing.length) throw new Error("LINEAGE_RESOLVER_DIGEST_MISSING:"+id);
    const match=defOld===defNew&&dOld.digest===dNew.digest&&dOld.path_count===dNew.path_count;
    if(!match) changes.push({resolver_id:id,old_definition_digest:defOld,new_definition_digest:defNew,old_dependency_digest:dOld.digest,new_dependency_digest:dNew.digest,old_path_count:dOld.path_count,new_path_count:dNew.path_count});
    rows.push({resolver_id:id,kind:resolved.kind,path_count:resolved.paths.length,definition_digest_old:defOld,definition_digest_new:defNew,dependency_digest_old:dOld.digest,dependency_digest_new:dNew.digest,digest_match:match});
  }
  if(changes.length) throw new Error("LINEAGE_MCFT_RESOLVER_DIGEST_CHANGE:"+JSON.stringify(changes));

  return {
    schema_version:"geox_mcft_cap09_protected_main_lineage_advancement_adjudication_v1",
    status:"PASS",
    previous_mcft_base:OLD_BASE,
    current_protected_main:NEW_BASE,
    previous_base_is_ancestor_of_current_main:true,
    exact_first_parent_advancement:mergeRows,
    exact_merge_shas:EXPECTED_MERGES.map(x=>x.sha),
    external_owner:"ADR",
    ownership_provenance_basis:"CTO_AUTHORIZED_EXACT_MERGE_LINEAGE_PLUS_EXACT_CHANGED_PATH_SET",
    changed_path_count:changed.length,
    changed_paths:changed,
    mcft_control_plane_path_intersection:cpI,
    mcft_authority_artifact_path_intersection:refI,
    mcft_runtime_dependency_closure_intersection:depI,
    qcp_bytes_sha256_old:sha256(Buffer.from(qOld,"utf8")),
    qcp_bytes_sha256_new:sha256(Buffer.from(qNew,"utf8")),
    planner_bytes_sha256_old:sha256(Buffer.from(pOld,"utf8")),
    planner_bytes_sha256_new:sha256(Buffer.from(pNew,"utf8")),
    resolver_digest_strategy:planner.DEPENDENCY_DIGEST_STRATEGY,
    resolver_digests:rows,
    mcft_dependency_resolver_digest_changes:changes,
    adjudication:"EXTERNALLY_OWNED_NON_MCFT_APPLICABLE",
    fail_closed_on_dependency_impact:true,
    adr_paths_added_to_mcft_resolvers:false,
    unknown_changed_path_semantics_relaxed:false
  };
}

const liveMain=text("git",["rev-parse","origin/main"]);
const mainDescendsFromAdjudicatedBase=run("git",["merge-base","--is-ancestor",NEW_BASE,liveMain],{allowFailure:true});
if(mainDescendsFromAdjudicatedBase.status!==0) throw new Error("PROTECTED_MAIN_NOT_DESCENDANT_OF_ADJUDICATED_NEW_BASE:"+liveMain);
run("git",["merge-base","--is-ancestor",OLD_BASE,NEW_BASE]);

const artifactPath=path.join(ROOT,ARTIFACT);
const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const artifactBlob=text("git",["rev-parse","HEAD:"+ARTIFACT]);
if(artifactBlob!==PERSISTED_ARTIFACT_BLOB) throw new Error("LINEAGE_PERSISTED_ARTIFACT_BLOB_DRIFT:"+artifactBlob);
if(artifact.schema_version!=="geox_mcft_cap09_protected_main_lineage_advancement_adjudication_v1"||artifact.status!=="PASS") throw new Error("LINEAGE_PERSISTED_ARTIFACT_SCHEMA_OR_STATUS_INVALID");
if(artifact.previous_mcft_base!==OLD_BASE||artifact.current_protected_main!==NEW_BASE) throw new Error("LINEAGE_PERSISTED_ARTIFACT_BASE_IDENTITY_INVALID");
if(artifact.adjudication!=="EXTERNALLY_OWNED_NON_MCFT_APPLICABLE"||artifact.fail_closed_on_dependency_impact!==true||artifact.adr_paths_added_to_mcft_resolvers!==false||artifact.unknown_changed_path_semantics_relaxed!==false) throw new Error("LINEAGE_PERSISTED_ARTIFACT_ADJUDICATION_INVALID");
if(!Array.isArray(artifact.mcft_control_plane_path_intersection)||artifact.mcft_control_plane_path_intersection.length!==0||!Array.isArray(artifact.mcft_authority_artifact_path_intersection)||artifact.mcft_authority_artifact_path_intersection.length!==0||!Array.isArray(artifact.mcft_runtime_dependency_closure_intersection)||artifact.mcft_runtime_dependency_closure_intersection.length!==0||!Array.isArray(artifact.mcft_dependency_resolver_digest_changes)||artifact.mcft_dependency_resolver_digest_changes.length!==0) throw new Error("LINEAGE_PERSISTED_ARTIFACT_MCFT_IMPACT_NONZERO");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"geox-mcft-lineage-"));
const wt=path.join(tmp,"main");
let proof;
try{
  run("git",["worktree","add","--detach",wt,NEW_BASE]);
  proof=coreProof(wt);
}finally{
  run("git",["worktree","remove","--force",wt],{allowFailure:true});
  fs.rmSync(tmp,{recursive:true,force:true});
}

const replay=artifact.candidate_replay;
if(!replay) throw new Error("LINEAGE_REPLAY_ARTIFACT_INVALID");
if(replay.old_candidate_base!==OLD_BASE||replay.old_candidate_head!==OLD_CANDIDATE_HEAD||replay.new_candidate_base!==NEW_BASE) throw new Error("LINEAGE_REPLAY_IDENTITY_INVALID");
if(replay.old_qualified_subject_sha!==OLD_QUALIFIED_SUBJECT||replay.replayed_qualified_subject_sha!==REPLAYED_QUALIFIED_SUBJECT) throw new Error("LINEAGE_REPLAY_QUALIFIED_SUBJECT_IDENTITY_INVALID");
if(replay.replay_commit_count!==8||!Array.isArray(replay.commit_map)||replay.commit_map.length!==8) throw new Error("LINEAGE_REPLAY_COMMIT_COUNT");
if(!isSha(replay.replayed_pre_reconciliation_head)) throw new Error("LINEAGE_REPLAY_HEAD_IDENTITY_INVALID");
const oldShas=new Set(); const newShas=new Set();
for(let i=0;i<replay.commit_map.length;i++){
  const row=replay.commit_map[i]||{};
  if(!isSha(row.old_sha)||!isSha(row.new_sha)||!isSha(row.patch_id)||typeof row.commit_subject!=="string"||!row.commit_subject) throw new Error("LINEAGE_PERSISTED_REPLAY_ROW_INVALID:"+i);
  if(oldShas.has(row.old_sha)||newShas.has(row.new_sha)) throw new Error("LINEAGE_PERSISTED_REPLAY_DUPLICATE_IDENTITY:"+i);
  oldShas.add(row.old_sha); newShas.add(row.new_sha);
}

const newCommits=text("git",["rev-list","--reverse",NEW_BASE+".."+replay.replayed_pre_reconciliation_head]).split(/\r?\n/).filter(Boolean);
if(newCommits.length!==8) throw new Error("LINEAGE_REPLAY_CURRENT_COMMIT_COUNT");
for(let i=0;i<8;i++){
  const persisted=replay.commit_map[i];
  if(newCommits[i]!==persisted.new_sha) throw new Error("LINEAGE_REPLAY_CURRENT_SHA_MISMATCH:"+i);
  if(subject(newCommits[i])!==persisted.commit_subject) throw new Error("LINEAGE_REPLAY_CURRENT_MESSAGE_MISMATCH:"+i);
  if(patchId(newCommits[i])!==persisted.patch_id) throw new Error("LINEAGE_REPLAY_CURRENT_PATCH_ID_MISMATCH:"+i);
}
run("git",["merge-base","--is-ancestor",replay.replayed_pre_reconciliation_head,"HEAD"]);

proof.candidate_replay=replay;
if(!same(proof,artifact)) throw new Error("LINEAGE_PERSISTED_ARTIFACT_MISMATCH");

process.stdout.write(JSON.stringify(proof,null,2)+"\n");