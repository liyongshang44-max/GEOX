#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=process.cwd();
const INDEX="apps/judge/src/config/index.ts";
const GEN="apps/judge/scripts/gen_ruleset.mjs";
const DEFAULT="config/judge/default.json";
const LEGACY="config/judge/ruleset_v1.json";
const README="apps/judge/README.rules.md";
const read=(p)=>fs.readFileSync(path.join(ROOT,p),"utf8");
const json=(p)=>JSON.parse(read(p));
const failures=[];
const req=(c,x)=>{if(!c)failures.push(x);};
const i=read(INDEX),g=read(GEN),r=read(README),d=json(DEFAULT),l=json(LEGACY);
req(i.includes('config", "judge", "default.json"'),"INDEX_DEFAULT_SSOT_REQUIRED");
req(!i.includes('config", "judge", "ruleset_v1.json"'),"INDEX_LEGACY_SSOT_FORBIDDEN");
req(g.includes('config/judge/default.json'),"GENERATOR_DEFAULT_SSOT_REQUIRED");
req(!g.includes('path.join(repoRoot, "config/judge/ruleset_v1.json")'),"GENERATOR_LEGACY_SSOT_FORBIDDEN");
req(r.includes("config/judge/default.json")&&r.includes("legacy compatibility snapshot"),"README_RETIREMENT_BOUNDARY_REQUIRED");
for(const key of ["required_metrics","sufficiency","time_coverage","qc","marker","reference","conflict","determinism"]){
  const dv=d[key],lv=l[key];
  if(key==="time_coverage"){
    req(dv.max_allowed_gap_ms===lv.max_allowed_gap_ms&&dv.min_coverage_ratio===lv.min_coverage_ratio,"LEGACY_OVERLAP_DRIFT:time_coverage");
  }else{
    req(JSON.stringify(dv)===JSON.stringify(lv),`LEGACY_OVERLAP_DRIFT:${key}`);
  }
}
const result={
  schema_version:"geox_judge_ssot_convergence_acceptance_v1",
  status:failures.length?"FAIL":"PASS",
  active_ssot:DEFAULT,
  legacy_snapshot:LEGACY,
  runtime_semantic_overlap_preserved:failures.filter(x=>x.startsWith("LEGACY_OVERLAP_DRIFT")).length===0,
  legacy_runtime_authority:false,
  legacy_generator_authority:false,
  failures
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/GEOX_JUDGE_SSOT_CONVERGENCE_V1.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
if(failures.length)process.exit(1);
