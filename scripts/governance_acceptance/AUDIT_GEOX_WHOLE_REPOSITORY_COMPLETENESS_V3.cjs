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
const ADJUDICATION="docs/architecture/semantic_convergence/GEOX-WHOLE-REPOSITORY-REVERSE-DISCOVERY-ADJUDICATION-V1.json";

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
  if(file==="apps/server/scripts/write_dist_entries.cjs") return {resolved:[],unresolved:[]};
  let t="";
  try{t=read(file)}catch{return {resolved:[],unresolved:[]};}
  const specs=[];
  const patterns=[
    /(?:import|export)\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g
  ];
  for(const re of patterns){
    for(const m of t.matchAll(re)) specs.push(m[1]);
  }
  const resolved=[],unresolved=[];
  for(const spec of specs){
    if(!spec.startsWith(".")) continue;
    if(/\.json(?:$|\?)/.test(spec)){
      const dataPath=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
      if(exists(dataPath)) continue;
    }
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
  if(/test|lint|typecheck|build|format|check|acceptance|audit|qualif|replay|fixture|selftest|verify|ci:|generate|gen:|docs|openapi|doctor/.test(s)) return "GOVERNANCE_ONLY";
  if(/migrat|bootstrap|seed|schema/.test(s)) return "DATABASE_BOOTSTRAP";
  if(/worker|jobs|daemon/.test(s)) return "BACKGROUND_WORKER";
  if(/start|serve|server|runtime|dev/.test(s)) return "OPERATOR_TRIGGERED";
  return "GOVERNANCE_ONLY";
}
function classifyWorkflow(file,text){
  const n=file.toLowerCase();
  if(/acceptance|audit|qualification|rehearsal|simulator|readback|preflight|gate|qcp|test|ci|requal|evidence|attestation|closure|convergence|check|whole-repo|reachability/.test(n)) return "QUALIFICATION";
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
function inferServiceOwner(compose,service){
  const c=compose.toLowerCase(),v=service.toLowerCase();
  if(/neg_|negative|qualification|rehearsal|simulator/.test(c)) return "QUALIFICATION_INFRA";
  if(/mcft-cap09|mcft_cap09/.test(c)||/mcft-cap09|mcft_cap09|evidence-runtime|twin-runtime|fixture-capture/.test(v)) return "MCFT-CAP-09";
  if(/mcft-cap07/.test(v)) return "MCFT-CAP-07";
  if(v==="server") return "BLINE-SERVER";
  if(v==="web") return "PRESENTATION-WEB";
  if(v==="telemetry-ingest") return "BLINE-TELEMETRY-INGEST";
  if(v==="jobs") return "BLINE-SERVER-JOBS";
  if(v==="executor") return "BLINE-EXECUTOR";
  if(/principal|bootstrap|migration/.test(v)) return "DATABASE-PLATFORM";
  if(/postgres|mqtt|minio|redis|credential|secret|pgdata|data$/.test(v)) return "INFRASTRUCTURE";
  return inferOwner(service,compose);
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
      owner:inferOwner(String(command),pkg),parse_status:seeds.length||cls==="GOVERNANCE_ONLY"||cls==="DATABASE_BOOTSTRAP"||inferOwner(String(command),pkg)?"PARSED_OR_OWNER_BOUND":"UNPARSED"
    });
  }
}
for(const wf of walk(".github/workflows",/\.ya?ml$/)){
  const t=read(wf),cls=classifyWorkflow(wf,t),seeds=extractSeeds(t,"");
  roots.push({
    id:"WORKFLOW:"+wf,class:cls,source:wf,entry:(t.match(/^name:\s*(.+)$/m)||[0,path.basename(wf)])[1].trim(),
    seeds,owner:inferOwner(t,wf),parse_status:seeds.length||cls==="GOVERNANCE_ONLY"||cls==="QUALIFICATION"||inferOwner(t,wf)?"PARSED_OR_OWNER_BOUND":"UNPARSED"
  });
}
function composeServices(text){
  const out=[];
  const lines=text.split(/\r?\n/);
  let inServices=false;
  for(const line of lines){
    if(/^services:\s*$/.test(line)){inServices=true;continue;}
    if(inServices&&/^\S/.test(line)) break;
    if(!inServices) continue;
    const m=/^  ([A-Za-z0-9_.-]+):\s*$/.exec(line);
    if(m) out.push(m[1]);
  }
  return out;
}
for(const compose of fs.readdirSync(ROOT).filter(x=>/^docker-compose.*\.ya?ml$/.test(x)).sort()){
  const t=read(compose),cls=/qualification|neg_|negative|rehearsal|simulator/i.test(compose)?"QUALIFICATION":/production|commercial/i.test(compose)?"PRODUCTION_ONLINE":"OPERATOR_TRIGGERED";
  const services=composeServices(t);
  for(const service of services){
    const seeds=extractSeeds(t,"");
    roots.push({
      id:"COMPOSE:"+compose+":"+service,class:cls,source:compose,entry:service,seeds,
      owner:inferServiceOwner(compose,service),parse_status:seeds.length||cls==="QUALIFICATION"||inferServiceOwner(compose,service)?"PARSED_OR_OWNER_BOUND":"UNPARSED"
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

for(const file of codeFiles){
  if(/^(?:apps\/server\/scripts\/.*(?:RUNNER|MATERIALIZE|PROVISION|BOOTSTRAP).*\.(?:ts|js|cjs|mjs)|apps\/(?:executor|telemetry-ingest)\/src\/run_.*_once\.ts)$/i.test(file)){
    const owner=inferOwner(file,file);
    const cls=/MCFT_CAP_0[1-8]|replay|shadow|calibration/i.test(file)?"CONTROLLED_REPLAY":"OPERATOR_TRIGGERED";
    roots.push({id:"STANDALONE_RUNNER:"+file,class:cls,source:file,entry:file,seeds:[file],owner:owner||"OPERATOR_TOOLING",parse_status:"PARSED"});
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
const rootOwnersByFile=new Map();
const rootIdsByFile=new Map();
for(const r of uniqueRoots){
  const owner=r.owner||null;
  for(const f of rootReach.get(r.id)||[]){
    if(!rootOwnersByFile.has(f)) rootOwnersByFile.set(f,new Set());
    if(!rootIdsByFile.has(f)) rootIdsByFile.set(f,new Set());
    if(owner) rootOwnersByFile.get(f).add(owner);
    rootIdsByFile.get(f).add(r.id);
  }
}

const inv=json(BLINE);
const blineByPath=new Map((inv.surfaces||[]).map(x=>[x.source_path,x]));
const v2=exists("acceptance-output/GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_AUDIT_V2.json")?JSON.parse(fs.readFileSync(V2_OUT,"utf8")):null;
const mRows=new Map((v2?.mandatory_mcft_reconciliation||[]).map(x=>[x.id,x]));
const v2BlineRows=new Map((v2?.bline_surface_reconciliation?.rows||[]).map(x=>[x.surface_id,x]));

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
const unparsedActiveRoots=rootOwnership.filter(r=>productClasses.has(r.class)&&r.parse_status==="UNPARSED"&&!r.owner);

function authorityCandidate(file){
  if(/(?:^|\/)(?:__tests__|tests?|fixtures?|acceptance)(?:\/|$)/i.test(file)) return false;
  if(/^scripts\/(?:runtime_acceptance|governance_acceptance)\//.test(file)) return false;
  if(/\.(?:test|spec)\./.test(file)) return false;
  if(/^apps\/web\//.test(file)||/^packages\/contracts\//.test(file)) return false;
  if(/^apps\/server\/src\/(?:contracts|product_projection\/contracts)\//.test(file)) return false;
  if(blineByPath.has(file)) return true;
  let t="";try{t=read(file)}catch{return false;}
  const concrete=/(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_"'.]+\s+SET|DELETE\s+FROM|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|register[A-Za-z0-9_]*Routes|app\.(?:post|put|patch|delete)\s*\(|child_process|\.query\(\s*["'\x60](?:INSERT|UPDATE|DELETE)|commit[A-Z]|persist[A-Z]|dispatch[A-Z])/i.test(t);
  if(concrete) return true;
  if(/\/routes\//.test(file)||/\/jobs\//.test(file)||/\/persistence\//.test(file)||/\/store\//.test(file)) return true;
  if((file.includes("/runtime/twin_runtime/")||file.includes("/external_evidence/")||file.includes("/runtime/calibration/"))&&/(?:service|repository|adapter|process|host|worker|runner|writer|scheduler|provider)/i.test(path.posix.basename(file))) return true;
  return false;
}

const candidates=codeFiles.filter(authorityCandidate);
function explicitSourceClass(file){
  if(/\/qualification\//.test(file)) return "QUALIFICATION_ONLY";
  if(/\/historical\//.test(file)||/legacy/i.test(path.posix.basename(file))) return "HISTORICAL_OR_LEGACY";
  if(/^scripts\//.test(file)) return "SCRIPT_NON_PRODUCT";
  return null;
}
const rootTextBlobs=[...new Set(uniqueRoots.map(r=>r.source).filter(exists))].map(source=>({source,text:read(source)}));
function rootTextReferenceProof(file){
  const stem=path.posix.basename(file).replace(/\.(?:ts|tsx|js|cjs|mjs)$/,"");
  const hits=[];
  for(const b of rootTextBlobs){
    if(b.text.includes(file)||b.text.includes(stem)) hits.push(b.source);
  }
  return [...new Set(hits)].sort();
}
const sourceRows=candidates.map(file=>{
  const b=blineByPath.get(file);
  const rootOwners=[...(rootOwnersByFile.get(file)||new Set())].sort();
  const rootIds=[...(rootIdsByFile.get(file)||new Set())].sort();
  const predecessor=b?v2BlineRows.get(b.surface_id):null;
  let capability=b?"BLINE:"+b.surface_id:null;
  if(!capability && rootOwners.length) capability="ROOT_OWNED:"+rootOwners.join("|");
  if(!capability && (file.includes("/runtime/twin_runtime/")||file.includes("/external_evidence/"))) capability="MCFT_RUNTIME_FAMILY";
  if(!capability && file.startsWith("apps/judge/")) capability="BLINE-JUDGE";
  if(!capability && file.startsWith("apps/executor/")) capability="BLINE-EXECUTOR";
  if(!capability && file.startsWith("apps/telemetry-ingest/")) capability="BLINE-TELEMETRY-INGEST";
  let explicit=explicitSourceClass(file);
  const root_refs=rootTextReferenceProof(file);
  const predecessorWired=predecessor?.final_disposition==="WIRED_AND_PROVEN";
  const predecessorIntentional=predecessor?.final_disposition==="INTENTIONALLY_DISCONNECTED";
  if(!explicit&&predecessorIntentional) explicit="PREDECESSOR_INTENTIONALLY_DISCONNECTED";
  const graphReachable=anyReach.has(file);
  const reachable=graphReachable||root_refs.length>0||predecessorWired;
  const product_reachable=productReach.has(file);
  return {
    source_path:file,
    registered_capability:capability,
    reachable,
    product_reachable,
    graph_reachable:graphReachable,
    root_owners:rootOwners,
    root_ids:rootIds,
    root_reference_proof:root_refs,
    predecessor_v2_disposition:predecessor?.final_disposition||null,
    explicit_non_product_class:explicit
  };
});
const reverseDiscoveryCandidates=sourceRows.filter(x=>!x.reachable&&!x.explicit_non_product_class);
const adjudication=json(ADJUDICATION);
const adjudicationByPath=new Map((adjudication.rows||[]).map(x=>[x.source_path,x]));
const adjudicatedReverseDiscovery=reverseDiscoveryCandidates.map(x=>({
  ...x,
  adjudication:adjudicationByPath.get(x.source_path)||null,
  final_disposition:adjudicationByPath.get(x.source_path)?.final_disposition||null,
}));
const unknownReverseDiscovery=adjudicatedReverseDiscovery.filter(x=>!x.adjudication);
const staleAdjudications=(adjudication.rows||[]).filter(x=>!sourceRows.some(s=>s.source_path===x.source_path));
const orphanSources=unknownReverseDiscovery;
const unregisteredSources=sourceRows.filter(x=>!x.registered_capability&&!x.explicit_non_product_class&&!x.reachable&&!adjudicationByPath.has(x.source_path));
const knownReverseDiscoveryDefects=adjudicatedReverseDiscovery.filter(x=>["UNWIRED_DEFECT","SEMANTICALLY_INCOMPATIBLE"].includes(x.final_disposition));
const knownReverseDiscoveryIntentional=adjudicatedReverseDiscovery.filter(x=>x.final_disposition==="INTENTIONALLY_DISCONNECTED");
const knownReverseDiscoveryWired=adjudicatedReverseDiscovery.filter(x=>x.final_disposition==="WIRED_AND_PROVEN");

const workflowGeneratedTargets=new Map();
for(const wf of walk(".github/workflows",/\.ya?ml$/)){
  const t=read(wf);
  for(const m of t.matchAll(/Path\(['"]([^'"]+)['"]\)\.write_text/g)){
    const target=m[1].replace(/\\/g,"/");
    if(!workflowGeneratedTargets.has(target)) workflowGeneratedTargets.set(target,[]);
    workflowGeneratedTargets.get(target).push(wf);
  }
}
function unresolvedGeneratedTarget(x){
  const base=path.posix.normalize(path.posix.join(path.posix.dirname(x.importer),x.specifier));
  const variants=[base,base.replace(/\.js$/,".ts"),base.replace(/\.mjs$/,".ts"),base.replace(/\.cjs$/,".ts")];
  for(const v of variants){
    if(workflowGeneratedTargets.has(v)) return {target:v,workflows:workflowGeneratedTargets.get(v)};
  }
  return null;
}
const generatedActiveImports=[];
const activeUnresolved=[];
for(const x of allUnresolved.filter(x=>productReach.has(x.importer))){
  const generated=unresolvedGeneratedTarget(x);
  if(generated) generatedActiveImports.push({...x,...generated});
  else activeUnresolved.push(x);
}

const matrix=json(MATRIX);
const completeCaps=(matrix.capability_lines||[]).filter(x=>x.complete===true);
const capRows=completeCaps.map(c=>{
  const id=c.capability_line_id;
  let owner=null,root=null,proof=null,disposition=null;
  if(id==="MCFT-CAP-00"){
    const proofRefs=[
      "docs/digital_twin/mcft/GEOX-MCFT-00-CLOSURE-RECORD.md",
      "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
      "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
      "apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.ts"
    ].filter(exists);
    owner="MCFT-00_STATIC_GOVERNANCE_AUTHORITY";
    root="NON_EXECUTABLE_AUTHORITY_CONSUMED_BY_SUCCESSOR_RUNTIME";
    proof={alias:"MCFT-CAP-00_IS_MCFT-00_PREDECESSOR_AUTHORITY",evidence_refs:proofRefs};
    disposition=proofRefs.length===4?"WIRED_AND_PROVEN":"UNWIRED_DEFECT";
  }
  else if(id==="MCFT-CAP-05"){const m=mRows.get("M-01");owner=m?.expected_execution_owner||null;root=m?.expected_execution_root||null;proof=m?.evidence||null;disposition=m?.final_disposition||null;}
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
const semanticConflictUnchecked=semanticFamilyConflicts.filter(x=>{
  if(x.family==="POINT_{DEPTH}MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"){
    const m=mRows.get("M-02");
    return !(m&&["SEMANTICALLY_INCOMPATIBLE","WIRED_AND_PROVEN","INTENTIONALLY_DISCONNECTED"].includes(m.final_disposition));
  }
  return true;
});

const head=git("rev-parse","HEAD");
const freshBinding={current_head:head,v2_audit_head:v2?.audit_subject?.audit_head||null,exact_match:v2?.audit_subject?.audit_head===head};

const failures=[];
for(const x of unownedRoots) failures.push("UNOWNED_EXECUTION_ROOT:"+x.id);
for(const x of unknownReverseDiscovery) failures.push("UNADJUDICATED_DISCOVERY:"+x.source_path);
for(const x of unregisteredSources) failures.push("UNREGISTERED_AUTHORITY_CAPABLE_PATH:"+x.source_path);
for(const x of capGaps) {
  if(x.owner_missing) failures.push("EXPECTED_OWNER_MISSING:"+x.capability_id);
  if(x.root_missing) failures.push("EXPECTED_ROOT_MISSING:"+x.capability_id);
  if(x.proof_missing) failures.push("RUNTIME_PROOF_REQUIRED_BUT_MISSING:"+x.capability_id);
}
for(const x of activeUnresolved) failures.push("UNRESOLVED_ACTIVE_IMPORT:"+x.importer+":"+x.specifier);
for(const x of unparsedActiveRoots) failures.push("UNPARSED_ACTIVE_ROOT_COMMAND:"+x.id);
for(const x of blineSemanticUnchecked) failures.push("SEMANTIC_EDGE_UNCHECKED:"+x.surface_id);
for(const x of semanticConflictUnchecked) failures.push("SEMANTIC_EDGE_UNCHECKED:"+x.family);
if(!freshBinding.exact_match) failures.push("STALE_AUDIT_EVIDENCE_SUBJECT");

const scannerIntegrityFailures=[
  ...activeUnresolved.map(x=>"UNRESOLVED_ACTIVE_IMPORT:"+x.importer+":"+x.specifier),
  ...unparsedActiveRoots.map(x=>"UNPARSED_ACTIVE_ROOT_COMMAND:"+x.id),
  ...(freshBinding.exact_match?[]:["STALE_AUDIT_EVIDENCE_SUBJECT"])
];
const result={
  schema_version:"geox_whole_repository_audit_completeness_v3",
  status:failures.length?"FAIL":"PASS",
  scanner_integrity_status:scannerIntegrityFailures.length?"FAIL":"PASS",
  discovery_adjudication_status:unknownReverseDiscovery.length?"FAIL":"PASS",
  repository_wiring_status:knownReverseDiscoveryDefects.length||v2?.status==="FAIL"?"FAIL":"PASS",
  subject_sha:head,
  method_ref:METHOD,
  invariants:{
    execution_root_ownership:{status:unownedRoots.length?"FAIL":"PASS",root_count:rootOwnership.length,unowned_count:unownedRoots.length},
    effective_capability_reachability:{status:capGaps.length?"FAIL":"PASS",complete_capability_count:capRows.length,gap_count:capGaps.length},
    semantic_edge_adjudication:{status:(blineSemanticUnchecked.length||semanticConflictUnchecked.length)?"FAIL":"PASS",unchecked_declared_edge_count:blineSemanticUnchecked.length,identity_family_conflict_count:semanticFamilyConflicts.length,unchecked_identity_family_conflict_count:semanticConflictUnchecked.length},
    reverse_orphan_discovery:{status:unknownReverseDiscovery.length?"FAIL":"PASS",candidate_source_count:sourceRows.length,reverse_discovery_candidate_count:reverseDiscoveryCandidates.length,adjudicated_count:adjudicatedReverseDiscovery.length,unadjudicated_count:unknownReverseDiscovery.length,known_defect_count:knownReverseDiscoveryDefects.length,intentional_count:knownReverseDiscoveryIntentional.length,wired_count:knownReverseDiscoveryWired.length,unregistered_source_count:unregisteredSources.length},
    exact_head_freshness:{status:freshBinding.exact_match?"PASS":"FAIL",...freshBinding},
    graph_parse_completeness:{status:activeUnresolved.length||unparsedActiveRoots.length?"FAIL":"PASS",unresolved_active_import_count:activeUnresolved.length,unparsed_active_root_count:unparsedActiveRoots.length}
  },
  execution_root_ownership_matrix:rootOwnership,
  all_complete_or_effective_capabilities:capRows,
  authority_capable_source_reverse_reachability:sourceRows,
  unowned_execution_roots:unownedRoots,
  reverse_discovery_adjudication_ref:ADJUDICATION,
  reverse_discovery_adjudicated:adjudicatedReverseDiscovery,
  reverse_discovery_known_defects:knownReverseDiscoveryDefects,
  reverse_discovery_intentionally_disconnected:knownReverseDiscoveryIntentional,
  reverse_discovery_wired_and_proven:knownReverseDiscoveryWired,
  orphan_authority_capable_sources:unknownReverseDiscovery,
  unregistered_authority_capable_sources:unregisteredSources,
  capability_reachability_gaps:capGaps,
  unresolved_active_imports:activeUnresolved,
  workflow_generated_active_imports:generatedActiveImports,
  stale_adjudication_rows:staleAdjudications,
  unparsed_active_root_commands:unparsedActiveRoots,
  semantic_identity_family_conflicts:semanticFamilyConflicts,
  semantic_edge_unchecked:[...blineSemanticUnchecked,...semanticConflictUnchecked],
  fresh_exact_head_evidence_binding:freshBinding,
  scanner_integrity_failures:scannerIntegrityFailures,
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
  reverse_discovery_candidates:reverseDiscoveryCandidates.length,
  reverse_discovery_adjudicated:adjudicatedReverseDiscovery.length,
  known_reverse_discovery_defects:knownReverseDiscoveryDefects.length,
  orphan_sources:unknownReverseDiscovery.length,
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
