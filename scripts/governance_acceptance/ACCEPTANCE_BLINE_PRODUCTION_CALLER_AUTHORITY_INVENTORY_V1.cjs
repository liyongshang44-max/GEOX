#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

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
assert(compose.includes('command: ["node", "apps/server/dist/server.js"]'), "commercial server command drift");
assert(compose.includes('command: ["node", "apps/server/dist/jobs/runtime.js"]'), "commercial jobs command drift");
assert(compose.includes('command: ["node", "apps/executor/dist/runtime_loop.js"]'), "commercial executor command drift");
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
  const rawSource=read(fp);
  // Ignore full-line comments before route discovery so deprecated/commented routes
  // cannot become phantom production surfaces.
  const source=rawSource.split(/\r?\n/).map((line)=>/^\s*\/\//.test(line) ? "" : line).join("\n");
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
const unexpectedDynamic = unresolvedDynamic.filter((d) => {
  const expr = String(d.expression ?? "").trim();
  if (/^["'`]/.test(expr)) return false; // multiline literal already handled by literal scanner
  if (d.source_path === "apps/server/src/routes/programs_core_v1.ts" && expr === "path") return false; // local post(path, handler) wrapper; exact paths are scanned from post("...")
  return !dynamicAllow.some(([p,e]) => d.source_path===p && expr.startsWith(e));
});
assert(unexpectedDynamic.length===0, "unresolved production mutation route expressions require explicit audit disposition", unexpectedDynamic);

const httpRows = surfaces.filter((r)=>r.activation_mode==="HTTP_ROUTE");
const nonAuthority = inv.non_authority_method_dispositions ?? [];
for (const x of nonAuthority) {
  assert(typeof x.source_path==="string" && typeof x.http_method==="string" && typeof x.exact_route==="string" && typeof x.reason==="string" && x.reason.trim(), "invalid non-authority method disposition", x);
}
const missing=[];
for (const d of discovered) {
  const found=httpRows.some((r)=>r.source_path===d.source_path && r.http_method_or_runtime_trigger===d.method && r.exact_route_or_trigger===d.route);
  const explicitlyNonAuthority=nonAuthority.some((r)=>r.source_path===d.source_path && r.http_method===d.method && r.exact_route===d.route);
  if(!found && !explicitlyNonAuthority) missing.push(d);
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


// PR-SEC-1 reopened coverage closure.
// This scanner starts from every production-reachable HTTP entrypoint regardless of method,
// then independently closes non-HTTP runtime direct writers and registration/startup mutations.

const covAllowedHttpClasses = new Set([
  "PURE_READ",
  "SCHEMA_ENSURE_ONLY",
  "PROJECTION_SIDE_EFFECT",
  "DOMAIN_STATE_SIDE_EFFECT",
  "FACT_LEDGER_WRITE",
]);

function covSqlEffect(text) {
  const s = String(text || "");
  const dml =
    /\bINSERT\s+INTO\b/i.test(s) ||
    /\bDELETE\s+FROM\b/i.test(s) ||
    /\bUPDATE\s+(?:(?:ONLY\s+)?["A-Za-z_])/i.test(s) ||
    /\bTRUNCATE(?:\s+TABLE)?\b/i.test(s) ||
    /\bMERGE\s+INTO\b/i.test(s);
  const ddl =
    /\bCREATE\s+TABLE\b/i.test(s) ||
    /\bALTER\s+TABLE\b/i.test(s) ||
    /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(s) ||
    /\bDROP\s+(?:TABLE|INDEX)\b/i.test(s);
  const fact =
    /\bINSERT\s+INTO\s+(?:public\.)?facts\b/i.test(s) ||
    /\bUPDATE\s+(?:public\.)?facts\b/i.test(s) ||
    /\bDELETE\s+FROM\s+(?:public\.)?facts\b/i.test(s);
  return { dml, ddl, fact };
}

function covCollectGraphFiles(entries, allowedPrefixes) {
  const out = new Set();
  const stack = entries.map((p) => path.resolve(ROOT, p));
  const prefixes = allowedPrefixes.map((p) => path.resolve(ROOT, p));
  while (stack.length) {
    const fp = stack.pop();
    if (!fp || out.has(fp) || !exists(fp)) continue;
    if (!prefixes.some((prefix) => fp.startsWith(prefix))) continue;
    out.add(fp);
    const src = read(fp);
    const specs = [];
    const importRe = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
    const requireRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
    let m;
    while ((m = importRe.exec(src))) specs.push(m[1]);
    while ((m = requireRe.exec(src))) specs.push(m[1]);
    for (const spec of specs) {
      const child = resolveImport(fp, spec);
      if (child) stack.push(child);
    }
  }
  return out;
}

const covExtraFiles = covCollectGraphFiles(
  [
    "apps/server/src/jobs/runtime.ts",
    "apps/server/src/bootstrap/workers.ts",
    "apps/executor/src/runtime_loop.ts",
    "apps/telemetry-ingest/src/main.ts",
  ],
  ["apps/server/src", "apps/executor/src", "apps/telemetry-ingest/src"],
);
const covFiles = new Set([...runtimeFiles, ...covExtraFiles]);

const covModules = new Map();

function covBuildModule(fp) {
  if (covModules.has(fp)) return covModules.get(fp);
  const sourceText = read(fp);
  const sf = ts.createSourceFile(
    rel(fp),
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fp.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const mod = {
    fp,
    sf,
    functions: new Map(),
    imports: new Map(),
    aliases: new Map(),
    reexports: [],
  };
  covModules.set(fp, mod);

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      mod.functions.set(stmt.name.text, stmt);
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          mod.functions.set(decl.name.text, decl.initializer);
        }
      }
    }
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const child = resolveImport(fp, stmt.moduleSpecifier.text);
      if (!child) continue;
      const clause = stmt.importClause;
      if (clause?.name) mod.imports.set(clause.name.text, { fp: child, name: "default" });
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          mod.imports.set(el.name.text, { fp: child, name: el.propertyName?.text || el.name.text });
        }
      }
    }
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) && !stmt.exportClause) {
      const child = resolveImport(fp, stmt.moduleSpecifier.text);
      if (child) mod.reexports.push(child);
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!decl.initializer || !ts.isObjectBindingPattern(decl.name)) continue;
        if (!ts.isCallExpression(decl.initializer) || !ts.isIdentifier(decl.initializer.expression) || decl.initializer.expression.text !== "require") continue;
        const specArg = decl.initializer.arguments[0];
        if (!specArg || !ts.isStringLiteral(specArg)) continue;
        const child = resolveImport(fp, specArg.text);
        if (!child) continue;
        for (const el of decl.name.elements) {
          if (!ts.isIdentifier(el.name)) continue;
          const imported = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
          mod.imports.set(el.name.text, { fp: child, name: imported });
        }
      }
    }
  }

  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) continue;
      const targets = [];
      function walk(n) {
        if (ts.isIdentifier(n) && mod.imports.has(n.text)) targets.push(mod.imports.get(n.text));
        ts.forEachChild(n, walk);
      }
      walk(decl.initializer);
      const uniq = new Map(targets.map((t) => [t.fp + "::" + t.name, t]));
      if (uniq.size === 1) mod.aliases.set(decl.name.text, [...uniq.values()][0]);
    }
  }

  return mod;
}

