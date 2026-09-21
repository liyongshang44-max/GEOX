#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/GEOX_WHOLE_REPOSITORY_AUDIT_COMPLETENESS_V3.json");
const V2_OUT=path.join(ROOT,"acceptance-output/GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_AUDIT_V2.json");
const MATRIX="docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json";
const BLINE="docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json";
const METHOD="docs/architecture/semantic_convergence/GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-METHOD-V2.json";

const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const json=p=>JSON.parse(read(p));
const exists=p=>fs.existsSync(path.join(ROOT,p));
const rel=p=>path.relative(ROOT,p).split(path.sep).join("/");
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim();

function walk(dir,re){
  const base=path.join(ROOT,dir),out=[];
  if(!fs.existsSync(base)) return out;
  const q=[base];
  while(q.length){
    const d=q.pop();
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      if([".git","node_modules","dist","coverage","acceptance-output",".pnpm-store"].includes(e.name)) continue;
      const p=path.join(d,e.name);
      if(e.isDirectory()) q.push(p);
      else if(!re||re.test(e.name)) out.push(rel(p));
    }
  }
  return out.sort();
}

const codeRoots=["apps","packages","scripts"];
const codeFiles=[...new Set(codeRoots.flatMap(r=>walk(r,/\.(?:ts|tsx|js|jsx|cjs|mjs)$/)))];
const codeSet=new Set(codeFiles);

function resolveLocal(importer,spec){
  if(!spec.startsWith(".")) return null;
  const base=path.posix.normalize(path.posix.join(path.posix.dirname(importer),spec));
  const variants=[];
  const ext=path.posix.extname(base);
  if(ext){
    variants.push(base);
    if(ext===".js"){
      variants.push(base.slice(0,-3)+".ts",base.slice(0,-3)+".tsx",base.slice(0,-3)+".mts",base.slice(0,-3)+".cts");
    }else if(ext===".mjs"){
      variants.push(base.slice(0,-4)+".mts",base.slice(0,-4)+".ts");
    }else if(ext===".cjs"){
      variants.push(base.slice(0,-4)+".cts",base.slice(0,-4)+".ts");
    }
  }else{
    for(const x of [".ts",".tsx",".js",".mjs",".cjs","/index.ts","/index.tsx","/index.js"]) variants.push(base+x);
  }
  return variants.find(v=>codeSet.has(v))||null;
}

