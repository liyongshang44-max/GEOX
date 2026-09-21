#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/GEOX_WHOLE_REPOSITORY_FILE_COVERAGE_V4.json");
const rel=p=>path.relative(ROOT,p).split(path.sep).join("/");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const exists=p=>fs.existsSync(path.join(ROOT,p));
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim();

const tracked=git("ls-files").split(/\r?\n/).filter(Boolean).sort();
const workflows=tracked.filter(x=>/^\.github\/workflows\/.*\.ya?ml$/.test(x));

function safeRead(file){try{return read(file)}catch{return "";}}
function ext(file){
  if(/(?:^|\/)Dockerfile(?:\.|$)/.test(file)) return "dockerfile";
  if(/(?:^|\/)package\.json$/.test(file)) return "package";
  return path.posix.extname(file).toLowerCase()||"none";
}
function classify(file){
  if(/^acceptance-output\//.test(file)) return "GENERATED_OUTPUT";
  if(/^docs\//.test(file)||/^doc\//.test(file)||/\.md$/i.test(file)) return "GOVERNANCE_OR_DOCUMENTATION";
  if(/^\.github\/workflows\//.test(file)) return "EXECUTION_ROOT_DECLARATION";
  if(/^docker-compose.*\.ya?ml$/.test(file)||/(?:^|\/)Dockerfile(?:\.|$)/.test(file)) return "EXECUTION_ROOT_DECLARATION";
  if(/(?:^|\/)package\.json$/.test(file)) return "EXECUTION_ROOT_DECLARATION";
  if(/^apps\/server\/db\/migrations\/.*\.sql$/.test(file)) return "DATABASE_MIGRATION_SOURCE";
  if(/^docker\/postgres\/init\/.*\.sql$/.test(file)) return "DATABASE_BOOTSTRAP_SOURCE";
  if(/\.sql$/i.test(file)) return "SQL_SOURCE_OTHER";
  if(/\.(?:ts|tsx|js|jsx|cjs|mjs)$/i.test(file)) {
    if(/(?:^|\/)(?:__tests__|tests?|fixtures?|runtime_acceptance|governance_acceptance|frontend_acceptance|agronomy_acceptance)(?:\/|$)/i.test(file)||/\.(?:test|spec)\./i.test(file)) return "JS_TS_TEST_OR_QUALIFICATION";
    return "JS_TS_PRODUCT_OR_TOOLING";
  }
  if(/\.py$/i.test(file)) return /acceptance|probe|decoder|fixture|test/i.test(file)?"PYTHON_QUALIFICATION_OR_TOOLING":"PYTHON_OPERATIONAL_TOOLING";
  if(/\.sh$/i.test(file)) return "SHELL_OPERATIONAL_TOOLING";
  if(/\.ps1$/i.test(file)) return "POWERSHELL_OPERATIONAL_TOOLING";
  if(/^config\/.*\.json$/i.test(file)) return "DECLARATIVE_RUNTIME_CONFIG";
  if(/\.(?:json|ya?ml)$/i.test(file)) return "DECLARATIVE_DATA_OR_CONFIG";
  if(/\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|pdf|zip|lock|map)$/i.test(file)) return "STATIC_OR_GENERATED_ASSET";
  if(/(?:^|\/)(?:LICENSE|NOTICE|README|CHANGELOG)(?:\.|$)/i.test(file)) return "DOCUMENTATION";
  return "OTHER_TRACKED_FILE";
}

const workflowText=workflows.map(file=>({file,text:safeRead(file)}));
const generated=new Map();
function noteGenerated(target,workflow,mechanism){
  const clean=target.replace(/^\.\//,"").replace(/\\/g,"/");
  if(!clean||clean.includes("$")||clean.includes("{")) return;
  if(!generated.has(clean)) generated.set(clean,[]);
  generated.get(clean).push({workflow,mechanism});
}
for(const {file,text} of workflowText){
  for(const m of text.matchAll(/Path\(['"]([^'"]+)['"]\)\.write_text/g)) noteGenerated(m[1],file,"PYTHON_PATH_WRITE_TEXT");
  for(const m of text.matchAll(/writeFileSync\(\s*['"]([^'"]+)['"]/g)) noteGenerated(m[1],file,"NODE_WRITE_FILE_SYNC");
  for(const m of text.matchAll(/(?:cat|tee)\s+[^\n]*?\s(?:>|>>)\s*['"]?([A-Za-z0-9_./-]+\.(?:ts|js|cjs|mjs|json|sql))['"]?/g)) noteGenerated(m[1],file,"SHELL_REDIRECT");
}

const sqlRows=[];
for(const file of tracked.filter(x=>/\.sql$/i.test(x))){
  const text=safeRead(file);
  const authority=/(CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|CREATE\s+POLICY|ALTER\s+POLICY|GRANT\s+|REVOKE\s+|CREATE\s+ROLE|ALTER\s+ROLE|ALTER\s+DEFAULT\s+PRIVILEGES|INSERT\s+INTO|UPDATE\s+[^;\n]+\s+SET|DELETE\s+FROM)/i.test(text);
  let owner=null,root=null;
  if(/^apps\/server\/db\/migrations\//.test(file)){
    owner="DATABASE-PLATFORM";
    root="runSqlMigrations";
  }else if(/^docker\/postgres\/init\//.test(file)){
    owner="DATABASE-PLATFORM";
    root="POSTGRES_DOCKER_INIT";
  }
  sqlRows.push({file,authority_capable:authority,owner,execution_root:root,owned:!authority||Boolean(owner)});
}
const unownedSql=sqlRows.filter(x=>x.authority_capable&&!x.owned);

function scriptOwner(file,text){
  const s=(file+" "+text).toLowerCase();
  const m=s.match(/mcft[-_]?cap[-_]?0?([0-9])/);
  if(m) return "MCFT-CAP-0"+m[1];
  if(/mcft.*cap.*09/.test(s)) return "MCFT-CAP-09";
  if(/modbus|soilprobe|telemetry|ingest/.test(s)) return "BLINE-TELEMETRY-INGEST";
  if(/deploy.*commercial|commercial.*deploy/.test(s)) return "COMMERCIAL-DEPLOYMENT-TOOLING";
  if(/backup|restore/.test(s)) return "DATABASE-OPERATOR-TOOLING";
  if(/acceptance|probe|test|fixture|decoder|audit|qualif/.test(s)) return "QUALIFICATION_OR_GOVERNANCE";
  return null;
}
const nonJsExec=tracked.filter(x=>/\.(?:sh|ps1|py)$/i.test(x)).map(file=>{
  const text=safeRead(file),owner=scriptOwner(file,text);
  return {file,kind:ext(file),owner,owned:Boolean(owner)};
});
const unownedNonJs=nonJsExec.filter(x=>!x.owned);

const configRows=tracked.filter(x=>/^config\/.*\.json$/i.test(x)).map(file=>{
  const base=path.posix.basename(file);
  const refs=[];
  for(const src of tracked.filter(x=>/\.(?:ts|tsx|js|cjs|mjs)$/i.test(x))){
    const t=safeRead(src);
    if(t.includes(file)||t.includes(base)) refs.push(src);
  }
  return {file,reference_count:refs.length,reference_sample:refs.slice(0,20),referenced:refs.length>0};
});
const unreferencedRuntimeConfig=configRows.filter(x=>!x.referenced);

const classificationCounts={};
for(const file of tracked){
  const c=classify(file);
  classificationCounts[c]=(classificationCounts[c]||0)+1;
}

const executableLike=tracked.filter(x=>
  /\.(?:ts|tsx|js|jsx|cjs|mjs|sql|sh|ps1|py)$/i.test(x)
  || /^\.github\/workflows\/.*\.ya?ml$/.test(x)
  || /^docker-compose.*\.ya?ml$/.test(x)
  || /(?:^|\/)Dockerfile(?:\.|$)/.test(x)
  || /(?:^|\/)package\.json$/.test(x)
);
const uncoveredExecutableLike=executableLike.filter(file=>classify(file)==="OTHER_TRACKED_FILE");

const generatedSupport=[...generated.entries()].map(([file,producers])=>({file,producers}));
const knownGeneratedImport="scripts/runtime_acceptance/mcft_cap09_s5_canonical_integration_support_v1.ts";
const knownGeneratedImportCovered=generated.has(knownGeneratedImport);

const failures=[];
for(const x of unownedSql) failures.push("UNOWNED_SQL_AUTHORITY_SOURCE:"+x.file);
for(const x of unownedNonJs) failures.push("UNOWNED_NON_JS_EXECUTABLE:"+x.file);
for(const x of uncoveredExecutableLike) failures.push("UNCOVERED_EXECUTABLE_LIKE_FILE:"+x);
if(!knownGeneratedImportCovered) failures.push("WORKFLOW_GENERATED_SOURCE_EDGE_MISSING:"+knownGeneratedImport);

const result={
  schema_version:"geox_whole_repository_file_coverage_v4",
  status:failures.length?"FAIL":"PASS",
  subject_sha:git("rev-parse","HEAD"),
  tracked_file_count:tracked.length,
  executable_like_file_count:executableLike.length,
  classification_counts:classificationCounts,
  sql_authority_inventory:sqlRows,
  unowned_sql_authority_sources:unownedSql,
  non_js_executable_inventory:nonJsExec,
  unowned_non_js_executables:unownedNonJs,
  declarative_runtime_config_inventory:configRows,
  unreferenced_runtime_configs:unreferencedRuntimeConfig,
  workflow_generated_sources:generatedSupport,
  workflow_generated_s5_support_edge_proven:knownGeneratedImportCovered,
  uncovered_executable_like_files:uncoveredExecutableLike,
  failures,
  non_effects:{
    product_semantic_change:false,
    runtime_wiring_change:false,
    database_mutation:false,
    rehearsal_resource_use:false,
    formal_store_mutation:false
  }
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");
console.log("WHOLE_REPOSITORY_FILE_COVERAGE_V4 "+JSON.stringify({
  status:result.status,
  subject_sha:result.subject_sha,
  tracked_files:result.tracked_file_count,
  executable_like_files:result.executable_like_file_count,
  sql_authority_sources:sqlRows.filter(x=>x.authority_capable).length,
  unowned_sql_authority_sources:unownedSql.length,
  non_js_executables:nonJsExec.length,
  unowned_non_js_executables:unownedNonJs.length,
  declarative_runtime_configs:configRows.length,
  unreferenced_runtime_configs:unreferencedRuntimeConfig.length,
  workflow_generated_sources:generatedSupport.length,
  generated_s5_support_edge:knownGeneratedImportCovered,
  uncovered_executable_like_files:uncoveredExecutableLike.length
}));
for(const f of failures.slice(0,200)) console.log("FILE_COVERAGE_FAILURE",f);
if(failures.length) process.exitCode=1;
