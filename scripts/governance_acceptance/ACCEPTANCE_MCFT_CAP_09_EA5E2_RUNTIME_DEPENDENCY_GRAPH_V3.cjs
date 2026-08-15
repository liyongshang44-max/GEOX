#!/usr/bin/env node
"use strict";
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const ROOT=process.cwd();
const LIVE=".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const SELF="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3.cjs";
const STATIC_WF=".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml";
const CARRIER="scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3_BINDING.cjs";
const DRIFT="scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";
const MARK="EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256", PH="__EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256__";
const ENTRY=[
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs",
 "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
 DRIFT,
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts",
 "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
 CARRIER];
const STATIC=[LIVE,SELF,STATIC_WF,
 ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V2.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V2.cjs",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V2.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V2.json",
 "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json",
 "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json",
 "package.json","pnpm-lock.yaml","pnpm-workspace.yaml","apps/server/package.json"];
const MUST=[
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs",
 "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
 DRIFT,CARRIER,
 "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts",
 "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
 "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py",
 "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
 "apps/server/src/domain/soil_water/hourly_water_balance_v1.ts",
 "apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts",
 "apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.ts"];
const PATH_RE=/(?:apps|scripts|docs|packages)\/[0-9A-Za-z_.@+\-/]+\.(?:ts|tsx|js|cjs|mjs|py|json|sql)/g;
const MARK_RE=/\/\/\s*EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256=(sha256:[0-9a-f]{64}|__EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256__)\s*/;
const norm=s=>s.replace(/\\/g,"/").replace(/^\.\//,"");
function file(rel){const a=path.resolve(ROOT,norm(rel)),r=path.resolve(ROOT);if(a!==r&&!a.startsWith(r+path.sep))return null;if(!fs.existsSync(a)||!fs.statSync(a).isFile())return null;return norm(path.relative(ROOT,a));}
function req(rel){const x=file(rel);if(!x)throw Error(`EA5E2_DEP_V3_FILE_MISSING:${rel}`);return x;}
function resolve(from,s){if(!s.startsWith("."))return null;const b=path.resolve(ROOT,path.dirname(from),s),e=path.extname(b),c=[];if([".js",".mjs",".cjs"].includes(e))c.push(b.replace(/\.(?:mjs|cjs|js)$/, ".ts"),b.replace(/\.(?:mjs|cjs|js)$/, ".tsx"),b);else if(e)c.push(b);else{for(const x of [".ts",".tsx",".js",".cjs",".mjs",".json",".py"])c.push(b+x);for(const x of ["index.ts","index.tsx","index.js","index.cjs","index.mjs"])c.push(path.join(b,x));}for(const x of c){const y=file(path.relative(ROOT,x));if(y)return y;}return null;}
function children(rel){if(!/\.(?:ts|tsx|js|cjs|mjs|py)$/.test(rel))return[];const t=fs.readFileSync(rel,"utf8"),o=new Set();for(const m of t.matchAll(PATH_RE)){const x=file(m[0]);if(x)o.add(x);}if(!rel.endsWith(".py")){for(const re of [/\bimport\s+(?!type\b)[^;]*?\sfrom\s*["']([^"']+)["']/g,/\bimport\s*["']([^"']+)["']/g,/\bimport\(\s*["']([^"']+)["']\s*\)/g,/\brequire\(\s*["']([^"']+)["']\s*\)/g])for(const m of t.matchAll(re)){const x=resolve(rel,m[1]);if(x)o.add(x);}}return[...o];}
function closure(){const s=new Set(),q=[];for(const e of ENTRY){const x=req(e);s.add(x);q.push(x);}while(q.length){for(const x of children(q.shift()))if(!s.has(x)){s.add(x);q.push(x);}}for(const x of STATIC)s.add(req(x));return[...s].sort();}
function listBlock(t,a,b){const i=t.indexOf(a),j=t.indexOf(b,i+a.length);if(i<0||j<0)return[];return t.slice(i,j).split(/\r?\n/).map(x=>/^\s+-\s+["']?([^"']+?)["']?\s*$/.exec(x)?.[1]).filter(Boolean);}
function liveSets(){const t=fs.readFileSync(LIVE,"utf8"),autoPush=/^\s{2}push:\s*$/m.test(t),manualDispatch=/^\s{2}workflow_dispatch:\s*$/m.test(t),d=fs.readFileSync(DRIFT,"utf8"),i=d.indexOf("const critical = ["),j=d.indexOf("\n];",i),critical=new Set();if(i<0||j<0)throw Error("EA5E2_DEP_V3_LIVE_CRITICAL_BLOCK_REQUIRED");for(const m of d.slice(i,j).matchAll(/"([^"]+)"/g))critical.add(m[1]);return{autoPush,manualDispatch,critical};}
function glob(p){let s="";for(let i=0;i<p.length;i++){const c=p[i];if(c==="*"&&p[i+1]==="*"){s+=".*";i++;}else if(c==="*")s+="[^/]*";else if(c==="?")s+="[^/]";else s+=c.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&");}return new RegExp(`^${s}$`);}
function bytes(rel){const b=fs.readFileSync(rel);if(rel!==CARRIER)return b;const t=b.toString("utf8");if(!MARK_RE.test(t))throw Error("EA5E2_DEP_V3_BINDING_MARKER_REQUIRED");return Buffer.from(t.replace(MARK_RE,`// ${MARK}=${PH}\n`));}
function digest(g){const h=crypto.createHash("sha256");for(const x of g){h.update(x);h.update("\0");h.update(bytes(x));h.update("\0");}return`sha256:${h.digest("hex")}`;}
function main(){const g=closure(),missingMust=MUST.filter(x=>!g.includes(x)),{autoPush,manualDispatch,critical}=liveSets(),patterns=listBlock(fs.readFileSync(STATIC_WF,"utf8"),"\n    paths:\n","\n  workflow_dispatch:").map(glob),uncovered=g.filter(x=>!patterns.some(r=>r.test(x))),expected=digest(g),actual=MARK_RE.exec(fs.readFileSync(CARRIER,"utf8"))?.[1]??null;const p={schema_version:"geox_mcft_cap09_ea5e2_runtime_dependency_graph_v4",status:missingMust.length||uncovered.length||autoPush||!manualDispatch||!critical.has(CARRIER)||actual!==expected?"FAIL":"PASS",runtime_dependency_graph_count:g.length,runtime_dependency_graph_paths:g,expected_dependency_graph_sha256:expected,carrier_dependency_graph_sha256:actual,binding_carrier_path:CARRIER,expensive_live_auto_push_present:autoPush,live_manual_dispatch_present:manualDispatch,binding_carrier_in_exact_main_critical:critical.has(CARRIER),required_runtime_discovery_missing:missingMust,static_gate_uncovered_paths:uncovered,historical_v1_authorities_preserved:true,provider_request_count:0,database_read_count:0,database_write_count:0,formal_effect:false};fs.mkdirSync("acceptance-output",{recursive:true});fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json",JSON.stringify(p,null,2)+"\n");console.log(JSON.stringify(p));if(p.status!=="PASS")throw Error(`EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3_UNBOUND:${JSON.stringify({missingMust,uncovered,autoPush,manualDispatch,carrierCritical:p.binding_carrier_in_exact_main_critical,digestMatch:actual===expected,expected})}`);}
main();
