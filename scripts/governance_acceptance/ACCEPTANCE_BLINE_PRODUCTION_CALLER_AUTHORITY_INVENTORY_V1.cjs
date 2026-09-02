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

function covImmediatelyInvokedFunction(n) {
  let p = n.parent;
  while (p && ts.isParenthesizedExpression(p)) p = p.parent;
  return Boolean(p && ts.isCallExpression(p) && p.expression === (ts.isParenthesizedExpression(n.parent) ? n.parent : n));
}

function covDirectSqlEffect(fp, rootNode) {
  const mod = covBuildModule(fp);
  const sf = mod.sf;
  const sqlBindings = new Map();

  function collectBindings(n) {
    if (
      n !== rootNode &&
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      !covImmediatelyInvokedFunction(n)
    ) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer) || ts.isTemplateExpression(n.initializer)) {
        sqlBindings.set(n.name.text, n.initializer.getText(sf));
      }
    }
    ts.forEachChild(n, collectBindings);
  }
  collectBindings(rootNode);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (ts.isStringLiteral(decl.initializer) || ts.isNoSubstitutionTemplateLiteral(decl.initializer) || ts.isTemplateExpression(decl.initializer)) {
        sqlBindings.set(decl.name.text, decl.initializer.getText(sf));
      }
    }
  }

  const result = { dml:false, ddl:false, fact:false };
  function merge(effect) {
    result.dml = result.dml || effect.dml;
    result.ddl = result.ddl || effect.ddl;
    result.fact = result.fact || effect.fact;
  }
  function visit(n) {
    if (
      n !== rootNode &&
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      !covImmediatelyInvokedFunction(n)
    ) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "query" &&
      n.arguments.length > 0
    ) {
      const arg = n.arguments[0];
      let sql = "";
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) || ts.isTemplateExpression(arg)) {
        sql = arg.getText(sf);
      } else if (ts.isIdentifier(arg) && sqlBindings.has(arg.text)) {
        sql = sqlBindings.get(arg.text);
      }
      if (sql) merge(covSqlEffect(sql));
    }
    ts.forEachChild(n, visit);
  }
  visit(rootNode);
  return result;
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
  const direct = covDirectSqlEffect(fp, node);
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
  const direct = covDirectSqlEffect(target.fp, node);
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
const covDynamicHttp = [];
const covUnsupportedRouteRegistrations = [];
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
        if (["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS","ALL"].includes(candidate)) {
          method = candidate;
          isRoute = true;
        }
      } else if (rel(fp) === "apps/server/src/routes/programs_core_v1.ts" && ts.isIdentifier(n.expression)) {
        const candidate = n.expression.text.toUpperCase();
        if (["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS","ALL"].includes(candidate)) {
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
        } else {
          const handler = n.arguments[n.arguments.length - 1];
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set() };
          if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
            analysis = covAnalyzeNode(fp, handler);
          } else if (handler && ts.isIdentifier(handler)) {
            const target = covResolveFunction(fp, handler.text);
            if (target) analysis = covAnalyzeFunction(target);
          }
          covDynamicHttp.push({
            source_path: rel(fp),
            method,
            expression: routeArg ? routeArg.getText(mod.sf) : "<missing>",
            dml: analysis.dml,
            ddl: analysis.ddl,
            fact: analysis.fact,
            writers: [...analysis.directWriterKeys],
          });
        }
      }
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "app" &&
      n.expression.name.text === "route"
    ) {
      const cfg = n.arguments[0];
      let parsed = false;
      if (cfg && ts.isObjectLiteralExpression(cfg)) {
        const prop = (name) => cfg.properties.find((p) =>
          ts.isPropertyAssignment(p) &&
          ((ts.isIdentifier(p.name) && p.name.text === name) || (ts.isStringLiteral(p.name) && p.name.text === name))
        );
        const methodProp = prop("method");
        const urlProp = prop("url");
        const handlerProp = prop("handler");
        const methods = [];
        if (methodProp && ts.isPropertyAssignment(methodProp)) {
          const v = methodProp.initializer;
          if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) {
            methods.push(v.text.toUpperCase());
          } else if (ts.isArrayLiteralExpression(v)) {
            for (const el of v.elements) {
              if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) methods.push(el.text.toUpperCase());
            }
          }
        }
        const route = urlProp && ts.isPropertyAssignment(urlProp) &&
          (ts.isStringLiteral(urlProp.initializer) || ts.isNoSubstitutionTemplateLiteral(urlProp.initializer))
          ? urlProp.initializer.text
          : null;
        const handler = handlerProp && ts.isPropertyAssignment(handlerProp) ? handlerProp.initializer : null;
        if (route && methods.length && handler) {
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set() };
          if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
            analysis = covAnalyzeNode(fp, handler);
          } else if (ts.isIdentifier(handler)) {
            const target = covResolveFunction(fp, handler.text);
            if (target) analysis = covAnalyzeFunction(target);
          }
          for (const method of methods) {
            if (!["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS","ALL"].includes(method)) {
              covUnsupportedRouteRegistrations.push({ source_path:rel(fp), expression:n.getText(mod.sf).slice(0,240), reason:"UNSUPPORTED_METHOD" });
              continue;
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
          parsed = true;
        }
      }
      if (!parsed) {
        covUnsupportedRouteRegistrations.push({ source_path: rel(fp), expression: n.getText(mod.sf).slice(0, 240), reason:"DYNAMIC_OR_UNSUPPORTED_APP_ROUTE" });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(mod.sf);
}
const covHttpUnique = [...new Map(covAllHttp.map((r) => [r.source_path+"::"+r.method+"::"+r.route, r])).values()];

