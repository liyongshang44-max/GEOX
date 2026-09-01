#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const CATALOG="docs/architecture/semantic_convergence/GEOX-B09AG-AUTHORITY-OBJECT-CATALOG-V1.json";
const INVENTORY="docs/architecture/semantic_convergence/GEOX-B09AG-RESIDUAL-AUTHORITY-INVENTORY-V1.json";
const OWNERSHIP="docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json";

function fail(msg){ console.error("FAIL "+msg); process.exitCode=1; }
function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function git(args,opts={}){ return cp.execFileSync("git",args,{encoding:"utf8",maxBuffer:64*1024*1024,...opts}); }
function commitExists(sha){
  try { git(["cat-file","-e",sha+"^{commit}"]); return true; } catch { return false; }
}
function show(sha,path){
  try { return git(["show",sha+":"+path]); } catch { return null; }
}
function escapeRe(s){ return s.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&"); }

const catalog=readJson(CATALOG);
const inventory=readJson(INVENTORY);
const ownership=readJson(OWNERSHIP);
const existingProducerPaths=new Set();
for(const semantic of ownership.semantics||[]){
  for(const producer of semantic.registered_producers||[]){
    if(producer.current!==false && String(producer.path||"").trim()){
      existingProducerPaths.add(String(producer.path).trim());
    }
  }
}
const snapshotMap={
  MAIN:catalog.snapshots.protected_main,
  BLINE:catalog.snapshots.bline_authoritative,
  DEERE_PR_3346:catalog.snapshots.active_deere_pr_3346,
};

const semanticSignatures=[];
for(const item of catalog.semantic_objects||[]){
  for(const signature of item.signatures||[]) semanticSignatures.push(String(signature));
}
const semanticRegex=new RegExp(semanticSignatures.map(escapeRe).join("|"),"i");

const highRiskTables=[
  "approval_request_v1","approval_decision_v1","prescription_contract_v1",
  "operation_plan_v1","operation_plan_transition_v1","work_assignment_index_v1",
  "field_memory_v1","roi_ledger_v1","as_executed_v1"
];
const highRiskTableRegex=new RegExp(
  "\\b(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?:public\\.)?(?:"+highRiskTables.map(escapeRe).join("|")+")\\b",
  "i"
);

function plane(path){
  if(/(?:^|\/)__tests__\//.test(path)||/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return "TEST";
  if(path.startsWith("apps/server/src/")||path.startsWith("apps/executor/src/")) return "PRODUCTION";
  if(path.startsWith("apps/server/db/migrations/")) return "MIGRATION";
  if(path.startsWith("packages/contracts/src/")) return "CONTRACT";
  if(path.startsWith(".github/workflows/")) return "WORKFLOW";
  if(path.startsWith("scripts/runtime_acceptance/")||path.startsWith("scripts/governance_acceptance/")) return "ACCEPTANCE";
  return "OTHER";
}

function evidenceFor(path,content){
  const evidence=[];
  if(/INSERT\s+INTO\s+facts\b/i.test(content)||/\binsertFact\s*\(/.test(content)||/\bappendFact\s*\(/.test(content)){
    evidence.push("FACT_WRITER");
  }
  if(highRiskTableRegex.test(content)) evidence.push("HIGH_RISK_TABLE_WRITER");
  if(/\bapp\.(post|put|patch|delete)\s*\(/.test(content)||/\b(post|put|patch|del)\s*\(\s*["']\/api\//.test(content)){
    evidence.push("MUTATING_API_ENTRYPOINT");
  }
  if(path.includes("/jobs/")||/\bsetInterval\s*\(/.test(content)||/\bstart[A-Za-z0-9_]*Worker\b/.test(content)){
    evidence.push("JOB_OR_WORKER_ENTRYPOINT");
  }
  if(/export\s+(?:async\s+)?function\s+(?:build|create|project|derive|compile|run)[A-Za-z0-9_]*/.test(content)){
    evidence.push("SEMANTIC_PRODUCER_TRANSFORM");
  }
  if(path.endsWith(".sql")&&/(CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|INSERT\s+INTO|UPDATE\s+)/i.test(content)){
    evidence.push("SQL_MUTATION_SURFACE");
  }
  if(/process\.env|isFeatureEnabled|FEATURE_FLAG/.test(content)) evidence.push("FEATURE_FLAGGED");
  return evidence;
}

function authorityCapable(path,content){
  if(!semanticRegex.test(content)) return {capable:false,evidence:[]};
  const ev=evidenceFor(path,content);
  const p=plane(path);
  if(p==="PRODUCTION"){
    const directWriter=ev.includes("FACT_WRITER")||ev.includes("HIGH_RISK_TABLE_WRITER");
    const jobWorker=ev.includes("JOB_OR_WORKER_ENTRYPOINT");
    const transform=ev.includes("SEMANTIC_PRODUCER_TRANSFORM");
    const domainServiceOrExecutor=
      path.startsWith("apps/server/src/domain/")||
      path.startsWith("apps/server/src/services/")||
      path.startsWith("apps/server/src/runtime/")||
      path.startsWith("apps/server/src/infra/")||
      path.startsWith("apps/server/src/adapters/")||
      path.startsWith("apps/executor/src/");
    const routeOrProjection=
      path.startsWith("apps/server/src/routes/")||
      path.startsWith("apps/server/src/projections/");
    return {
      capable: directWriter || jobWorker || (transform && domainServiceOrExecutor && !routeOrProjection),
      evidence:ev
    };
  }
  if(p==="MIGRATION"){
    const persistentSqlAuthority=/(CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER)/i.test(content);
    return {
      capable:persistentSqlAuthority,
      evidence:ev.concat(persistentSqlAuthority?["PERSISTENT_SQL_FUNCTION_OR_TRIGGER"]:["MIGRATION_BACKFILL_SUPPORT"])
    };
  }
  if(p==="WORKFLOW"){
    return {capable:false,evidence:ev.concat(["WORKFLOW_SUPPORT_REVIEW"])};
  }
  if(p==="ACCEPTANCE"||p==="TEST"||p==="CONTRACT"){
    return {capable:false,evidence:ev.concat([p+"_SUPPORT_PLANE"])};
  }
  return {capable:false,evidence:ev};
}

const inventoryByPath=new Map();
for(const entry of inventory.entries||[]){
  const p=String(entry.path||"");
  if(!p){ fail("INVENTORY_ENTRY_PATH_MISSING:"+String(entry.id||"UNKNOWN")); continue; }
  if(!inventoryByPath.has(p)) inventoryByPath.set(p,[]);
  inventoryByPath.get(p).push(entry);
  for(const key of [
    "id","snapshot_scope","entrypoints","activation_mode","writes","reads","semantic_family",
    "authority_class","representation","runtime_reachable","downstream_consumers",
    "ownership_registration","finding","risk","removal_target"
  ]){
    if(entry[key]===undefined) fail("INVENTORY_FIELD_MISSING:"+entry.id+":"+key);
  }
}

const discovered=[];
const support=[];
for(const [label,sha] of Object.entries(snapshotMap)){
  if(!commitExists(sha)){
    fail("AUDIT_SNAPSHOT_COMMIT_MISSING:"+label+":"+sha);
    continue;
  }
  const roots=catalog.scan_roots||[];
  let paths=[];
  try {
    if(label==="DEERE_PR_3346"){
      const baseSha=String(catalog.snapshots.active_deere_pr_3346_base||"");
      if(!baseSha||!commitExists(baseSha)){
        fail("AUDIT_SNAPSHOT_BASE_COMMIT_MISSING:"+label+":"+baseSha);
        continue;
      }
      const rootSet=roots;
      paths=git(["diff","--name-only",baseSha+".."+sha,"--",...rootSet])
        .split(/\r?\n/).filter(Boolean);
    } else {
      paths=git(["ls-tree","-r","--name-only",sha,"--",...roots])
        .split(/\r?\n/).filter(Boolean);
    }
  } catch(e) {
    fail("AUDIT_TREE_ENUMERATION_FAILED:"+label+":"+sha);
    continue;
  }

  for(const path of paths){
    if(!/\.(?:ts|tsx|js|cjs|mjs|sql|json|ya?ml)$/.test(path)) continue;
    const content=show(sha,path);
    if(content==null) continue;
    const semanticHit=semanticRegex.test(content)||semanticRegex.test(path);
    if(!semanticHit) continue;
    const assessment=authorityCapable(path,content);
    if(assessment.capable){
      discovered.push({snapshot:label,sha,path,plane:plane(path),evidence:assessment.evidence});
      const candidates=inventoryByPath.get(path)||[];
      const coveredByResidual=candidates.some(entry=>(entry.snapshot_scope||[]).includes(label));
      const coveredByExistingProducer=existingProducerPaths.has(path);
      if(!coveredByResidual && !coveredByExistingProducer){
        fail("UNREGISTERED_AUTHORITY_CAPABLE_PATH:"+label+":"+path+":"+assessment.evidence.join(","));
      } else if(coveredByExistingProducer && !coveredByResidual){
        console.log("B09AG_EXISTING_PRODUCER_COVERAGE "+JSON.stringify({snapshot:label,path}));
      }
    } else if(["WORKFLOW","ACCEPTANCE","CONTRACT","TEST"].includes(plane(path))){
      support.push({snapshot:label,path,plane:plane(path),evidence:assessment.evidence});
    }
  }
}

for(const entry of inventory.entries||[]){
  for(const label of entry.snapshot_scope||[]){
    const sha=snapshotMap[label];
    if(!sha) {
      fail("INVENTORY_UNKNOWN_SNAPSHOT:"+entry.id+":"+label);
      continue;
    }
    if(!commitExists(sha)) continue;
    const content=show(sha,entry.path);
    if(content==null){
      fail("INVENTORY_PATH_MISSING_AT_SNAPSHOT:"+entry.id+":"+label+":"+entry.path);
    }
  }
}

const uniqueDiscovered=[...new Map(discovered.map(x=>[x.snapshot+"::"+x.path,x])).values()]
  .sort((a,b)=>(a.snapshot+"::"+a.path).localeCompare(b.snapshot+"::"+b.path));

console.log("B09AG_SNAPSHOTS "+JSON.stringify(snapshotMap));
console.log("B09AG_AUTHORITY_CAPABLE_DISCOVERED_COUNT "+uniqueDiscovered.length);
for(const row of uniqueDiscovered) console.log("B09AG_DISCOVERED "+JSON.stringify(row));
console.log("B09AG_SUPPORT_REFERENCE_COUNT "+support.length);

if(process.exitCode){
  console.error("B09AG_RESIDUAL_AUTHORITY_AUDIT_FAIL");
}else{
  console.log("B09AG_NO_UNINVENTORIED_AUTHORITY_CAPABLE_PATH_PASS");
  console.log("B09AG_RESIDUAL_AUTHORITY_AUDIT_PASS");
}