for (const fp of covFiles) {
  if ((fp.endsWith(".ts") || fp.endsWith(".tsx")) && exists(fp)) covBuildModule(fp);
}

function covFindReexport(fp, name, seen = new Set()) {
  const token = fp + "::" + name;
  if (seen.has(token)) return null;
  seen.add(token);
  const mod = covBuildModule(fp);
  if (mod.functions.has(name)) return { fp, name };
  for (const child of mod.reexports) {
    const hit = covFindReexport(child, name, seen);
    if (hit) return hit;
  }
  return null;
}

function covResolveFunction(fp, name) {
  const mod = covBuildModule(fp);
  if (mod.functions.has(name)) return { fp, name };
  if (mod.aliases.has(name)) {
    const t = mod.aliases.get(name);
    return covFindReexport(t.fp, t.name) || t;
  }
  if (mod.imports.has(name)) {
    const t = mod.imports.get(name);
    return covFindReexport(t.fp, t.name) || t;
  }

  // Registration-scope aliases are not module declarations, but they still form
  // real production call edges. Keep these exact and fail-closed rather than
  // treating an unresolved local alias as a read.
  const p = rel(fp);
  if (
    name === "refreshFieldReadModels" &&
    (p === "apps/server/src/routes/dashboard_v1.ts" || p === "apps/server/src/routes/fields_v1.ts")
  ) {
    const imported = mod.imports.get("refreshFieldReadModelsWithObservabilityV1");
    if (imported) return covFindReexport(imported.fp, imported.name) || imported;
  }
  if (name === "projectOperationState" && p === "apps/server/src/routes/dashboard_v1.ts") {
    const imported = mod.imports.get("projectOperationStateV1");
    if (imported) return covFindReexport(imported.fp, imported.name) || imported;
  }
  return null;
}