const covDynamicDispositions = inv.dynamic_http_registration_dispositions ?? [];
for (const d of covDynamicDispositions) {
  assert(typeof d.source_path === "string" && d.source_path, "invalid dynamic HTTP disposition source_path", d);
  assert(typeof d.http_method === "string" && d.http_method, "invalid dynamic HTTP disposition method", d);
  assert(typeof d.expression === "string" && d.expression, "invalid dynamic HTTP disposition expression", d);
  assert(covAllowedHttpClasses.has(d.side_effect_class), "invalid dynamic HTTP side-effect class", d);
  assert(Array.isArray(d.exact_routes), "invalid dynamic HTTP exact_routes", d);
}
const covDynamicDispositionKey = new Map(covDynamicDispositions.map((d) => [
  d.source_path + "::" + d.http_method + "::" + d.expression,
  d,
]));
const covUnexpectedDynamicHttp = [];
const covDynamicClassMismatch = [];
for (const d of covDynamicHttp) {
  const key = d.source_path + "::" + d.method + "::" + d.expression;
  const disposition = covDynamicDispositionKey.get(key);
  if (!disposition) {
    covUnexpectedDynamicHttp.push(d);
    continue;
  }
  const hasWrite = d.dml || d.ddl;
  const exactSurfaceIds = Array.isArray(disposition.exact_surface_ids) ? disposition.exact_surface_ids : [];
  const exactSurfaceRows = exactSurfaceIds.map((id) => surfaces.find((x) => x.surface_id === id)).filter(Boolean);
  if (exactSurfaceIds.length) {
    assert(exactSurfaceRows.length === exactSurfaceIds.length, "dynamic HTTP disposition references missing exact surface", {route:d, disposition});
  }
  const delegatedEffect = exactSurfaceRows.some((row) => Array.isArray(row.write_targets) && row.write_targets.length > 0);
  if (disposition.side_effect_class === "PURE_READ" && hasWrite) covDynamicClassMismatch.push({route:d, disposition});
  if (disposition.side_effect_class === "SCHEMA_ENSURE_ONLY" && (!d.ddl || d.dml) && !delegatedEffect) covDynamicClassMismatch.push({route:d, disposition});
  if (disposition.side_effect_class === "FACT_LEDGER_WRITE" && !d.fact && !delegatedEffect) covDynamicClassMismatch.push({route:d, disposition});
  if ((disposition.side_effect_class === "PROJECTION_SIDE_EFFECT" || disposition.side_effect_class === "DOMAIN_STATE_SIDE_EFFECT") && !d.dml && !delegatedEffect) covDynamicClassMismatch.push({route:d, disposition});
  if (disposition.side_effect_class !== "PURE_READ") {
    const exactHttpDispositionCovered = disposition.exact_routes.some((route) =>
      covHttpDispositions.some((h) =>
        h.http_method === d.method &&
        h.exact_route === route
      )
    );
    const exactSurfaceCovered = exactSurfaceRows.length > 0;
    assert(exactHttpDispositionCovered || exactSurfaceCovered, "dynamic HTTP writer requires exact caller/writer inventory surface", { route:d, disposition });
  }
}
const covStaleDynamicDispositions = covDynamicDispositions.filter((d) =>
  !covDynamicHttp.some((x) =>
    x.source_path === d.source_path &&
    x.method === d.http_method &&
    x.expression === d.expression
  )
);
assert(covUnexpectedDynamicHttp.length === 0, "unresolved production HTTP entrypoint requires explicit all-method disposition", covUnexpectedDynamicHttp);
assert(covDynamicClassMismatch.length === 0, "dynamic HTTP side-effect disposition does not match reachable write behavior", covDynamicClassMismatch);
assert(covStaleDynamicDispositions.length === 0, "stale dynamic HTTP disposition without production registration", covStaleDynamicDispositions);
assert(covUnsupportedRouteRegistrations.length === 0, "unsupported app.route production registration requires explicit scanner support", covUnsupportedRouteRegistrations);


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


