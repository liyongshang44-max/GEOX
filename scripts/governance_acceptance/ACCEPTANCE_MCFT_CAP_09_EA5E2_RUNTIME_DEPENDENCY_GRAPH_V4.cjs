#!/usr/bin/env node
"use strict";
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const ROOT=process.cwd();
const LIVE=".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml";
const SELF="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs";
const STATIC_WF=".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml";
const CARRIER="scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs";
const DRIFT="scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ROLLING_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";
const MARK="EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_SHA256",PH="__EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_SHA256__";
const ENTRY=[
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
 "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs",
 "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py",
 DRIFT,CARRIER];
const STATIC=[LIVE,SELF,STATIC_WF,
 ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml",
 ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml",
 ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CAPTURE.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ROLLING_KBS_INTERSECTION.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V3.cjs",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V3.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V2.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V2.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md",
 "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
 "package.json","pnpm-lock.yaml","pnpm-workspace.yaml","apps/server/package.json"];
const MUST=[
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
 "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
 DRIFT,CARRIER,
 "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
 "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts",
 "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
 "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts",
 "apps/server/src/domain/soil_water/hourly_water_balance_v1.ts",
 "apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts"];
const PATH_RE=/(?:apps|scripts|docs|packages)\/[0-9A-Za-z_.@+\-/]+\.(?:ts|tsx|js|cjs|mjs|py|json|sql)/g;
const MARK_RE=/\/\/\s*EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_SHA256=(sha256:[0-9a-f]{64}|__EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_SHA256__)\s*/;
const norm=s=>s.replace(/\\/g,"/").replace(/^\.\//,"");
function file(rel){const a=path.resolve(ROOT,norm(rel)),r=path.resolve(ROOT);if(a!==r&&!a.startsWith(r+path.sep))return null;if(!fs.existsSync(a)||!fs.statSync(a).isFile())return null;return norm(path.relative(ROOT,a));}
function req(rel){const x=file(rel);if(!x)throw Error(`EA5E2_DEP_V4_FILE_MISSING:${rel}`);return x;}
function resolve(from,s){if(!s.startsWith("."))return null;const b=path.resolve(ROOT,path.dirname(from),s),e=path.extname(b),c=[];if([".js",".mjs",".cjs"].includes(e))c.push(b.replace(/\.(?:mjs|cjs|js)$/, ".ts"),b.replace(/\.(?:mjs|cjs|js)$/, ".tsx"),b);else if(e)c.push(b);else{for(const x of [".ts",".tsx",".js",".cjs",".mjs",".json",".py"])c.push(b+x);for(const x of ["index.ts","index.tsx","index.js","index.cjs","index.mjs"])c.push(path.join(b,x));}for(const x of c){const y=file(path.relative(ROOT,x));if(y)return y;}return null;}
function children(rel){if(!/\.(?:ts|tsx|js|cjs|mjs|py)$/.test(rel))return[];const t=fs.readFileSync(rel,"utf8"),o=new Set();for(const m of t.matchAll(PATH_RE)){const x=file(m[0]);if(x)o.add(x);}if(!rel.endsWith(".py")){for(const re of [/\bimport\s+(?!type\b)[^;]*?\sfrom\s*["']([^"']+)["']/g,/\bimport\s*["']([^"']+)["']/g,/\bimport\(\s*["']([^"']+)["']\s*\)/g,/\brequire\(\s*["']([^"']+)["']\s*\)/g])for(const m of t.matchAll(re)){const x=resolve(rel,m[1]);if(x)o.add(x);}}return[...o];}
function closure(){const s=new Set(),q=[];for(const e of ENTRY){const x=req(e);s.add(x);q.push(x);}while(q.length){for(const x of children(q.shift()))if(!s.has(x)){s.add(x);q.push(x);}}for(const x of STATIC)s.add(req(x));return[...s].sort();}
function glob(p){let s="";for(let i=0;i<p.length;i++){const c=p[i];if(c==="*"&&p[i+1]==="*"){s+=".*";i++;}else if(c==="*")s+="[^/]*";else if(c==="?")s+="[^/]";else s+=c.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&");}return new RegExp(`^${s}$`);}
function listPaths(){const t=fs.readFileSync(STATIC_WF,"utf8"),i=t.indexOf("\n    paths:\n"),j=t.indexOf("\n  workflow_dispatch:",i);if(i<0||j<0)return[];return t.slice(i,j).split(/\r?\n/).map(x=>/^\s+-\s+["']?([^"']+?)["']?\s*$/.exec(x)?.[1]).filter(Boolean);}
function liveSets(){const t=fs.readFileSync(LIVE,"utf8"),autoLive=/^\s{2}push:\s*$/m.test(t)&&/rolling-live:\n\s+if: github\.event_name == 'workflow_dispatch'/.test(t)===false,manual=/^\s{2}workflow_dispatch:\s*$/m.test(t),d=fs.readFileSync(DRIFT,"utf8"),i=d.indexOf("const critical = ["),j=d.indexOf("\n].sort();",i),critical=new Set();if(i<0||j<0)throw Error("EA5E2_DEP_V4_ROLLING_CRITICAL_BLOCK_REQUIRED");for(const m of d.slice(i,j).matchAll(/"([^"]+)"/g))critical.add(m[1]);return{autoLive,manual,critical};}
function bytes(rel){const b=fs.readFileSync(rel);if(rel!==CARRIER)return b;const t=b.toString("utf8");if(!MARK_RE.test(t))throw Error("EA5E2_DEP_V4_BINDING_MARKER_REQUIRED");return Buffer.from(t.replace(MARK_RE,`// ${MARK}=${PH}\n`));}
function digest(g){const h=crypto.createHash("sha256");for(const x of g){h.update(x);h.update("\0");h.update(bytes(x));h.update("\0");}return`sha256:${h.digest("hex")}`;}
function main(){const g=closure(),missing=MUST.filter(x=>!g.includes(x)),{autoLive,manual,critical}=liveSets(),patterns=listPaths().map(glob),uncovered=g.filter(x=>!patterns.some(r=>r.test(x))),expected=digest(g),actual=MARK_RE.exec(fs.readFileSync(CARRIER,"utf8"))?.[1]??null;const p={schema_version:"geox_mcft_cap09_ea5e2_rolling_runtime_dependency_graph_v5",status:missing.length||uncovered.length||autoLive||!manual||!critical.has(CARRIER)||actual!==expected?"FAIL":"PASS",final_activation_orchestration:"ROLLING_PREBOUNDARY_BATCH_INTERSECTION",runtime_dependency_graph_count:g.length,runtime_dependency_graph_paths:g,expected_dependency_graph_sha256:expected,carrier_dependency_graph_sha256:actual,binding_carrier_path:CARRIER,expensive_live_auto_dispatch_present:autoLive,live_manual_dispatch_present:manual,binding_carrier_in_exact_main_critical:critical.has(CARRIER),required_runtime_discovery_missing:missing,static_gate_uncovered_paths:uncovered,future_t_long_wait_activation_authority:false,fixed_t_plus_432_normative_authority:false,six_hour_freshness_late_admission_authority:false,provider_request_count:0,database_write_count:0,formal_effect:false};fs.mkdirSync("acceptance-output",{recursive:true});fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json",JSON.stringify(p,null,2)+"\n");console.log(JSON.stringify(p));if(p.status!=="PASS")throw Error(`EA5E2_ROLLING_RUNTIME_DEPENDENCY_GRAPH_V4_UNBOUND:${JSON.stringify({missing,uncovered,autoLive,manual,carrierCritical:p.binding_carrier_in_exact_main_critical,digestMatch:actual===expected,expected})}`);}
main();