function covFunctionKey(t) {
  return rel(t.fp) + "::" + t.name;
}

const covAnalysisCache = new Map();

function covAllowWriteFalse(call) {
  if (!call.arguments || call.arguments.length < 1) return false;
  for (const arg of call.arguments) {
    if (!ts.isObjectLiteralExpression(arg)) continue;
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : "";
      if (name === "allow_write" && prop.initializer.kind === ts.SyntaxKind.FalseKeyword) return true;
    }
  }
  return false;
}

function covAnalyzeNode(fp, node, stack = new Set()) {
  const direct = covSqlEffect(node.getText(covBuildModule(fp).sf));
  const result = {
    dml: direct.dml,
    ddl: direct.ddl,
    fact: direct.fact,
    directWriterKeys: new Set(),
    callees: new Set(),
  };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(rel(fp) + "::" + "<inline>");

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys) result.directWriterKeys.add(k);
    for (const k of other.callees) result.callees.add(k);
  }

  function walk(n) {
    if (ts.isCallExpression(n)) {
      let name = null;
      if (ts.isIdentifier(n.expression)) name = n.expression.text;
      if (name) {
        if (!(name === "ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
          const target = covResolveFunction(fp, name);
          if (target) {
            const key = covFunctionKey(target);
            result.callees.add(key);
            merge(covAnalyzeFunction(target, stack));
          }
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return result;
}

function covAnalyzeFunction(target, stack = new Set()) {
  const key = covFunctionKey(target);
  if (covAnalysisCache.has(key)) return covAnalysisCache.get(key);
  if (stack.has(key)) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set() };
  const next = new Set(stack);
  next.add(key);
  const mod = covBuildModule(target.fp);
  const node = mod.functions.get(target.name);
  if (!node) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set() };
  const direct = covSqlEffect(node.getText(mod.sf));
  const result = { dml:direct.dml, ddl:direct.ddl, fact:direct.fact, directWriterKeys:new Set(), callees:new Set() };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(key);

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys) result.directWriterKeys.add(k);
    for (const k of other.callees) result.callees.add(k);
  }
  function walk(n) {
    if (ts.isCallExpression(n)) {
      let name = null;
      if (ts.isIdentifier(n.expression)) name = n.expression.text;
      if (name && !(name === "ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
        const child = covResolveFunction(target.fp, name);
        if (child) {
          const childKey = covFunctionKey(child);
          result.callees.add(childKey);
          merge(covAnalyzeFunction(child, next));
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  covAnalysisCache.set(key, result);
  return result;
}

const covHttpDispositions = inv.http_entrypoint_dispositions ?? [];
for (const d of covHttpDispositions) {
  assert(typeof d.source_path === "string" && d.source_path, "invalid HTTP disposition source_path", d);
  assert(typeof d.http_method === "string" && d.http_method, "invalid HTTP disposition method", d);
  assert(typeof d.exact_route === "string" && d.exact_route, "invalid HTTP disposition route", d);
  assert(covAllowedHttpClasses.has(d.side_effect_class), "invalid HTTP side-effect class", d);
}
const covHttpDispositionKey = new Map(covHttpDispositions.map((d) => [
  d.source_path + "::" + d.http_method + "::" + d.exact_route,
  d,
]));

const covAllHttp = [];
for (const fp of runtimeFiles) {
  if (!fp.endsWith(".ts") && !fp.endsWith(".tsx")) continue;
  if (isCommercialDisabledDevtools(fp)) continue;
  const mod = covBuildModule(fp);
  function visit(n) {
    if (ts.isCallExpression(n)) {
      let method = null;
      let isRoute = false;
      if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "app") {
        const candidate = n.expression.name.text.toUpperCase();
        if (["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(candidate)) {
          method = candidate;
          isRoute = true;
        }
      } else if (rel(fp) === "apps/server/src/routes/programs_core_v1.ts" && ts.isIdentifier(n.expression)) {
        const candidate = n.expression.text.toUpperCase();
        if (["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(candidate)) {
          method = candidate;
          isRoute = true;
        }
      }
      if (isRoute) {
        const routeArg = n.arguments[0];
        const route = routeArg && (ts.isStringLiteral(routeArg) || ts.isNoSubstitutionTemplateLiteral(routeArg))
          ? routeArg.text
          : null;
        if (route) {
          const handler = n.arguments[n.arguments.length - 1];
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set() };
          if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
            analysis = covAnalyzeNode(fp, handler);
          } else if (handler && ts.isIdentifier(handler)) {
            const target = covResolveFunction(fp, handler.text);
            if (target) analysis = covAnalyzeFunction(target);
          }
          covAllHttp.push({
            source_path: rel(fp),
            method,
            route,
            dml: analysis.dml,
            ddl: analysis.ddl,
            fact: analysis.fact,
            writers: [...analysis.directWriterKeys],
          });
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(mod.sf);
}
const covHttpUnique = [...new Map(covAllHttp.map((r) => [r.source_path+"::"+r.method+"::"+r.route, r])).values()];

const covCallerMissing = [];
const covHttpClassMismatch = [];
let covPureReadCount = 0;
for (const r of covHttpUnique) {
  const key = r.source_path + "::" + r.method + "::" + r.route;
  const surfaceCovered = surfaces.some((s) =>
    s.activation_mode === "HTTP_ROUTE" &&
    s.source_path === r.source_path &&
    s.http_method_or_runtime_trigger === r.method &&
    s.exact_route_or_trigger === r.route
  );
  const nonAuthorityCovered = nonAuthority.some((d) =>
    d.source_path === r.source_path &&
    d.http_method === r.method &&
    d.exact_route === r.route
  );
  const disposition = covHttpDispositionKey.get(key);
  const hasWrite = r.dml || r.ddl;
  if (!hasWrite && ["GET","HEAD","OPTIONS"].includes(r.method)) covPureReadCount += 1;
  if (hasWrite && !surfaceCovered && !disposition) covCallerMissing.push(r);
  if (["POST","PUT","PATCH","DELETE"].includes(r.method) && !surfaceCovered && !nonAuthorityCovered && !disposition) covCallerMissing.push(r);
  if (disposition) {
    const cls = disposition.side_effect_class;
    if (cls === "PURE_READ" && hasWrite) covHttpClassMismatch.push({route:r, disposition});
    if (cls === "SCHEMA_ENSURE_ONLY" && (!r.ddl || r.dml)) covHttpClassMismatch.push({route:r, disposition});
    if (cls === "FACT_LEDGER_WRITE" && !r.fact) covHttpClassMismatch.push({route:r, disposition});
    if ((cls === "PROJECTION_SIDE_EFFECT" || cls === "DOMAIN_STATE_SIDE_EFFECT") && !r.dml) covHttpClassMismatch.push({route:r, disposition});
  }
}
assert(covHttpClassMismatch.length === 0, "HTTP side-effect disposition does not match reachable write behavior", covHttpClassMismatch);
assert(covCallerMissing.length === 0, "production caller-triggered mutation without inventory", covCallerMissing);

const covStartupDispositions = inv.startup_mutation_dispositions ?? [];
const covStartupMissing = [];
const covStartupSeen = [];
for (const fp of runtimeFiles) {
  if (!fp.endsWith(".ts") && !fp.endsWith(".tsx")) continue;
  if (isCommercialDisabledDevtools(fp)) continue;
  const mod = covBuildModule(fp);
  for (const [fnName, fnNode] of mod.functions) {
    if (!/^register[A-Z].*(?:Routes|Module)$/.test(fnName)) continue;
    function walkStartup(n) {
      if (n !== fnNode && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n))) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^ensure[A-Z]/.test(n.expression.text)) {
        const target = covResolveFunction(fp, n.expression.text);
        if (target) {
          const analysis = covAnalyzeFunction(target);
          if (analysis.dml || analysis.ddl) {
            const registrationRef = rel(fp) + "#" + fnName;
            const targetPath = rel(target.fp);
            const match = covStartupDispositions.find((d) =>
              d.source_path === targetPath &&
              d.entry_symbol === target.name &&
              Array.isArray(d.registration_sources) &&
              d.registration_sources.includes(registrationRef)
            );
            const row = {
              registration_source: registrationRef,
              source_path: targetPath,
              entry_symbol: target.name,
              observed_class: analysis.dml ? "STARTUP_PROJECTION_BOOTSTRAP" : "STARTUP_SCHEMA_BOOTSTRAP",
              dml: analysis.dml,
              ddl: analysis.ddl,
              fact: analysis.fact,
            };
            covStartupSeen.push(row);
            if (!match) covStartupMissing.push(row);
          }
        }
      }
      ts.forEachChild(n, walkStartup);
    }
    walkStartup(fnNode);
  }
}
const covStartupUnique = [...new Map(covStartupSeen.map((x) => [x.registration_source+"::"+x.source_path+"::"+x.entry_symbol, x])).values()];
const covStartupMissingUnique = [...new Map(covStartupMissing.map((x) => [x.registration_source+"::"+x.source_path+"::"+x.entry_symbol, x])).values()];
assert(covStartupMissingUnique.length === 0, "startup mutation without explicit disposition", covStartupMissingUnique);

const covRuntimeDispositions = inv.runtime_direct_writer_dispositions ?? [];
const covRuntimeRoots = [
  "apps/server/src/jobs/runtime.ts",
  "apps/server/src/bootstrap/workers.ts",
  "apps/executor/src/runtime_loop.ts",
  "apps/telemetry-ingest/src/main.ts",
];
const covRuntimeWriterKeys = new Set();
for (const rootRel of covRuntimeRoots) {
  const rootAbs = path.resolve(ROOT, rootRel);
  if (!exists(rootAbs)) continue;
  const mod = covBuildModule(rootAbs);
  for (const [name] of mod.functions) {
    const analysis = covAnalyzeFunction({ fp: rootAbs, name });
    for (const key of analysis.directWriterKeys) covRuntimeWriterKeys.add(key);
  }
}
const covRuntimeMissing = [];
for (const key of covRuntimeWriterKeys) {
  const split = key.lastIndexOf("::");
  const sourcePath = key.slice(0, split);
  const symbol = key.slice(split + 2);
  if (symbol === "<inline>") continue;
  const explicit = covRuntimeDispositions.some((d) => d.source_path === sourcePath && d.entry_symbol === symbol);
  const surface = surfaces.some((s) =>
    s.source_path === sourcePath &&
    s.entry_symbol === symbol &&
    s.activation_mode !== "HTTP_ROUTE"
  );
  const startup = covStartupDispositions.some((d) => d.source_path === sourcePath && d.entry_symbol === symbol);
  if (!explicit && !surface && !startup) {
    covRuntimeMissing.push({
      source_path: sourcePath,
      entry_symbol: symbol,
      foreign_mcft: /(?:^|\/)mcft(?:_|\/)|MCFT/i.test(sourcePath + "::" + symbol),
    });
  }
}
assert(covRuntimeMissing.length === 0, "production runtime direct writer without inventory", covRuntimeMissing);

const covZeroSets = {
  production_caller_triggered_mutation_without_inventory: covCallerMissing.length,
  production_runtime_direct_writer_without_inventory: covRuntimeMissing.length,
  startup_mutation_without_explicit_disposition: covStartupMissingUnique.length,
};

const summary={
  ok:true,
  suite:"ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1",
  inventory_status:inv.status,
  surface_count:surfaces.length,
  reachable_surface_count:reachable.length,
  commercial_root_count:roots.length,
  discovered_literal_http_mutation_count:discovered.length,
  explicitly_non_authority_http_method_count:nonAuthority.length,
  subprocess_edge_count:sub.length,
  discovered_all_http_entrypoint_count:covHttpUnique.length,
  discovered_get_entrypoint_count:covHttpUnique.filter((r)=>r.method==="GET").length,
  auto_pure_read_http_count:covPureReadCount,
  explicit_http_side_effect_disposition_count:covHttpDispositions.length,
  startup_mutation_disposition_count:covStartupDispositions.length,
  runtime_direct_writer_disposition_count:covRuntimeDispositions.length,
  coverage_zero_sets:covZeroSets,
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