function importsFor(file){
  let t="";
  try{t=read(file)}catch{return {resolved:[],unresolved:[]};}
  const specs=[];
  const patterns=[
    /(?:import|export)\s+(?:[^"'\n;]+?\s+from\s+)?["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g
  ];
  for(const re of patterns){
    for(const m of t.matchAll(re)) specs.push(m[1]);
  }
  const resolved=[],unresolved=[];
  for(const spec of specs){
    if(!spec.startsWith(".")) continue;
    const x=resolveLocal(file,spec);
    if(x) resolved.push(x); else unresolved.push({importer:file,specifier:spec});
  }
  return {resolved:[...new Set(resolved)],unresolved};
}

const graph=new Map(),allUnresolved=[];
for(const f of codeFiles){
  const p=importsFor(f);graph.set(f,p.resolved);allUnresolved.push(...p.unresolved);
}

function classifyPackageScript(name,command,pkg){
  const s=(name+" "+command).toLowerCase();
  if(/test|lint|typecheck|build|format|check|acceptance|audit|qualif|replay|fixture|selftest|verify|ci:|generate|gen:|docs|openapi/.test(s)) return "GOVERNANCE_ONLY";
  if(/migrat|bootstrap|seed|schema/.test(s)) return "DATABASE_BOOTSTRAP";
  if(/worker|jobs|daemon/.test(s)) return "BACKGROUND_WORKER";
  if(/start|serve|server|runtime|dev/.test(s)) return "OPERATOR_TRIGGERED";
  return "GOVERNANCE_ONLY";
}
function classifyWorkflow(file,text){
  const n=file.toLowerCase();
  if(/acceptance|audit|qualification|rehearsal|simulator|readback|preflight|gate|qcp|test|ci|requal|evidence|attestation|closure|convergence|check/.test(n)) return "QUALIFICATION";
  if(/^\s*schedule\s*:/m.test(text)||/\n\s*schedule\s*:/m.test(text)) return "PRODUCTION_BATCH";
  if(/production|runtime|scheduler|rolling|capture|materializ|owner/.test(n)) return "PRODUCTION_BATCH";
  return "GOVERNANCE_ONLY";
}
function inferOwner(text,source){
  const s=(source+" "+text).toLowerCase();
  const m=s.match(/mcft[-_]?cap[-_]?0?([0-9])/);
  if(m) return "MCFT-CAP-0"+m[1];
  if(/mcft[-_]?cap[-_]?09|mcft_cap09|mcft-cap-09/.test(s)) return "MCFT-CAP-09";
  if(/apps\/judge|@geox\/judge/.test(s)) return "BLINE-JUDGE";
  if(/apps\/executor|@geox\/executor/.test(s)) return "BLINE-EXECUTOR";
  if(/telemetry-ingest/.test(s)) return "BLINE-TELEMETRY-INGEST";
  if(/apps\/web|@geox\/web/.test(s)) return "PRESENTATION-WEB";
  if(/apps\/server|@geox\/server/.test(s)) return "BLINE-SERVER";
  if(/control-kernel/.test(s)) return "BLINE-CONTROL-KERNEL";
  if(/device-skills/.test(s)) return "BLINE-DEVICE-SKILLS";
  if(/skill-registry/.test(s)) return "BLINE-SKILL-REGISTRY";
  if(/migration|bootstrap|postgres|database/.test(s)) return "DATABASE-PLATFORM";
  return null;
}
function extractSeeds(text,baseDir=""){
  const out=new Set();
  const pathRe=/(?:^|[\s"'\x60(])((?:apps|packages|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|cjs|mjs))/gm;
  for(const m of text.matchAll(pathRe)){
    let f=m[1];
    if(codeSet.has(f)) out.add(f);
    else{
      const candidates=[f.replace(/\.js$/,".ts"),f.replace(/\.js$/,".tsx"),f.replace(/\.mjs$/,".ts"),f.replace(/\.cjs$/,".ts")];
      for(const c of candidates) if(codeSet.has(c)) out.add(c);
    }
  }
  const tokens=text.split(/[\s"'\x60]+/).filter(Boolean);
  for(const tok0 of tokens){
    const tok=tok0.replace(/[;,)]$/,"");
    if(!/\.(?:ts|tsx|js|cjs|mjs)$/.test(tok)||tok.startsWith("-")) continue;
    const candidate=path.posix.normalize(path.posix.join(baseDir,tok));
    if(codeSet.has(candidate)) out.add(candidate);
    else{
      for(const c of [candidate.replace(/\.js$/,".ts"),candidate.replace(/\.js$/,".tsx")]) if(codeSet.has(c)) out.add(c);
    }
  }
  return [...out];
}

const roots=[];
for(const pkg of ["package.json",...walk("apps",/^package\.json$/),...walk("packages",/^package\.json$/)]){
  let p;try{p=json(pkg)}catch{continue;}
  for(const [name,command] of Object.entries(p.scripts||{})){
    const cls=classifyPackageScript(name,String(command),pkg);
    const base=path.posix.dirname(pkg)==="."?"":path.posix.dirname(pkg);
    const seeds=extractSeeds(String(command),base);
    roots.push({
      id:"PACKAGE:"+pkg+":"+name,class:cls,source:pkg,entry:String(command),seeds,
      owner:inferOwner(String(command),pkg),parse_status:seeds.length||cls==="GOVERNANCE_ONLY"||cls==="DATABASE_BOOTSTRAP"?"PARSED_OR_NON_PRODUCT":"UNPARSED"
    });
  }
}
for(const wf of walk(".github/workflows",/\.ya?ml$/)){
  const t=read(wf),cls=classifyWorkflow(wf,t),seeds=extractSeeds(t,"");
  roots.push({
    id:"WORKFLOW:"+wf,class:cls,source:wf,entry:(t.match(/^name:\s*(.+)$/m)||[0,path.basename(wf)])[1].trim(),
    seeds,owner:inferOwner(t,wf),parse_status:seeds.length||cls==="GOVERNANCE_ONLY"||cls==="QUALIFICATION"?"PARSED_OR_NON_PRODUCT":"UNPARSED"
  });
}
for(const compose of fs.readdirSync(ROOT).filter(x=>/^docker-compose.*\.ya?ml$/.test(x)).sort()){
  const t=read(compose),cls=/qualification/i.test(compose)?"QUALIFICATION":/production|commercial/i.test(compose)?"PRODUCTION_ONLINE":"OPERATOR_TRIGGERED";
  const services=[...t.matchAll(/^  ([A-Za-z0-9_.-]+):\s*$/gm)].map(m=>m[1]);
  for(const service of services){
    const seeds=extractSeeds(t,"");
    roots.push({
      id:"COMPOSE:"+compose+":"+service,class:cls,source:compose,entry:service,seeds,
      owner:inferOwner(service+" "+t,compose),parse_status:seeds.length||cls==="QUALIFICATION"?"PARSED_OR_NON_PRODUCT":"UNPARSED"
    });
  }
}
for(const df of walk("docker",/(?:Dockerfile|\.Dockerfile)$/)){
  const t=read(df);
  const cmd=[...t.matchAll(/^\s*(?:CMD|ENTRYPOINT)\s+(.+)$/gmi)].map(m=>m[1]).join(" ");
  if(!cmd) continue;
  const cls=/mcft|runtime|server|executor|judge|telemetry/i.test(df+" "+cmd)?"OPERATOR_TRIGGERED":"GOVERNANCE_ONLY";
  const seeds=extractSeeds(cmd,"");
  roots.push({
    id:"DOCKERFILE:"+df,class:cls,source:df,entry:cmd,seeds,owner:inferOwner(cmd,df),
    parse_status:seeds.length||cls==="GOVERNANCE_ONLY"?"PARSED_OR_NON_PRODUCT":"UNPARSED"
  });
}
// Generated dist entries are explicit executable roots; map the imported source text.
const distWriter="apps/server/scripts/write_dist_entries.cjs";
if(exists(distWriter)){
  const t=read(distWriter);
  const imported=[...t.matchAll(/import\s+["']\.\.\/(apps\/server\/src\/[A-Za-z0-9_./-]+)\.js["']/g)].map(m=>m[1]+".ts").filter(x=>codeSet.has(x));
  for(const seed of imported){
    const cls=/\/qualification\//.test(seed)?"QUALIFICATION":/\/runtime\//.test(seed)?"PRODUCTION_ONLINE":"OPERATOR_TRIGGERED";
    roots.push({
      id:"DIST_IMPORT:"+seed,class:cls,source:distWriter,entry:seed,seeds:[seed],owner:inferOwner(seed,seed),parse_status:"PARSED"
    });
  }
}

const uniqueRoots=[...new Map(roots.map(r=>[r.id,r])).values()];

function traverse(seeds){
  const seen=new Set(),q=[...seeds.filter(x=>codeSet.has(x))];
  while(q.length){
    const f=q.pop();if(seen.has(f)) continue;seen.add(f);
    for(const n of graph.get(f)||[]) if(!seen.has(n)) q.push(n);
  }
  return seen;
}
const rootReach=new Map();
for(const r of uniqueRoots) rootReach.set(r.id,traverse(r.seeds));
const productClasses=new Set(["PRODUCTION_ONLINE","PRODUCTION_BATCH","HTTP_SERVER","BACKGROUND_WORKER","OPERATOR_TRIGGERED"]);
const productReach=new Set();
for(const r of uniqueRoots) if(productClasses.has(r.class)) for(const f of rootReach.get(r.id)||[]) productReach.add(f);
const anyReach=new Set();
for(const r of uniqueRoots) for(const f of rootReach.get(r.id)||[]) anyReach.add(f);

const inv=json(BLINE);
const blineByPath=new Map((inv.surfaces||[]).map(x=>[x.source_path,x]));
const v2=exists("acceptance-output/GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_AUDIT_V2.json")?JSON.parse(fs.readFileSync(V2_OUT,"utf8")):null;
const mRows=new Map((v2?.mandatory_mcft_reconciliation||[]).map(x=>[x.id,x]));

function explicitNonProductRoot(r){return ["QUALIFICATION","GOVERNANCE_ONLY","DATABASE_BOOTSTRAP","HISTORICAL_INACTIVE"].includes(r.class);}
const rootOwnership=uniqueRoots.map(r=>{
  let owner=r.owner;
  if(!owner){
    for(const f of rootReach.get(r.id)||[]){
      const row=blineByPath.get(f);
      if(row){owner="BLINE:"+row.surface_id;break;}
      if(f.includes("/runtime/twin_runtime/")||f.includes("/external_evidence/")){owner="MCFT-CAP-09";break;}
    }
  }
  const explicit_non_product=explicitNonProductRoot(r);
  return {...r,owner:owner||null,explicit_non_product,owned:Boolean(owner)||explicit_non_product};
});
const unownedRoots=rootOwnership.filter(r=>productClasses.has(r.class)&&!r.owned);
const unparsedActiveRoots=rootOwnership.filter(r=>productClasses.has(r.class)&&r.parse_status==="UNPARSED");

function authorityCandidate(file){
  if(/(?:^|\/)(?:__tests__|tests?|fixtures?|acceptance)(?:\/|$)/i.test(file)) return false;
  if(/^scripts\/(?:runtime_acceptance|governance_acceptance)\//.test(file)) return false;
  if(/\.(?:test|spec)\./.test(file)) return false;
  const name=path.posix.basename(file).toLowerCase();
  if(/(?:service|repository|adapter|process|host|worker|runner|writer|dispatcher|approval|recommendation|decision|forecast|state|receipt|execution|scheduler|provider|registry|route|register)/.test(name)) return true;
  if(/\/routes\//.test(file)||/\/jobs\//.test(file)||/\/modules\//.test(file)) return true;
  let t="";try{t=read(file)}catch{return false;}
  return /(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_"'.]+\s+SET|DELETE\s+FROM|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|register[A-Za-z0-9_]*Routes|app\.(?:post|put|patch|delete)\s*\(|commit[A-Z]|persist[A-Z]|dispatch[A-Z])/i.test(t);
}

const candidates=codeFiles.filter(authorityCandidate);
function explicitSourceClass(file){
  if(/\/qualification\//.test(file)) return "QUALIFICATION_ONLY";
  if(/\/historical\//.test(file)||/legacy/i.test(path.posix.basename(file))) return "HISTORICAL_OR_LEGACY";
  if(/^scripts\//.test(file)) return "SCRIPT_NON_PRODUCT";
  return null;
}
const sourceRows=candidates.map(file=>{
  const b=blineByPath.get(file);
  let capability=b?"BLINE:"+b.surface_id:null;
  if(!capability && (file.includes("/runtime/twin_runtime/")||file.includes("/external_evidence/"))) capability="MCFT_RUNTIME_FAMILY";
  if(!capability && file.startsWith("apps/judge/")) capability="BLINE-JUDGE";
  if(!capability && file.startsWith("apps/executor/")) capability="BLINE-EXECUTOR";
  if(!capability && file.startsWith("apps/telemetry-ingest/")) capability="BLINE-TELEMETRY-INGEST";
  const explicit=explicitSourceClass(file);
  const reachable=anyReach.has(file);
  const product_reachable=productReach.has(file);
  return {source_path:file,registered_capability:capability,reachable,product_reachable,explicit_non_product_class:explicit};
});
const orphanSources=sourceRows.filter(x=>!x.reachable&&!x.explicit_non_product_class);
const unregisteredSources=sourceRows.filter(x=>!x.registered_capability&&!x.explicit_non_product_class);

const activeUnresolved=allUnresolved.filter(x=>productReach.has(x.importer));

const matrix=json(MATRIX);
const completeCaps=(matrix.capability_lines||[]).filter(x=>x.complete===true);
const capRows=completeCaps.map(c=>{
  const id=c.capability_line_id;
  let owner=null,root=null,proof=null,disposition=null;
  if(id==="MCFT-CAP-05"){const m=mRows.get("M-01");owner=m?.expected_execution_owner||null;root=m?.expected_execution_root||null;proof=m?.evidence||null;disposition=m?.final_disposition||null;}
  else if(id==="MCFT-CAP-06"){const m=mRows.get("M-04");owner=m?.expected_execution_owner||null;root="CONTROLLED_REPLAY_RUNNERS";proof=m?.evidence||null;disposition=m?.final_disposition||null;}
  else if(id==="MCFT-CAP-07"){const m=mRows.get("M-05");owner=m?.expected_execution_owner||null;root="HTTP_SERVER_OPERATOR_MODULE";proof=m?.evidence||null;disposition=m?.final_disposition||null;}
  else if(id==="MCFT-CAP-08"){const m=mRows.get("M-06");owner=m?.expected_execution_owner||null;root="CONTROLLED_REPLAY_STAGE_1A";proof=m?.evidence||null;disposition=m?.final_disposition||null;}
  else {
    const dir="docs/digital_twin/mcft/"+id.toLowerCase().replace("mcft-cap-","cap_");
    const docs=exists(dir)?walk(dir,/\.(?:json|md)$/):[];
    const runners=[...uniqueRoots].filter(r=>r.owner===id);
    const inbound=sourceRows.filter(x=>x.registered_capability==="MCFT_RUNTIME_FAMILY"&&x.reachable).slice(0,10).map(x=>x.source_path);
    if(runners.length){owner="DISCOVERED_EXECUTION_ROOT";root=runners.map(r=>r.id);proof={runners:runners.map(r=>r.id)};}
    else if(docs.length&&["MCFT-CAP-00","MCFT-CAP-01","MCFT-CAP-02","MCFT-CAP-03","MCFT-CAP-04"].includes(id)){
      owner="EFFECTIVE_PREDECESSOR_CONSUMED_BY_SUCCESSOR_RUNTIME";
      root="SUCCESSOR_RUNTIME_LIBRARY_CONSUMPTION";
      proof={authority_docs:docs.slice(0,20),current_runtime_inbound_sample:inbound};
      disposition=inbound.length?"WIRED_AND_PROVEN":"UNWIRED_DEFECT";
    }
  }
  return {
    capability_id:id,status:c.current_effective_status||c.status||null,
    expected_owner:owner,expected_root:root,runtime_proof:proof,disposition,
    owner_missing:!owner,root_missing:!root,proof_missing:!proof
  };
});
const capGaps=capRows.filter(x=>x.owner_missing||x.root_missing||x.proof_missing);

function operatorIds(file){
  let t="";try{t=read(file)}catch{return [];}
  return [...new Set([...t.matchAll(/POINT_[0-9]+MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1/g)].map(m=>m[0]))];
}
const opUsage=[];
for(const f of candidates){
  const ids=operatorIds(f);if(ids.length) opUsage.push({file:f,ids,reachable:anyReach.has(f)});
}
const families=new Map();
for(const u of opUsage){
  for(const id of u.ids){
    const k=id.replace(/POINT_[0-9]+MM_/,"POINT_{DEPTH}MM_");
    if(!families.has(k))families.set(k,new Map());
    const m=families.get(k);if(!m.has(id))m.set(id,[]);m.get(id).push(u.file);
  }
}
const semanticFamilyConflicts=[...families.entries()].filter(([,m])=>m.size>1).map(([family,m])=>({
  family,variants:[...m.entries()].map(([operator,files])=>({operator,files:[...new Set(files)].sort()}))
}));
const blineSemanticUnchecked=(inv.surfaces||[]).filter(x=>!Array.isArray(x.downstream_consumers)).map(x=>({surface_id:x.surface_id,source_path:x.source_path,reason:"DOWNSTREAM_CONSUMERS_DIMENSION_MISSING"}));

const head=git("rev-parse","HEAD");
const freshBinding={current_head:head,v2_audit_head:v2?.audit_subject?.audit_head||null,exact_match:v2?.audit_subject?.audit_head===head};

const failures=[];
for(const x of unownedRoots) failures.push("UNOWNED_EXECUTION_ROOT:"+x.id);
for(const x of orphanSources) failures.push("ORPHAN_AUTHORITY_CAPABLE_SOURCE:"+x.source_path);
for(const x of capGaps) {
  if(x.owner_missing) failures.push("EXPECTED_OWNER_MISSING:"+x.capability_id);
  if(x.root_missing) failures.push("EXPECTED_ROOT_MISSING:"+x.capability_id);
  if(x.proof_missing) failures.push("RUNTIME_PROOF_REQUIRED_BUT_MISSING:"+x.capability_id);
}
for(const x of activeUnresolved) failures.push("UNRESOLVED_ACTIVE_IMPORT:"+x.importer+":"+x.specifier);
for(const x of unparsedActiveRoots) failures.push("UNPARSED_ACTIVE_ROOT_COMMAND:"+x.id);
for(const x of blineSemanticUnchecked) failures.push("SEMANTIC_EDGE_UNCHECKED:"+x.surface_id);
if(!freshBinding.exact_match) failures.push("STALE_AUDIT_EVIDENCE_SUBJECT");

const result={
  schema_version:"geox_whole_repository_audit_completeness_v3",
  status:failures.length?"FAIL":"PASS",
  subject_sha:head,
  method_ref:METHOD,
  invariants:{
    execution_root_ownership:{status:unownedRoots.length?"FAIL":"PASS",root_count:rootOwnership.length,unowned_count:unownedRoots.length},
    effective_capability_reachability:{status:capGaps.length?"FAIL":"PASS",complete_capability_count:capRows.length,gap_count:capGaps.length},
    semantic_edge_adjudication:{status:blineSemanticUnchecked.length?"FAIL":"PASS",unchecked_declared_edge_count:blineSemanticUnchecked.length,identity_family_conflict_count:semanticFamilyConflicts.length},
    reverse_orphan_discovery:{status:orphanSources.length?"FAIL":"PASS",candidate_source_count:sourceRows.length,orphan_count:orphanSources.length,unregistered_source_count:unregisteredSources.length},
    exact_head_freshness:{status:freshBinding.exact_match?"PASS":"FAIL",...freshBinding},
    graph_parse_completeness:{status:activeUnresolved.length||unparsedActiveRoots.length?"FAIL":"PASS",unresolved_active_import_count:activeUnresolved.length,unparsed_active_root_count:unparsedActiveRoots.length}
  },
  execution_root_ownership_matrix:rootOwnership,
  all_complete_or_effective_capabilities:capRows,
  authority_capable_source_reverse_reachability:sourceRows,
  unowned_execution_roots:unownedRoots,
  orphan_authority_capable_sources:orphanSources,
  unregistered_authority_capable_sources:unregisteredSources,
  capability_reachability_gaps:capGaps,
  unresolved_active_imports:activeUnresolved,
  unparsed_active_root_commands:unparsedActiveRoots,
  semantic_identity_family_conflicts:semanticFamilyConflicts,
  semantic_edge_unchecked:blineSemanticUnchecked,
  fresh_exact_head_evidence_binding:freshBinding,
  failures,
  non_effects:{
    product_semantic_change:false,
    runtime_wiring_change:false,
    production_database_mutation:false,
    rehearsal_resource_use:false,
    formal_store_mutation:false
  }
};

fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");
console.log("WHOLE_REPOSITORY_AUDIT_COMPLETENESS_V3 "+JSON.stringify({
  status:result.status,
  subject_sha:head,
  root_count:rootOwnership.length,
  unowned_execution_roots:unownedRoots.length,
  candidate_sources:sourceRows.length,
  orphan_sources:orphanSources.length,
  unregistered_sources:unregisteredSources.length,
  complete_capabilities:capRows.length,
  capability_gaps:capGaps.length,
  unresolved_active_imports:activeUnresolved.length,
  unparsed_active_roots:unparsedActiveRoots.length,
  semantic_family_conflicts:semanticFamilyConflicts.length,
  semantic_edges_unchecked:blineSemanticUnchecked.length,
  fresh_exact_head:freshBinding.exact_match
}));
for(const f of failures.slice(0,200)) console.log("COMPLETENESS_FAILURE",f);
if(failures.length) process.exitCode=1;
