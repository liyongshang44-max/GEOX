#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const INVENTORY = path.join(ROOT, "docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json");
const COMPOSE = path.join(ROOT, "docker-compose.commercial_v1.yml");
const HEARTBEAT_CONTRACT = path.join(ROOT, "docs/contracts/v2/DEVICE_HEARTBEAT_AUTH_CONTRACT_V2.md");

function fail(message, extra) {
  console.error("[BLINE_CALLER_AUTHORITY_INVENTORY] FAIL:", message);
  if (extra !== undefined) console.error(typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
  process.exit(1);
}
function assert(cond, msg, extra) { if (!cond) fail(msg, extra); }
function read(fp) { return fs.readFileSync(fp, "utf8"); }
function exists(fp) { return fs.existsSync(fp) && fs.statSync(fp).isFile(); }

assert(exists(INVENTORY), "inventory missing");
const inv = JSON.parse(read(INVENTORY));
assert(inv.schema_version === "bline_production_caller_authority_inventory_v1", "schema_version mismatch");
assert(inv.canonical_predecessor?.sha === "b6f141c5471cd6f329ba60bd79cf6e4085546264", "canonical predecessor drift");
assert(inv.completion_claim?.bsec0_closed === false, "PR-SEC-1 must not claim B-SEC-0 closed");
assert(inv.completion_claim?.active_graph_fully_disposed === false, "PR-SEC-1 must not claim active graph fully disposed");

const required = inv.required_surface_fields ?? [];
const surfaces = inv.surfaces ?? [];
assert(Array.isArray(surfaces) && surfaces.length > 0, "surfaces missing");
assert(required.length >= 20, "required field contract unexpectedly weak", required);

const ids = new Set();
const identities = new Map();
for (const row of surfaces) {
  assert(typeof row.surface_id === "string" && row.surface_id, "surface_id missing", row);
  assert(!ids.has(row.surface_id), "duplicate surface_id", row.surface_id);
  ids.add(row.surface_id);
  for (const key of required) assert(Object.prototype.hasOwnProperty.call(row, key), "required surface field missing", {surface_id:row.surface_id,key});
  for (const key of ["source_path","entry_symbol","activation_mode","exact_route_or_trigger","activation_root","authn_mode","principal_type","tenant_binding","project_binding","group_binding","field_binding","current_disposition","required_action","sunset_or_cutover_condition"]) {
    assert(typeof row[key] === "string" && row[key].trim(), "required string empty", {surface_id:row.surface_id,key});
  }
  for (const key of ["authz_capability","allowed_roles_or_principals","semantic_family","write_targets","fact_types","downstream_consumers"]) {
    assert(Array.isArray(row[key]), "required array invalid", {surface_id:row.surface_id,key});
  }
  const identity = [row.source_path,row.entry_symbol,row.activation_mode].join("::");
  assert(!identities.has(identity), "entrypoint identity collision", {identity,first:identities.get(identity),second:row.surface_id});
  identities.set(identity,row.surface_id);
}

// Commercial roots must be compose-rooted, not registerDomainModules-rooted.
const compose = read(COMPOSE);
const requiredRootServices = ["postgres","database-platform-bootstrap","mcft-cap07-migration","mqtt","minio","minio-init","server","telemetry-ingest","jobs","executor","web"];
const roots = inv.commercial_activation_roots ?? [];
for (const service of requiredRootServices) {
  assert(roots.some((r) => r.compose_service === service && typeof r.disposition === "string" && r.disposition), "commercial activation root missing disposition", service);
}
assert(compose.includes("node apps/server/dist/server.js"), "commercial server command drift");
assert(compose.includes("node apps/server/dist/jobs/runtime.js"), "commercial jobs command drift");
assert(compose.includes("node apps/executor/dist/runtime_loop.js"), "commercial executor command drift");
assert(compose.includes("apps/telemetry-ingest"), "commercial telemetry-ingest root drift");
assert(/GEOX_DEVTOOLS_ENABLED[^\n]*:-0/.test(compose), "commercial devtools must default disabled");

// Recursively resolve server runtime imports from bootstrap/server.ts and app.ts.
function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [];
  if (/\.js$/.test(base)) candidates.push(base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base);
  else if (/\.mjs$/.test(base)) candidates.push(base.replace(/\.mjs$/, ".ts"), base);
  else candidates.push(base, base+".ts", base+".tsx", path.join(base,"index.ts"));
  return candidates.find(exists) ?? null;
}
function collectRuntimeFiles(entries) {
  const seen = new Set();
  const stack = entries.map((p) => path.resolve(ROOT,p));
  while (stack.length) {
    const fp = stack.pop();
    if (!fp || seen.has(fp) || !exists(fp)) continue;
    seen.add(fp);
    const src = read(fp);
    const re = /(?:import|export)\s+(?:[^"'\x60]*?\s+from\s+)?["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const child = resolveImport(fp,m[1]);
      if (child && child.startsWith(path.join(ROOT,"apps","server","src"))) stack.push(child);
    }
  }
  return seen;
}
const runtimeFiles = collectRuntimeFiles(["apps/server/src/bootstrap/server.ts","apps/server/src/app.ts"]);

function rel(fp) { return path.relative(ROOT,fp).replace(/\\/g,"/"); }
function isCommercialDisabledDevtools(file) {
  const p=rel(file);
  return p.startsWith("apps/server/src/routes/dev/") ||
    p === "apps/server/src/routes/device_simulator_v1.ts" ||
    p === "apps/server/src/routes/sim_config.ts";
}
const discovered=[];
const unresolvedDynamic=[];
for (const fp of runtimeFiles) {
  if (!fp.endsWith(".ts") && !fp.endsWith(".tsx")) continue;
  if (isCommercialDisabledDevtools(fp)) continue;
  const source=read(fp);
  const p=rel(fp);
  const literal=/\bapp\.(post|put|patch|delete)\s*\(\s*["'\x60]([^"'\x60]+)["'\x60]/gms;
  let m;
  while ((m=literal.exec(source))) discovered.push({source_path:p,method:m[1].toUpperCase(),route:m[2]});
  if (p === "apps/server/src/routes/programs_core_v1.ts") {
    const helper=/\bpost\s*\(\s*["'\x60]([^"'\x60]+)["'\x60]/gms;
    while ((m=helper.exec(source))) discovered.push({source_path:p,method:"POST",route:m[1]});
  }
  if (p === "apps/server/src/routes/control_ao_act.ts") {
    if (source.includes('app.post(legacyAoActRouteV1("task")')) discovered.push({source_path:p,method:"POST",route:"/api/control/ao_act/task"});
    if (source.includes('app.post(legacyAoActRouteV1("receipt")')) discovered.push({source_path:p,method:"POST",route:"/api/control/ao_act/receipt"});
  }
  const dynamic=/\bapp\.(post|put|patch|delete)\s*\(\s*(?!["'\x60])([^,\n]+)/g;
  while ((m=dynamic.exec(source))) unresolvedDynamic.push({source_path:p,method:m[1].toUpperCase(),expression:m[2].trim()});
}

// Known registration indirections are allowed only because exact underlying entries are separately inventoried.
const dynamicAllow = [
  ["apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts","path"],
  ["apps/server/src/routes/control_ao_act.ts",'legacyAoActRouteV1("task")'],
  ["apps/server/src/routes/control_ao_act.ts",'legacyAoActRouteV1("receipt")'],
  ["apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts","DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1"]
];
const unexpectedDynamic = unresolvedDynamic.filter((d) =>
  !dynamicAllow.some(([p,e]) => d.source_path===p && d.expression.startsWith(e))
);
assert(unexpectedDynamic.length===0, "unresolved production mutation route expressions require explicit audit disposition", unexpectedDynamic);

const httpRows = surfaces.filter((r)=>r.activation_mode==="HTTP_ROUTE");
const missing=[];
for (const d of discovered) {
  const found=httpRows.some((r)=>r.source_path===d.source_path && r.http_method_or_runtime_trigger===d.method && r.exact_route_or_trigger===d.route);
  if(!found) missing.push(d);
}
assert(missing.length===0, "production-reachable literal mutation routes missing from entrypoint inventory", missing);

// Sentinel truth: known unauthenticated/weak routes must remain recorded as debt until a later PR changes runtime.
function rowByRoute(route) { return httpRows.find((r)=>r.exact_route_or_trigger===route); }
for(const route of [
 "/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
 "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
 "/api/v1/weather/forecast/ingest",
 "/api/v1/sense/task",
 "/api/v1/sense/receipt",
 "/api/admin/import/caf_hourly"
]) {
  const r=rowByRoute(route);
  assert(r && r.runtime_reachable===true, "required B-SEC sentinel missing", route);
  assert(["UNAUTHENTICATED_PRODUCTION_WRITER","UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER","CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE"].includes(r.caller_authority_status), "sentinel incorrectly classified as governed", {route,status:r?.caller_authority_status});
}
for(const route of ["/api/raw","/api/agronomy/v0/ao_act/interpretation","/api/agronomy/interpretation_v1/append"]) {
  const r=rowByRoute(route);
  assert(r?.caller_authority_status==="WEAK_INTERNAL_BOUNDARY", "__internal__ writer must be WEAK_INTERNAL_BOUNDARY", route);
}

const heartbeat=rowByRoute("/api/v1/devices/:device_id/heartbeat");
assert(heartbeat?.contract_refs?.includes("docs/contracts/v2/DEVICE_HEARTBEAT_AUTH_CONTRACT_V2.md"), "heartbeat contract debt missing from inventory");
const hbContract=read(HEARTBEAT_CONTRACT);
assert(hbContract.includes("Status: Transitional / Acceptance-Compatible"), "heartbeat contract status drift");
assert(hbContract.includes("device.heartbeat.write"), "heartbeat production target capability drift");
assert(heartbeat.caller_authority_status==="CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE", "heartbeat inventory must expose production security non-completion");

// Subprocess reachability promotion sentinel.
const sub=inv.subprocess_edges ?? [];
const caf=sub.find((e)=>e.source_path==="apps/server/src/modules/admin/registerAdminImportModule.ts" && e.entry_symbol==="POST /api/admin/import/caf_hourly");
assert(caf && caf.runtime_reachable===true && caf.invocation_kind==="spawn" && caf.target_path==="scripts/loadfact.ts", "CAF import production subprocess edge missing");
assert(caf.target_directory_classification==="AUX_BY_PATH_BUT_PROMOTED_BY_PRODUCTION_EDGE", "AUX runtime promotion classification missing");

// Entrypoint-level mixed-file sentinels.
assert(surfaces.some((r)=>r.source_path==="apps/server/src/routes/human_ops_v1.ts" && r.entry_symbol==="startHumanOpsKpiRefreshWorker" && r.activation_mode==="BACKGROUND_WORKER"), "human_ops worker must be separate entrypoint surface");
assert(surfaces.some((r)=>r.source_path==="apps/server/src/routes/human_executors_v1.ts" && r.entry_symbol==="startAssignmentExpiryWorker" && r.activation_mode==="BACKGROUND_WORKER"), "human_executors worker must be separate entrypoint surface");
assert(surfaces.some((r)=>r.source_path==="apps/server/src/routes/human_executors_v1.ts" && r.activation_mode==="HTTP_ROUTE"), "human_executors API surface missing");

// Server worker activation exact sentinels.
const workers=read(path.join(ROOT,"apps/server/src/bootstrap/workers.ts"));
for(const symbol of ["startOfflineAlertWorker","startAlertNotificationWorker","startAssignmentExpiryWorker","startHumanOpsKpiRefreshWorker"]) {
  assert(workers.includes(symbol), "worker activation drift", symbol);
  assert(surfaces.some((r)=>r.entry_symbol===symbol), "active worker missing inventory disposition", symbol);
}

// Telemetry/executor/jobs roots must have explicit service-principal inventory.
for(const p of ["apps/telemetry-ingest/src/main.ts","apps/executor/src/runtime_loop.ts","apps/server/src/jobs/runtime.ts"]) {
  assert(surfaces.some((r)=>r.source_path===p && r.runtime_reachable===true), "production service writer/root missing surface inventory", p);
}

// Compute B-SEC-0 debt counters. PR-SEC-1 should expose, not zero or hide, them.
const reachable=surfaces.filter((r)=>r.runtime_reachable===true);
const unauth=reachable.filter((r)=>["UNAUTHENTICATED_PRODUCTION_WRITER","UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER","WEAK_INTERNAL_BOUNDARY","CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE"].includes(r.caller_authority_status));
const noCap=reachable.filter((r)=>r.authz_capability.length===0 || ["UNAUTHENTICATED_PRODUCTION_WRITER","UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER","WEAK_INTERNAL_BOUNDARY","CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE","AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY","AUTHENTICATED_BUT_CAPABILITY_MISMATCH","AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY"].includes(r.caller_authority_status));
const unverifiedActor=reachable.filter((r)=>String(r.declared_actor_binding||"").includes("CALLER_DECLARED_NOT_AUTH_BOUND"));
const serviceUnbound=reachable.filter((r)=>r.principal_type.includes("SERVICE") && ["SERVICE_IDENTITY_PARTIAL"].includes(r.caller_authority_status));
const untrustedTenant=reachable.filter((r)=>r.tenant_scope_from_untrusted_body===true);

assert(unauth.length>0, "PR-SEC-1 must not hide known unauthenticated debt");
assert(noCap.length>0, "PR-SEC-1 must not hide known capability debt");
assert(unverifiedActor.length>0, "PR-SEC-1 must expose declared-actor debt");
assert(serviceUnbound.length>0, "PR-SEC-1 must expose service-principal debt");
assert(untrustedTenant.length>0, "PR-SEC-1 must expose caller-controlled tenant debt");

const summary={
  ok:true,
  suite:"ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1",
  inventory_status:inv.status,
  surface_count:surfaces.length,
  reachable_surface_count:reachable.length,
  commercial_root_count:roots.length,
  discovered_literal_http_mutation_count:discovered.length,
  subprocess_edge_count:sub.length,
  bsec0_closed:false,
  debt_counters:{
    production_reachable_mutating_surface_without_authn:unauth.length,
    production_reachable_semantic_writer_without_validated_capability:noCap.length,
    production_reachable_human_action_with_unverified_declared_actor:unverifiedActor.length,
    production_reachable_service_writer_without_bound_principal:serviceUnbound.length,
    tenant_scope_from_untrusted_body_or_unbound:untrustedTenant.length
  }
};
console.log(JSON.stringify(summary,null,2));
console.log("[BLINE_CALLER_AUTHORITY_INVENTORY] PASS");