const covExecutionAnalysisCache = new Map();
function covAnalyzeExecutedFunction(target, stack = new Set()) {
  const key = covFunctionKey(target);
  if (covExecutionAnalysisCache.has(key)) return covExecutionAnalysisCache.get(key);
  if (stack.has(key)) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set() };
  const next = new Set(stack);
  next.add(key);
  const mod = covBuildModule(target.fp);
  const node = mod.functions.get(target.name);
  if (!node) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set() };

  const direct = covDirectSqlEffect(target.fp, node);
  const result = { dml:direct.dml, ddl:direct.ddl, fact:direct.fact, directWriterKeys:new Set() };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(key);

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys) result.directWriterKeys.add(k);
  }
  function walk(n) {
    if (
      n !== node &&
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      !covImmediatelyInvokedFunction(n)
    ) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const child = covResolveFunction(target.fp, n.expression.text);
      if (child) merge(covAnalyzeExecutedFunction(child, next));
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  covExecutionAnalysisCache.set(key, result);
  return result;
}


// Callback / lifecycle execution graph.
// Recognized production callback registrations are analyzed as executed edges, not as inert nested functions.
function covFunctionLike(n) {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n);
}
function covNearestFunctionName(n) {
  let p = n.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((ts.isFunctionExpression(p) || ts.isArrowFunction(p)) && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text;
    p = p.parent;
  }
  return "<module>";
}
function covNearestStaticRoute(n, fp) {
  let p = n.parent;
  while (p) {
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) &&
        ts.isIdentifier(p.expression.expression) && p.expression.expression.text === "app") {
      const method = p.expression.name.text.toUpperCase();
      if (["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(method)) {
        const arg = p.arguments[0];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
          return method + " " + arg.text;
        }
      }
    }
    p = p.parent;
  }
  return null;
}
function covLocalFunctionMap(container) {
  const map = new Map();
  if (!container) return map;
  function visit(n) {
    if (n !== container && covFunctionLike(n)) {
      if (ts.isFunctionDeclaration(n) && n.name) map.set(n.name.text, n);
      if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) {
        map.set(n.parent.name.text, n);
      }
      return;
    }
    ts.forEachChild(n, visit);
  }
  visit(container);
  return map;
}
function covEnclosingFunctionNode(n) {
  let p = n.parent;
  while (p) {
    if (covFunctionLike(p)) return p;
    p = p.parent;
  }
  return null;
}
function covAnalyzeCallbackNode(fp, node, localMap, stack = new Set()) {
  const keyBase = rel(fp) + "::callback::" + node.pos + ":" + node.end;
  if (stack.has(keyBase)) return {dml:false,ddl:false,fact:false,directWriterKeys:new Set(),callees:new Set()};
  const next = new Set(stack); next.add(keyBase);
  const direct = covDirectSqlEffect(fp, node);
  const result = {dml:direct.dml,ddl:direct.ddl,fact:direct.fact,directWriterKeys:new Set(),callees:new Set()};
  if (direct.dml || direct.ddl) result.directWriterKeys.add(rel(fp) + "::" + "<inline>");

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys || []) result.directWriterKeys.add(k);
    for (const k of other.callees || []) result.callees.add(k);
  }
  function analyzeLocal(name) {
    const local = localMap.get(name);
    if (!local) return false;
    const localKey = rel(fp) + "::local::" + name + ":" + local.pos;
    if (next.has(localKey)) return true;
    const nested = new Set(next); nested.add(localKey);
    merge(covAnalyzeCallbackNode(fp, local, localMap, nested));
    return true;
  }
  function walk(n) {
    if (n !== node && covFunctionLike(n)) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      if (!analyzeLocal(name) && !(name === "ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
        const target = covResolveFunction(fp, name);
        if (target) {
          result.callees.add(covFunctionKey(target));
          merge(covAnalyzeFunction(target, next));
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return result;
}
function covAnalyzeCallbackArg(fp, call, argIndex) {
  const arg = call.arguments[argIndex];
  if (!arg) return {supported:false,analysis:null};
  const enclosing = covEnclosingFunctionNode(call);
  const localMap = covLocalFunctionMap(enclosing);
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    return {supported:true,analysis:covAnalyzeCallbackNode(fp,arg,localMap)};
  }
  if (ts.isIdentifier(arg)) {
    if (localMap.has(arg.text)) return {supported:true,analysis:covAnalyzeCallbackNode(fp,localMap.get(arg.text),localMap)};
    const target = covResolveFunction(fp,arg.text);
    if (target) return {supported:true,analysis:covAnalyzeFunction(target)};
    // Promise settlement callbacks are lexical function parameters and carry no
    // persistence capability by themselves. Prove that lexical relationship;
    // never allowlist an arbitrary unresolved identifier by name alone.
    if (arg.text === "resolve" || arg.text === "reject") {
      let p = call.parent;
      while (p && !covFunctionLike(p)) p = p.parent;
      if (p && p.parameters.some((param) => ts.isIdentifier(param.name) && param.name.text === arg.text)) {
        return {supported:true,analysis:{dml:false,ddl:false,fact:false,directWriterKeys:new Set(),callees:new Set()}};
      }
    }
  }
  return {supported:false,analysis:null};
}


function covResolvedCallTarget(fp, call) {
  if (ts.isIdentifier(call.expression)) return covResolveFunction(fp, call.expression.text);
  return null;
}
function covTargetInvokesParameter(target, index) {
  const mod = covBuildModule(target.fp);
  const node = mod.functions.get(target.name);
  if (!node || !node.parameters || index >= node.parameters.length) return false;
  const param = node.parameters[index];
  if (!param || !ts.isIdentifier(param.name)) return false;
  const paramName = param.name.text;
  let invoked = false;
  function walk(n) {
    if (invoked) return;
    if (n !== node && covFunctionLike(n)) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === paramName) {
      invoked = true;
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return invoked;
}

const covCallbackEdges = [];
const covUnsupportedCallbacks = [];
for (const fp of covFiles) {
  if ((!fp.endsWith(".ts") && !fp.endsWith(".tsx")) || isCommercialDisabledDevtools(fp)) continue;
  const mod = covBuildModule(fp);
  const counters = new Map();
  function addEdge(call, kind, trigger, cbIndex) {
    const enclosing = covNearestFunctionName(call);
    const counterKey = rel(fp)+"::"+enclosing+"::"+kind+"::"+trigger;
    const ordinal = (counters.get(counterKey) || 0) + 1;
    counters.set(counterKey, ordinal);
    const callbackId = rel(fp)+"#"+enclosing+"#"+kind+":"+trigger+"#"+ordinal;
    const analyzed = covAnalyzeCallbackArg(fp,call,cbIndex);
    if (!analyzed.supported) {
      covUnsupportedCallbacks.push({callback_id:callbackId,source_path:rel(fp),callback_kind:kind,trigger,expression:call.getText(mod.sf).slice(0,280)});
      return;
    }
    const a = analyzed.analysis;
    covCallbackEdges.push({
      callback_id:callbackId,
      source_path:rel(fp),
      enclosing_symbol:enclosing,
      callback_kind:kind,
      trigger,
      caller_route:covNearestStaticRoute(call,fp),
      dml:a.dml, ddl:a.ddl, fact:a.fact,
      writers:[...a.directWriterKeys],
      callees:[...a.callees],
    });
  }
  function visit(n) {
    if (ts.isCallExpression(n)) {
      if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) &&
          n.expression.expression.text === "app" && n.expression.name.text === "addHook") {
        const ev=n.arguments[0];
        if (ev && (ts.isStringLiteral(ev)||ts.isNoSubstitutionTemplateLiteral(ev))) addEdge(n,"FASTIFY_HOOK",ev.text,1);
        else covUnsupportedCallbacks.push({source_path:rel(fp),callback_kind:"FASTIFY_HOOK",trigger:"<dynamic>",expression:n.getText(mod.sf).slice(0,280)});
      } else if (ts.isIdentifier(n.expression) && (n.expression.text === "setInterval" || n.expression.text === "setTimeout")) {
        addEdge(n,n.expression.text === "setInterval" ? "TIMER_INTERVAL" : "TIMER_TIMEOUT",n.expression.text,0);
      } else if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "on") {
        const ev=n.arguments[0];
        if (ev && (ts.isStringLiteral(ev)||ts.isNoSubstitutionTemplateLiteral(ev))) addEdge(n,"EVENT_LISTENER",ev.text,1);
      } else {
        const target = covResolvedCallTarget(fp,n);
        if (target) {
          for (let i=0;i<n.arguments.length;i+=1) {
            const arg=n.arguments[i];
            if ((ts.isArrowFunction(arg)||ts.isFunctionExpression(arg)) && covTargetInvokesParameter(target,i)) {
              addEdge(n,"HIGHER_ORDER_CALLBACK",covFunctionKey(target),i);
            }
          }
        }
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(mod.sf);
}
assert(covUnsupportedCallbacks.length === 0, "production callback/hook registration could not be statically resolved", covUnsupportedCallbacks);

const covCallbackDispositions = inv.callback_hook_dispositions ?? [];
const covCallbackDispositionById = new Map(covCallbackDispositions.map((d)=>[d.callback_id,d]));
const covCallbackMissing = [];
const covCallbackStale = [];
const covCallbackClassMismatch = [];
for (const edge of covCallbackEdges) {
  const persistent = edge.dml || edge.ddl;
  const mustDisposition = persistent || (edge.callback_kind === "FASTIFY_HOOK" && edge.trigger === "onReady");
  if (!mustDisposition) continue;
  const d = covCallbackDispositionById.get(edge.callback_id);
  if (!d) { covCallbackMissing.push(edge); continue; }
  assert(d.source_path === edge.source_path, "callback disposition source mismatch", {edge,disposition:d});
  assert(d.callback_kind === edge.callback_kind, "callback disposition kind mismatch", {edge,disposition:d});
  if (edge.callback_kind === "FASTIFY_HOOK" && edge.trigger === "preHandler" && persistent) {
    assert(Array.isArray(d.caller_routes) && d.caller_routes.length > 0, "persistent preHandler requires explicit caller route binding", {edge,disposition:d});
  }
  if (d.effect_class === "PURE_STARTUP_CHECK" && persistent) covCallbackClassMismatch.push({edge,disposition:d});
  if (d.effect_class === "STARTUP_SCHEMA_BOOTSTRAP" && (!edge.ddl || edge.dml)) covCallbackClassMismatch.push({edge,disposition:d});
  if (d.effect_class === "STARTUP_PROJECTION_BOOTSTRAP" && !edge.dml) covCallbackClassMismatch.push({edge,disposition:d});
  if (["CALLER_HOOK_PERSISTENT_WRITE","TIMER_BACKGROUND_WRITER","EVENT_BACKGROUND_WRITER","DEFERRED_SERVER_CALLBACK_WRITER"].includes(d.effect_class) && !persistent) covCallbackClassMismatch.push({edge,disposition:d});
}
for (const d of covCallbackDispositions) {
  if (!covCallbackEdges.some((e)=>e.callback_id===d.callback_id)) covCallbackStale.push(d);
}
assert(covCallbackMissing.length === 0, "production callback/hook persistent writer without disposition", covCallbackMissing);
assert(covCallbackClassMismatch.length === 0, "callback/hook disposition effect class mismatch", covCallbackClassMismatch);
assert(covCallbackStale.length === 0, "stale callback/hook disposition", covCallbackStale);

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

const covStartupRootWriterKeys = new Set();
for (const [sourcePath, fnName] of [
  ["apps/server/src/app.ts", "createApp"],
  ["apps/server/src/bootstrap/server.ts", "startServer"],
]) {
  const fp = path.resolve(ROOT, sourcePath);
  if (!exists(fp)) continue;
  const target = covResolveFunction(fp, fnName);
  if (!target) fail("startup root function missing", { source_path:sourcePath, entry_symbol:fnName });
  const analysis = covAnalyzeExecutedFunction(target);
  for (const key of analysis.directWriterKeys) covStartupRootWriterKeys.add(key);
}
const covStartupRootMissing = [];
for (const key of covStartupRootWriterKeys) {
  const split = key.lastIndexOf("::");
  const sourcePath = key.slice(0, split);
  const symbol = key.slice(split + 2);
  const explicit = covStartupDispositions.some((d) => d.source_path === sourcePath && d.entry_symbol === symbol);
  if (!explicit) covStartupRootMissing.push({ source_path:sourcePath, entry_symbol:symbol });
}
assert(covStartupRootMissing.length === 0, "startup mutation without explicit disposition from server startup graph", covStartupRootMissing);


const covRuntimeDispositions = inv.runtime_direct_writer_dispositions ?? [];
const covRuntimeRoots = [
  "apps/server/src/jobs/runtime.ts",
  "apps/server/src/bootstrap/workers.ts",
  "apps/executor/src/runtime_loop.ts",
  "apps/telemetry-ingest/src/main.ts",
];
const covAdditionalRuntimeEntryRoots = [
  ["scripts/loadfact.ts", "main", "COMMERCIAL_ADMIN_CAF_SUBPROCESS"],
  ["apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts", "runMcftCap07DatabasePlatformBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.ts", "runRuntimeSchemaCompatibilityBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/runtime_dispatch_queue_bootstrap_v1.ts", "runRuntimeDispatchQueueBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/runtime_device_status_compatibility_bootstrap_v1.ts", "runRuntimeDeviceStatusCompatibilityBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/runtime_skill_registry_compatibility_bootstrap_v1.ts", "runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/runtime_field_fertility_compatibility_bootstrap_v1.ts", "runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1", "COMMERCIAL_DATABASE_PLATFORM_BOOTSTRAP"],
  ["apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.ts", "runMcftCap07StartupMigrationFromEnvironmentV1", "FOREIGN_MCFT_MIGRATION_ROOT"],
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
const covAdditionalRuntimeRootEvidence = [];
for (const [sourcePath, entrySymbol, rootKind] of covAdditionalRuntimeEntryRoots) {
  const fp = path.resolve(ROOT, sourcePath);
  assert(exists(fp), "additional production runtime root source missing", {source_path:sourcePath, entry_symbol:entrySymbol});
  const target = covResolveFunction(fp, entrySymbol);
  assert(target, "additional production runtime root entry symbol missing", {source_path:sourcePath, entry_symbol:entrySymbol});
  const analysis = covAnalyzeExecutedFunction(target);
  covAdditionalRuntimeRootEvidence.push({
    source_path:sourcePath,
    entry_symbol:entrySymbol,
    root_kind:rootKind,
    writer_count:analysis.directWriterKeys.size,
  });
  for (const key of analysis.directWriterKeys) covRuntimeWriterKeys.add(key);
}
const covRuntimeMissing = [];
for (const key of covRuntimeWriterKeys) {
  const split = key.lastIndexOf("::");
  const sourcePath = key.slice(0, split);
  const symbol = key.slice(split + 2);
  const explicit = covRuntimeDispositions.some((d) => d.source_path === sourcePath && d.entry_symbol === symbol);
  const callbackExplicit = covCallbackDispositions.some((d) =>
    Array.isArray(d.writer_entrypoints) &&
    d.writer_entrypoints.includes(sourcePath + "::" + symbol)
  );
  const surface = surfaces.some((s) =>
    s.source_path === sourcePath &&
    s.entry_symbol === symbol &&
    s.activation_mode !== "HTTP_ROUTE"
  );
  const startup = covStartupDispositions.some((d) => d.source_path === sourcePath && d.entry_symbol === symbol);
  if (!explicit && !callbackExplicit && !surface && !startup) {
    covRuntimeMissing.push({
      source_path: sourcePath,
      entry_symbol: symbol,
      foreign_mcft: /(?:^|\/)mcft(?:_|\/)|MCFT/i.test(sourcePath + "::" + symbol),
    });
  }
}
assert(covRuntimeMissing.length === 0, "production runtime direct writer without inventory", covRuntimeMissing);


const covCredentialDispositions = inv.service_credential_dispositions ?? [];
const covCredentialById = new Map(covCredentialDispositions.map((d)=>[d.credential_id,d]));
const covRequiredCredentialIds = ["BCRED-001","BCRED-002","BCRED-003","BCRED-004","BCRED-005"];
for (const id of covRequiredCredentialIds) {
  assert(covCredentialById.has(id), "production service credential without principal classification", id);
}

const runtimeDockerfile = read(path.join(ROOT,"docker/runtime.Dockerfile"));
const hardeningDoc = read(path.join(ROOT,"docs/security/GEOX_RUNTIME_HARDENING_V1.md"));
const runtimeSecurity = read(path.join(ROOT,"apps/server/src/runtime/runtime_security_v1.ts"));
const cap07Bootstrap = read(path.join(ROOT,"apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts"));

function covComposeServiceBlock(service) {
  const escaped = service.replace(/[.*+?^()|[\]{}\\-]/g, "\\const covZeroSets = {");
  return compose.match(new RegExp("\\n  "+escaped+":[\\s\\S]*?(?=\\n  [A-Za-z0-9_-]+:|$)"))?.[0] ?? "";
}
for (const service of ["server","jobs","executor","telemetry-ingest"]) {
  const serviceBlock = covComposeServiceBlock(service);
  assert(serviceBlock.includes("postgres://geox_runtime_v1:"), "commercial process no longer bound to declared shared DB principal", {service});
}
assert(cap07Bootstrap.includes('MCFT_CAP07_RUNTIME_ROLE_V1 = "geox_runtime_v1"'), "CAP07 runtime principal identity drift");
assert(cap07Bootstrap.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO"), "CAP07 shared runtime broad table grant drift");
assert(cap07Bootstrap.includes("ALTER DEFAULT PRIVILEGES IN SCHEMA public"), "CAP07 runtime default privilege contract drift");

const mqttBlock = covComposeServiceBlock("mqtt");
assert(mqttBlock.includes("allow_anonymous false"), "commercial MQTT anonymous policy drift");
assert(mqttBlock.includes("password_file "), "commercial MQTT password-file policy drift");
assert(!mqttBlock.includes("acl_file"), "commercial MQTT unexpectedly gained topic ACL; credential disposition requires re-adjudication");
for (const service of ["executor","telemetry-ingest"]) {
  const serviceBlock = covComposeServiceBlock(service);
  assert(serviceBlock.includes("GEOX_MQTT_USERNAME:") && serviceBlock.includes("MQTT_USERNAME"), "shared MQTT username topology drift", {service});
  assert(serviceBlock.includes("GEOX_MQTT_PASSWORD:") && serviceBlock.includes("MQTT_PASSWORD"), "shared MQTT password topology drift", {service});
}

const serverBlock = covComposeServiceBlock("server");
assert(serverBlock.includes("GEOX_EVIDENCE_S3_ACCESS_KEY_ID:") && serverBlock.includes("MINIO_ROOT_USER"), "evidence object-store access key no longer matches declared root reuse debt");
assert(serverBlock.includes("GEOX_EVIDENCE_S3_SECRET_ACCESS_KEY:") && serverBlock.includes("MINIO_ROOT_PASSWORD"), "evidence object-store secret no longer matches declared root reuse debt");
assert(serverBlock.includes("GEOX_TOKENS_FILE: /app/config/auth/security_acceptance_tokens.json"), "commercial tracked acceptance bearer source drift");
assert(serverBlock.includes("GEOX_INTERNAL_TASK_ISSUER_TOKEN:") && serverBlock.includes("operator_token"), "internal delegated bearer default drift");
assert(runtimeDockerfile.includes("COPY config ./config"), "runtime image config copy drift");
assert(hardeningDoc.includes("security_acceptance_tokens.json") && hardeningDoc.includes("only for test/dev acceptance"), "documented acceptance-token policy drift");
assert(hardeningDoc.includes("Staging/production must not use acceptance fixture"), "documented staging/production token policy drift");
assert(runtimeSecurity.includes('tokenPath.includes("example_tokens.json")'), "runtime security example-token check drift");
assert(!runtimeSecurity.includes('tokenPath.includes("security_acceptance_tokens.json")'), "runtime security now rejects acceptance fixture; credential debt disposition requires re-adjudication");

function covWalkFiles(rootDir, out=[]) {
  if (!fs.existsSync(rootDir)) return out;
  for (const ent of fs.readdirSync(rootDir,{withFileTypes:true})) {
    const fp=path.join(rootDir,ent.name);
    if (ent.isDirectory()) covWalkFiles(fp,out);
    else if (ent.isFile()) out.push(fp);
  }
  return out;
}
const covRlsProductionFiles = [
  ...covWalkFiles(path.join(ROOT,"apps/server/src")),
  ...covWalkFiles(path.join(ROOT,"docker/postgres")),
].filter((fp)=>/\.(?:ts|sql|js|cjs|mjs)$/i.test(fp) && !/\.test\./.test(fp));
const covRlsStatements=[];
for (const fp of covRlsProductionFiles) {
  const sourceText=read(fp);
  if (/\b(?:ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b/i.test(sourceText) || /\bCREATE\s+POLICY\b/i.test(sourceText)) covRlsStatements.push(rel(fp));
}
assert(covRlsStatements.length===0, "DB-level tenant RLS now exists and shared-principal classification requires re-adjudication", covRlsStatements);

const covAllowedTenantBindingClasses = new Set(inv.tenant_binding_model?.allowed_classes ?? []);
for (const requiredClass of ["SERVICE_CONFIG_SCOPED_WORKER","GLOBAL_MULTI_TENANT_WORKER","ROW_TENANT_DERIVED","GLOBAL_BOOTSTRAP","FOREIGN_MCFT"]) {
  assert(covAllowedTenantBindingClasses.has(requiredClass), "tenant-binding class model incomplete", requiredClass);
}
const covAmbiguousTenantWriters=[];
const covGlobalWorkerAmbiguous=[];
for (const d of covRuntimeDispositions) {
  if (!covAllowedTenantBindingClasses.has(d.tenant_binding_class)) covAmbiguousTenantWriters.push(d);
  if (d.tenant_binding_class === "GLOBAL_MULTI_TENANT_WORKER" && !String(d.tenant_binding_detail||"").includes("ROW_TENANT_DERIVED")) covGlobalWorkerAmbiguous.push(d);
  assert(d.tenant_binding_class !== "SERVICE_CONFIG_OR_DB_SCOPE", "ambiguous tenant binding label forbidden on runtime writer", d);
}
assert(covAmbiguousTenantWriters.length===0, "runtime writer has ambiguous tenant-binding class", covAmbiguousTenantWriters);
assert(covGlobalWorkerAmbiguous.length===0, "production global multi-tenant worker with ambiguous tenant-binding class", covGlobalWorkerAmbiguous);

const covAgronomyRuntime = covRuntimeDispositions.find((d)=>d.source_path==="apps/server/src/jobs/agronomy_agent.ts" && d.entry_symbol==="insertFact");
assert(covAgronomyRuntime?.tenant_binding_class==="GLOBAL_MULTI_TENANT_WORKER", "Agronomy Agent tenant-binding classification drift", covAgronomyRuntime);
assert(String(covAgronomyRuntime?.tenant_binding_detail||"").includes("CROSS_TENANT_ACTIVATION_FALLBACK"), "Agronomy Agent activation fallback debt missing", covAgronomyRuntime);
assert(String(covAgronomyRuntime?.current_disposition||"").includes("LEGACY_SIGNAL_ONLY"), "Agronomy Agent semantic ceiling drift", covAgronomyRuntime);

const covCredentialMissing = covRequiredCredentialIds.filter((id)=>!covCredentialById.has(id));

const covZeroSets = {
  production_caller_triggered_mutation_without_inventory: covCallerMissing.length,
  production_runtime_direct_writer_without_inventory: covRuntimeMissing.length,
  startup_mutation_without_explicit_disposition: covStartupMissingUnique.length + covStartupRootMissing.length,
  production_callback_hook_persistent_writer_without_disposition: covCallbackMissing.length,
  production_service_credential_without_principal_classification: covCredentialMissing.length,
  production_global_multi_tenant_worker_with_ambiguous_tenant_binding_class: covGlobalWorkerAmbiguous.length,
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
  discovered_dynamic_http_registration_count:covDynamicHttp.length,
  dynamic_http_registration_disposition_count:covDynamicDispositions.length,
  unsupported_app_route_registration_count:covUnsupportedRouteRegistrations.length,
  discovered_get_entrypoint_count:covHttpUnique.filter((r)=>r.method==="GET").length,
  auto_pure_read_http_count:covPureReadCount,
  explicit_http_side_effect_disposition_count:covHttpDispositions.length,
  callback_hook_disposition_count:covCallbackDispositions.length,
  service_credential_disposition_count:covCredentialDispositions.length,
  discovered_callback_edge_count:covCallbackEdges.length,
  startup_mutation_disposition_count:covStartupDispositions.length,
  startup_root_direct_writer_count:covStartupRootWriterKeys.size,
  runtime_direct_writer_disposition_count:covRuntimeDispositions.length,
  additional_process_subprocess_root_count:covAdditionalRuntimeEntryRoots.length,
  additional_process_subprocess_root_evidence:covAdditionalRuntimeRootEvidence,
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
