const fs=require("node:fs"),cp=require("node:child_process");
const BASE="f23cc22eb8158a1d9840f042f13ad3fd27b5fe8a";
const PREDECESSOR="docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json";
const W5="docs/architecture/semantic_convergence/GEOX-BLINE-W5-LEGACY-RUNTIME-CONTAINMENT-V1.json";
function sh(args){return cp.execFileSync("git",["-c","core.quotepath=false",...args],{encoding:"utf8"}).trim();}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}

const w5=json(W5),pred=json(PREDECESSOR);
assert(w5.version==="GEOX_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1","W5 version drift");
assert(w5.status==="FROZEN_BOUNDED_WORKSTREAM_INVENTORY","W5 status drift");
assert(w5.authority_base===BASE,"W5 authority base drift",w5.authority_base);
assert(w5.discovery_policy==="NO_WHOLE_REPOSITORY_DISCOVERY; EXACT_PREDECESSOR_ROWS_ONLY","W5 discovery policy drift");
assert(w5.repair_strategy==="STRICT_RUNTIME_EXACT_METHOD_PATH_CONTAINMENT_BEFORE_LEGACY_HANDLER; NO_NEW_AUTHORITY","W5 repair strategy drift");
assert(sh(["diff","--name-only",BASE,"HEAD","--",PREDECESSOR])==="","frozen PR-SEC-1 predecessor inventory modified");

const ids=["BSEC-005","BSEC-006","BSEC-007","BSEC-008","BSEC-009","BSEC-010","BSEC-011","BSEC-012","BSEC-013","BSEC-014","BSEC-015","BSEC-016","BSEC-017","BSEC-022","BSEC-023","BSEC-027","BSEC-028","BSEC-029","BSEC-031","BSEC-032","BSEC-033","BSEC-034"];
assert(w5.bounded_predecessor_row_count===22&&w5.bounded_predecessor_rows?.length===22,"W5 bounded row count drift");
assert(JSON.stringify(w5.bounded_predecessor_rows.map(x=>x.surface_id).sort())===JSON.stringify([...ids].sort()),"W5 bounded row set drift");
const predById=new Map((pred.surfaces||[]).map(x=>[x.surface_id,x]));
for(const row of w5.bounded_predecessor_rows){
  const p=predById.get(row.surface_id);assert(p,"missing frozen predecessor row",row.surface_id);
  assert(row.source_path===p.source_path,"W5 predecessor source drift",row.surface_id);
  assert(row.exact_route_or_trigger===p.exact_route_or_trigger,"W5 predecessor route drift",row.surface_id);
  assert(row.http_method_or_runtime_trigger===p.http_method_or_runtime_trigger,"W5 predecessor method drift",row.surface_id);
}
const baselines=w5.governed_regression_baselines||[];
assert(baselines.length===1&&baselines[0].surface_id==="BSEC-030","W5 baseline set drift",baselines);
const p30=predById.get("BSEC-030");assert(p30,"BSEC-030 predecessor missing");
assert(baselines[0].source_path===p30.source_path&&baselines[0].exact_route_or_trigger===p30.exact_route_or_trigger,"BSEC-030 baseline identity drift");

const sourcePaths=[...new Set(w5.bounded_predecessor_rows.map(x=>x.source_path))];
for(const p of sourcePaths)assert(sh(["diff","--name-only",BASE,"HEAD","--",p])==="","W5 rewrote legacy handler semantics",p);
const baselineRegistration="apps/server/src/routes/registerLegacyRoutes.ts";
assert(sh(["diff","--name-only",BASE,"HEAD","--",baselineRegistration])==="","BSEC-030 prior containment source changed");
const baselineSource=read(baselineRegistration);
for(const marker of ["/api/canopy/upload","LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE","reply.code(403)"])assert(baselineSource.includes(marker),"BSEC-030 prior containment baseline drift",marker);

for(const p of ["apps/server/src/domain/auth/roles.ts","config/auth/security_acceptance_tokens.json"])
  assert(sh(["diff","--name-only",BASE,"HEAD","--",p])==="","W5 changed role/token authority",p);

const containment=read("apps/server/src/runtime/legacy_runtime_containment_v1.ts");
for(const row of w5.bounded_predecessor_rows){
  assert(containment.includes(`surface_id: "${row.surface_id}"`),"W5 containment rule missing surface",row.surface_id);
  assert(containment.includes(`route_template: "${row.exact_route_or_trigger}"`),"W5 containment route missing",row.surface_id);
}
assert(!containment.includes('surface_id: "BSEC-030"'),"W5 re-contained governed BSEC-030 baseline");
for(const marker of ["getRuntimeEnvV1","runtime === \"pilot\"","runtime === \"staging\"","runtime === \"production\"","addHook(\"onRequest\"","reply.code(410)","LEGACY_RUNTIME_CONTAINED"])
  assert(containment.includes(marker),"W5 strict-runtime containment marker missing",marker);

const app=read("apps/server/src/app.ts");
assert(app.includes('registerW5LegacyRuntimeContainmentV1(app);'),"W5 containment hook not registered");
const hookIndex=app.indexOf("registerW5LegacyRuntimeContainmentV1(app);");
for(const marker of ["registerDomainModules(app","registerCompatibilityModules(app","registerAdminModule(app"])
  assert(hookIndex>=0&&hookIndex<app.indexOf(marker),"W5 hook registered after legacy/domain/admin handlers",marker);

const w4Dispatcher=read("scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs");
for(const marker of ["f23cc22eb8158a1d9840f042f13ad3fd27b5fe8a","W4 successor","worktree","historical_exact_head_gate_replayed"])
  assert(w4Dispatcher.includes(marker),"W4 successor temporal-boundary dispatcher missing",marker);

const allowed=new Set([
  "apps/server/src/app.ts",
  "apps/server/src/runtime/legacy_runtime_containment_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-BLINE-W5-LEGACY-RUNTIME-CONTAINMENT-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W5_COMMERCIAL_LEGACY_RUNTIME_CONTAINMENT_V1.ts",
  "scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs",
  ".github/workflows/bline-w5-legacy-runtime-containment.yml"
]);
const changed=sh(["diff","--name-only",BASE,"HEAD"]).split(/\r?\n/).filter(Boolean);
for(const p of changed)assert(allowed.has(p),"W5 scope expansion",p);
for(const p of changed)assert(!/mcft/i.test(p),"W5 touched MCFT",p);
for(const p of changed)assert(!/(planner|crop.*latest|action_qualification)/i.test(p),"W5 touched forbidden W6/Action Qualification path",p);
for(const p of [
  "apps/server/src/routes/control_approval_request_v1.ts",
  "apps/server/src/routes/prescriptions_v1.ts",
  "apps/server/src/routes/v1/operator_approval_actions.ts",
  "apps/server/src/routes/control_ao_act.ts",
  "apps/server/src/domain/controlplane/task_service.ts",
  "apps/executor/src/runtime_loop.ts",
  "apps/executor/src/run_dispatch_once.ts"
])assert(!changed.includes(p),"W5 reopened a closed authority domain",p);

console.log(JSON.stringify({
  result:"PASS",
  workstream:"W5_LEGACY_RUNTIME_CONTAINMENT",
  authority_base:BASE,
  bounded_predecessor_row_count:22,
  governed_regression_baselines:["BSEC-030"],
  containment:"STRICT_RUNTIME_EXACT_METHOD_PATH_410_BEFORE_HANDLER",
  legacy_handler_semantics_unchanged:true,
  new_authority_granted:false,
  changed_files:changed,
  mcft_delta:0
},null,2));
