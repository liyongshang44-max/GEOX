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
  // SQL keywords inside single-quoted values are data, not executable verbs.
  // This is material for privilege-inspection queries such as
  // has_table_privilege(..., 'INSERT,UPDATE,DELETE,TRUNCATE').
  const executableSql = s.replace(/'(?:''|[^'])*'/g, "''");
  const dml =
    /\bINSERT\s+INTO\b/i.test(executableSql) ||
    /\bDELETE\s+FROM\b/i.test(executableSql) ||
    /\bUPDATE\s+(?:(?:ONLY\s+)?["A-Za-z_])/i.test(executableSql) ||
    /\bTRUNCATE(?:\s+TABLE)?\b/i.test(executableSql) ||
    /\bMERGE\s+INTO\b/i.test(executableSql);
  const ddl =
    /\bCREATE\s+TABLE\b/i.test(executableSql) ||
    /\bALTER\s+TABLE\b/i.test(executableSql) ||
    /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(executableSql) ||
    /\bDROP\s+(?:TABLE|INDEX)\b/i.test(executableSql);
  const fact =
    /\bINSERT\s+INTO\s+(?:public\.)?facts\b/i.test(executableSql) ||
    /\bUPDATE\s+(?:public\.)?facts\b/i.test(executableSql) ||
    /\bDELETE\s+FROM\s+(?:public\.)?facts\b/i.test(executableSql);
  const targets = new Set();
  function collect(re, group=1) {
    let m;
    while ((m=re.exec(executableSql))) {
      const raw=String(m[group]||"").replace(/^public\./i,"").replaceAll('"',"").trim();
      if (raw && !["SET","SKIP","NOWAIT"].includes(raw.toUpperCase())) targets.add(raw);
    }
  }
  collect(/\bINSERT\s+INTO\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bDELETE\s+FROM\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bUPDATE\s+(?:ONLY\s+)?((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bTRUNCATE(?:\s+TABLE)?\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bMERGE\s+INTO\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  collect(/\bCREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+[^\s]+\s+ON\s+((?:public\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/ig);
  return { dml, ddl, fact, targets };
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

  const result = { dml:false, ddl:false, fact:false, targets:new Set() };
  function merge(effect) {
    result.dml = result.dml || effect.dml;
    result.ddl = result.ddl || effect.ddl;
    result.fact = result.fact || effect.fact;
    for (const t of effect.targets || []) result.targets.add(t);
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


function covResolveLexicalCallable(fp, fromNode, name) {
  const mod=covBuildModule(fp);
  let p=fromNode?.parent ?? null;
  while (p) {
    if (covFunctionLike(p)) {
      let found=null;
      function scan(n) {
        if (found) return;
        if (n!==p && covFunctionLike(n)) {
          if (ts.isFunctionDeclaration(n) && n.name?.text===name) found={kind:"node",node:n,scope:p};
          if ((ts.isArrowFunction(n)||ts.isFunctionExpression(n)) && n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) && n.parent.name.text===name) found={kind:"node",node:n,scope:p};
          return;
        }
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text===name && n.initializer) {
          if (ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)) {
            found={kind:"node",node:n.initializer,scope:p};
            return;
          }
          const imported=[];
          function collectImported(x) {
            if (ts.isIdentifier(x) && mod.imports.has(x.text)) imported.push(mod.imports.get(x.text));
            ts.forEachChild(x,collectImported);
          }
          collectImported(n.initializer);
          const uniq=new Map(imported.map((x)=>[x.fp+"::"+x.name,x]));
          if (uniq.size===1) {
            const t=[...uniq.values()][0];
            found={kind:"target",target:covFindReexport(t.fp,t.name)||t,scope:p};
            return;
          }
        }
        ts.forEachChild(n,scan);
      }
      scan(p);
      if (found) return found;
    }
    p=p.parent;
  }
  return null;
}

const covImmediateCallbackMethods=new Set([
  "map","flatMap","forEach","reduce","reduceRight","filter","some","every","find","findIndex","findLast","findLastIndex","sort",
  "then","catch","finally",
]);

function covTargetInvokesObjectCallbackProperty(target,index,propName) {
  const mod=covBuildModule(target.fp);
  const node=mod.functions.get(target.name);
  if (!node || index>=node.parameters.length) return false;
  const param=node.parameters[index];
  if (!param || !ts.isIdentifier(param.name)) return false;
  const paramName=param.name.text;
  let invoked=false;
  function walk(n) {
    if (invoked) return;
    if (n!==node && covFunctionLike(n)) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text===paramName &&
      n.expression.name.text===propName
    ) {
      invoked=true;
      return;
    }
    ts.forEachChild(n,walk);
  }
  walk(node);
  return invoked;
}

function covAnalyzeReachableCallbackArgs(fp, call, stack, merge) {
  const enclosing=covEnclosingFunctionNode(call);
  const scopeMap=covLocalFunctionMap(enclosing);
  const indexes=new Set();
  let target=null;

  if (ts.isPropertyAccessExpression(call.expression) && covImmediateCallbackMethods.has(call.expression.name.text)) {
    for (let i=0;i<call.arguments.length;i+=1) {
      const arg=call.arguments[i];
      if (ts.isArrowFunction(arg)||ts.isFunctionExpression(arg)||ts.isIdentifier(arg)) indexes.add(i);
    }
  }
  if (ts.isIdentifier(call.expression)) {
    const lexical=covResolveLexicalCallable(fp,call,call.expression.text);
    if (lexical?.kind==="target") target=lexical.target;
    else if (!lexical) target=covResolveFunction(fp,call.expression.text);
    if (target) {
      for (let i=0;i<call.arguments.length;i+=1) {
        if (covTargetInvokesParameter(target,i)) indexes.add(i);
        const arg=call.arguments[i];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const prop of arg.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const propName=(ts.isIdentifier(prop.name)||ts.isStringLiteral(prop.name)) ? prop.name.text : "";
            if (!propName || !covTargetInvokesObjectCallbackProperty(target,i,propName)) continue;
            const init=prop.initializer;
            if (ts.isArrowFunction(init)||ts.isFunctionExpression(init)) {
              merge(covAnalyzeCallbackNode(fp,init,scopeMap,stack));
            } else if (ts.isIdentifier(init)) {
              const lexicalArg=covResolveLexicalCallable(fp,call,init.text);
              if (lexicalArg?.kind==="node") merge(covAnalyzeCallbackNode(fp,lexicalArg.node,covLocalFunctionMap(lexicalArg.scope),stack));
              else {
                const cbTarget=lexicalArg?.kind==="target" ? lexicalArg.target : covResolveFunction(fp,init.text);
                if (cbTarget) merge(covAnalyzeFunction(cbTarget,stack));
              }
            }
          }
        }
      }
    }
  }

  for (const i of indexes) {
    const arg=call.arguments[i];
    if (!arg) continue;
    if (ts.isArrowFunction(arg)||ts.isFunctionExpression(arg)) {
      merge(covAnalyzeCallbackNode(fp,arg,scopeMap,stack));
    } else if (ts.isIdentifier(arg)) {
      if (scopeMap.has(arg.text)) merge(covAnalyzeCallbackNode(fp,scopeMap.get(arg.text),scopeMap,stack));
      else {
        const lexical=covResolveLexicalCallable(fp,call,arg.text);
        if (lexical?.kind==="node") merge(covAnalyzeCallbackNode(fp,lexical.node,covLocalFunctionMap(lexical.scope),stack));
        else {
          const cbTarget=lexical?.kind==="target" ? lexical.target : covResolveFunction(fp,arg.text);
          if (cbTarget) merge(covAnalyzeFunction(cbTarget,stack));
        }
      }
    }
  }
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
    targets: new Set(direct.targets || []),
  };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(rel(fp) + "::" + "<inline>");
  const localMap = covLocalFunctionMap(node);

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys || []) result.directWriterKeys.add(k);
    for (const k of other.callees || []) result.callees.add(k);
    for (const t of other.targets || []) result.targets.add(t);
  }

  function walk(n) {
    if (n !== node && covFunctionLike(n) && !covImmediatelyInvokedFunction(n)) return;
    if (ts.isCallExpression(n)) {
      covAnalyzeReachableCallbackArgs(fp,n,stack,merge);
      if (ts.isIdentifier(n.expression)) {
        const name=n.expression.text;
        if (!(name==="ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
          if (localMap.has(name)) {
            merge(covAnalyzeCallbackNode(fp,localMap.get(name),localMap,stack));
          } else {
            const lexical=covResolveLexicalCallable(fp,n,name);
            if (lexical?.kind==="node") {
              merge(covAnalyzeCallbackNode(fp,lexical.node,covLocalFunctionMap(lexical.scope),stack));
            } else {
              const target=lexical?.kind==="target" ? lexical.target : covResolveFunction(fp,name);
              if (target) {
                result.callees.add(covFunctionKey(target));
                merge(covAnalyzeFunction(target,stack));
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n,walk);
  }
  walk(node);
  return result;
}

function covAnalyzeFunction(target, stack = new Set()) {
  const key = covFunctionKey(target);
  if (covAnalysisCache.has(key)) return covAnalysisCache.get(key);
  if (stack.has(key)) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set(), targets:new Set() };
  const next = new Set(stack);
  next.add(key);
  const mod = covBuildModule(target.fp);
  const node = mod.functions.get(target.name);
  if (!node) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set(), targets:new Set() };
  const direct = covDirectSqlEffect(target.fp, node);
  const result = {
    dml:direct.dml,
    ddl:direct.ddl,
    fact:direct.fact,
    directWriterKeys:new Set(),
    callees:new Set(),
    targets:new Set(direct.targets || []),
  };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(key);
  const localMap = covLocalFunctionMap(node);

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys || []) result.directWriterKeys.add(k);
    for (const k of other.callees || []) result.callees.add(k);
    for (const t of other.targets || []) result.targets.add(t);
  }
  function walk(n) {
    if (n !== node && covFunctionLike(n) && !covImmediatelyInvokedFunction(n)) return;
    if (ts.isCallExpression(n)) {
      covAnalyzeReachableCallbackArgs(target.fp,n,next,merge);
      if (ts.isIdentifier(n.expression)) {
        const name=n.expression.text;
        if (!(name==="ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
          if (localMap.has(name)) {
            merge(covAnalyzeCallbackNode(target.fp,localMap.get(name),localMap,next));
          } else {
            const lexical=covResolveLexicalCallable(target.fp,n,name);
            if (lexical?.kind==="node") {
              merge(covAnalyzeCallbackNode(target.fp,lexical.node,covLocalFunctionMap(lexical.scope),next));
            } else {
              const child=lexical?.kind==="target" ? lexical.target : covResolveFunction(target.fp,name);
              if (child) {
                result.callees.add(covFunctionKey(child));
                merge(covAnalyzeFunction(child,next));
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n,walk);
  }
  walk(node);
  covAnalysisCache.set(key,result);
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
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set(), targets:new Set() };
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
            targets: [...(analysis.targets || [])],
          });
        } else {
          const handler = n.arguments[n.arguments.length - 1];
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set(), targets:new Set() };
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
            targets: [...(analysis.targets || [])],
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
          let analysis = { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), callees:new Set(), targets:new Set() };
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

// W2 successor compatibility is intentionally exact and does not rewrite the frozen PR-SEC-1 inventory.
// BDYN-002 remains a registered legacy compatibility GET, but W2 removes only its persistent read-audit fact.
// Any other dynamic-route behavior continues to be evaluated against the original frozen disposition.
const covW2BoundedInventoryPath = path.join(ROOT, "docs/architecture/semantic_convergence/GEOX-BLINE-W2-CALLER-READ-WRITE-BOUNDARY-V1.json");
let covW2BoundedReadBoundaryActive = false;
let covW2PureReadHttpKeys = new Set();
let covW2BoundedHttpPureReadKeys = new Set();
if (fs.existsSync(covW2BoundedInventoryPath)) {
  try {
    const w2 = JSON.parse(read(covW2BoundedInventoryPath));
    const aoActSource = read(path.join(ROOT, "apps/server/src/routes/control_ao_act.ts"));
    const indexStart = aoActSource.indexOf("async function handleAoActIndexV1");
    const indexEnd = aoActSource.indexOf("export function registerAoActV1Routes", indexStart);
    const indexHandler = indexStart >= 0 && indexEnd > indexStart ? aoActSource.slice(indexStart, indexEnd) : "";
    covW2BoundedReadBoundaryActive =
      w2?.version === "GEOX_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1" &&
      w2?.authority_base === "03db0c098a66053fd0b921cb8a3c5acdcf67d4d0" &&
      w2?.discovery_policy === "NO_WHOLE_REPOSITORY_DISCOVERY; EXACT_PREDECESSOR_ROWS_ONLY" &&
      w2?.known_get_count === 23 &&
      Array.isArray(w2?.known_get_read_product_state_mutations) &&
      w2.known_get_read_product_state_mutations.length === 23 &&
      indexHandler.includes('event: "index_read"') &&
      indexHandler.includes("req.log.info") &&
      !indexHandler.includes("writeAoActAuthzAuditFactV0");
    if (covW2BoundedReadBoundaryActive) {
      assert(Array.isArray(w2?.known_get_read_product_state_mutations), "W2 bounded GET inventory missing");
      assert(w2.known_get_read_product_state_mutations.length === 23, "W2 bounded GET inventory cardinality drift");
      covW2PureReadHttpKeys = new Set(
        w2.known_get_read_product_state_mutations.map((row) => {
          const entry = String(row?.entry_symbol ?? "");
          assert(entry.startsWith("GET "), "W2 bounded GET entry symbol drift", row);
          assert(
            row?.w2_disposition === "REMOVE_READ_PATH_PERSISTENT_MUTATION" ||
            row?.w2_disposition === "BIND_EXISTING_TELEMETRY_READ_AND_REMOVE_COMPATIBILITY_MUTATION",
            "W2 bounded GET disposition drift",
            row
          );
          return String(row.source_path) + "::GET::" + entry.slice(4);
        })
      );
      assert(covW2PureReadHttpKeys.size === 23, "W2 bounded GET exact-key cardinality drift", [...covW2PureReadHttpKeys]);
    }
    if (covW2BoundedReadBoundaryActive) {
      covW2BoundedHttpPureReadKeys = new Set(
        w2.known_get_read_product_state_mutations.map((row) => {
          const entry = String(row?.entry_symbol ?? "");
          const route = entry.startsWith("GET ") ? entry.slice(4) : "";
          return String(row?.source_path ?? "") + "::GET::" + route;
        }).filter((key) => !key.endsWith("::"))
      );
      assert(covW2BoundedHttpPureReadKeys.size === 23, "W2 bounded HTTP successor key set drift", [...covW2BoundedHttpPureReadKeys]);
    }
  } catch {
    covW2BoundedReadBoundaryActive = false;
  }
}
function covIsExactW2HttpPureReadSuccessor(route, disposition) {
  if (!covW2BoundedReadBoundaryActive) return false;
  const key = String(route?.source_path ?? "") + "::" + String(route?.method ?? "") + "::" + String(route?.route ?? "");
  if (!covW2BoundedHttpPureReadKeys.has(key)) return false;
  if (!disposition || disposition.source_path !== route.source_path || disposition.http_method !== route.method || disposition.exact_route !== route.route) return false;
  return route.dml === false && route.ddl === false && route.fact === false &&
    Array.isArray(route.writers) && route.writers.length === 0;
}

function covIsExactW2DynamicPureReadSuccessor(route, disposition) {
  return covW2BoundedReadBoundaryActive &&
    disposition?.disposition_id === "BDYN-002" &&
    disposition?.source_path === "apps/server/src/routes/control_ao_act.ts" &&
    disposition?.http_method === "GET" &&
    disposition?.expression === 'legacyAoActRouteV1("index")' &&
    route?.source_path === "apps/server/src/routes/control_ao_act.ts" &&
    route?.method === "GET" &&
    route?.expression === 'legacyAoActRouteV1("index")' &&
    route?.dml === false &&
    route?.ddl === false &&
    route?.fact === false &&
    Array.isArray(route?.writers) &&
    route.writers.length === 0;
}

function covIsExactW2HttpPureReadSuccessor(route, disposition) {
  if (!covW2BoundedReadBoundaryActive || !route || !disposition) return false;
  const key = String(route.source_path) + "::" + String(route.method) + "::" + String(route.route);
  return covW2PureReadHttpKeys.has(key) &&
    disposition.source_path === route.source_path &&
    disposition.http_method === route.method &&
    disposition.exact_route === route.route &&
    route.method === "GET" &&
    route.dml === false &&
    route.ddl === false &&
    route.fact === false &&
    Array.isArray(route.writers) &&
    route.writers.length === 0;
}

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
  if (
    disposition.side_effect_class === "FACT_LEDGER_WRITE" &&
    !d.fact &&
    !delegatedEffect &&
    !covIsExactW2DynamicPureReadSuccessor(d, disposition)
  ) covDynamicClassMismatch.push({route:d, disposition});
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
    const exactW2PureReadSuccessor = covIsExactW2HttpPureReadSuccessor(r, disposition);
    if (cls === "PURE_READ" && hasWrite) covHttpClassMismatch.push({route:r, disposition});
    if (cls === "SCHEMA_ENSURE_ONLY" && (!r.ddl || r.dml)) covHttpClassMismatch.push({route:r, disposition});
    if (cls === "FACT_LEDGER_WRITE" && !r.fact && !exactW2PureReadSuccessor) covHttpClassMismatch.push({route:r, disposition});
    if ((cls === "PROJECTION_SIDE_EFFECT" || cls === "DOMAIN_STATE_SIDE_EFFECT") && !r.dml && !exactW2PureReadSuccessor) covHttpClassMismatch.push({route:r, disposition});
  }
}
}
assert(covHttpClassMismatch.length === 0, "HTTP side-effect disposition does not match reachable write behavior", covHttpClassMismatch);

function covWriterDeclared(declared, actual) {
  const rows=Array.isArray(declared)?declared:[];
  const symbol=String(actual||"").slice(String(actual||"").lastIndexOf("::")+2);
  return rows.some((d)=>String(d)===String(actual) || String(d)===symbol);
}
function covTargetDeclared(declared, actual) {
  const a=String(actual||"").replace(/^public\./i,"").toLowerCase();
  return (Array.isArray(declared)?declared:[]).some((raw)=>{
    const d=String(raw||"").replace(/^public\./i,"").toLowerCase().trim();
    if (d===a) return true;
    if (a==="facts" && (d==="facts" || d.startsWith("facts:") || d.startsWith("facts/") || d.startsWith("facts "))) return true;
    return d.startsWith(a+":") || d.startsWith(a+" ") || d.startsWith(a+"/");
  });
}
const covReachableWriterMissing=[];
const covReachableTargetMissing=[];
const covDeclaredWriterWithoutReachablePersistentWriter=[];
const covDeclaredSqlTargetWithoutReachablePersistentTarget=[];

function covWriterCanonicalMatch(declared, actualWriters) {
  const d=String(declared||"");
  if (!d) return false;
  if (actualWriters.includes(d)) return true;
  const dSymbol=d.includes("::") ? d.slice(d.lastIndexOf("::")+2) : d;
  return actualWriters.some((a)=>String(a).slice(String(a).lastIndexOf("::")+2)===dSymbol);
}
function covDeclaredSqlTargetCandidate(raw) {
  let d=String(raw||"").trim().toLowerCase().replace(/^public\./,"");
  if (!d) return null;
  if (d==="facts" || d.startsWith("facts:") || d.startsWith("facts/") || d.startsWith("facts ")) return "facts";
  d=d.replace(/\s+schema$/,"").trim();
  d=d.split(/\s+via\s+/)[0].trim();
  if (/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(d)) d=d.split(".")[0];
  return /^[a-z_][a-z0-9_]*$/.test(d) ? d : null;
}
function covCheckDeclaredExactness(kind,id,row,route) {
  const actualWriters=[...(route.writers||[])];
  const actualTargets=[...(route.targets||[])].map((x)=>String(x).replace(/^public\./i,"").toLowerCase());
  for (const declared of row.writer_entrypoints||[]) {
    if (!covWriterCanonicalMatch(declared,actualWriters)) {
      covDeclaredWriterWithoutReachablePersistentWriter.push({
        inventory_kind:kind, inventory_id:id, declared_writer:String(declared),
      });
    }
  }
  for (const declared of row.write_targets||[]) {
    const sqlTarget=covDeclaredSqlTargetCandidate(declared);
    if (sqlTarget && !actualTargets.includes(sqlTarget)) {
      covDeclaredSqlTargetWithoutReachablePersistentTarget.push({
        inventory_kind:kind, inventory_id:id, declared_sql_target:String(declared), canonical_sql_target:sqlTarget,
      });
    }
  }
}
for (const route of covHttpUnique) {
  if (!(route.dml||route.ddl)) continue;
  const disposition=covHttpDispositionKey.get(route.source_path+"::"+route.method+"::"+route.route);
  if (disposition) {
    for (const writer of route.writers||[]) if (!covWriterDeclared(disposition.writer_entrypoints,writer)) {
      covReachableWriterMissing.push({inventory_kind:"http_entrypoint_disposition",inventory_id:disposition.disposition_id,missing_writer:writer});
    }
    for (const target of route.targets||[]) if (!covTargetDeclared(disposition.write_targets,target)) {
      covReachableTargetMissing.push({inventory_kind:"http_entrypoint_disposition",inventory_id:disposition.disposition_id,missing_target:target});
    }
    covCheckDeclaredExactness("http_entrypoint_disposition",disposition.disposition_id,disposition,route);
  }
  const surface=surfaces.find((row)=>
    row.activation_mode==="HTTP_ROUTE" &&
    row.source_path===route.source_path &&
    row.http_method_or_runtime_trigger===route.method &&
    row.exact_route_or_trigger===route.route
  );
  if (surface) {
    for (const writer of route.writers||[]) if (!covWriterDeclared(surface.writer_entrypoints,writer)) {
      covReachableWriterMissing.push({inventory_kind:"surface",inventory_id:surface.surface_id,missing_writer:writer});
    }
    for (const target of route.targets||[]) if (!covTargetDeclared(surface.write_targets,target)) {
      covReachableTargetMissing.push({inventory_kind:"surface",inventory_id:surface.surface_id,missing_target:target});
    }
    covCheckDeclaredExactness("surface",surface.surface_id,surface,route);
  }
}

// deferred zero-set assertion: assert(covCallerMissing.length === 0, "production caller-triggered mutation without inventory", covCallerMissing);


const covExecutionAnalysisCache = new Map();
function covAnalyzeExecutedFunction(target, stack = new Set()) {
  const key = covFunctionKey(target);
  if (covExecutionAnalysisCache.has(key)) return covExecutionAnalysisCache.get(key);
  if (stack.has(key)) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), targets:new Set() };
  const next = new Set(stack);
  next.add(key);
  const mod = covBuildModule(target.fp);
  const node = mod.functions.get(target.name);
  if (!node) return { dml:false, ddl:false, fact:false, directWriterKeys:new Set(), targets:new Set() };

  const direct = covDirectSqlEffect(target.fp, node);
  const result = { dml:direct.dml, ddl:direct.ddl, fact:direct.fact, directWriterKeys:new Set(), targets:new Set() };
  if (direct.dml || direct.ddl) result.directWriterKeys.add(key);

  function merge(other) {
    result.dml = result.dml || other.dml;
    result.ddl = result.ddl || other.ddl;
    result.fact = result.fact || other.fact;
    for (const k of other.directWriterKeys) result.directWriterKeys.add(k);
    for (const t of other.targets || []) result.targets.add(t);
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
  const keyBase=rel(fp)+"::callback::"+node.pos+":"+node.end;
  if (stack.has(keyBase)) return {dml:false,ddl:false,fact:false,directWriterKeys:new Set(),callees:new Set(),targets:new Set()};
  const next=new Set(stack);
  next.add(keyBase);
  const direct=covDirectSqlEffect(fp,node);
  const result={
    dml:direct.dml, ddl:direct.ddl, fact:direct.fact,
    directWriterKeys:new Set(), callees:new Set(), targets:new Set(direct.targets||[])
  };
  if (direct.dml||direct.ddl) result.directWriterKeys.add(rel(fp)+"::<inline>");

  function merge(other) {
    result.dml=result.dml||other.dml;
    result.ddl=result.ddl||other.ddl;
    result.fact=result.fact||other.fact;
    for (const k of other.directWriterKeys||[]) result.directWriterKeys.add(k);
    for (const k of other.callees||[]) result.callees.add(k);
    for (const t of other.targets||[]) result.targets.add(t);
  }
  function walk(n) {
    if (n!==node && covFunctionLike(n) && !covImmediatelyInvokedFunction(n)) return;
    if (ts.isCallExpression(n)) {
      covAnalyzeReachableCallbackArgs(fp,n,next,merge);
      if (ts.isIdentifier(n.expression)) {
        const name=n.expression.text;
        if (!(name==="ensureDeviceSkillBindings" && covAllowWriteFalse(n))) {
          if (localMap?.has(name)) {
            merge(covAnalyzeCallbackNode(fp,localMap.get(name),localMap,next));
          } else {
            const lexical=covResolveLexicalCallable(fp,n,name);
            if (lexical?.kind==="node") {
              merge(covAnalyzeCallbackNode(fp,lexical.node,covLocalFunctionMap(lexical.scope),next));
            } else {
              const target=lexical?.kind==="target" ? lexical.target : covResolveFunction(fp,name);
              if (target) {
                result.callees.add(covFunctionKey(target));
                merge(covAnalyzeFunction(target,next));
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n,walk);
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
        return {supported:true,analysis:{dml:false,ddl:false,fact:false,directWriterKeys:new Set(),callees:new Set(),targets:new Set()}};
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
  const localMap = covLocalFunctionMap(node);
  const visited = new Set();

  function scanExecutable(container) {
    const key = container.pos + ":" + container.end;
    if (visited.has(key)) return false;
    visited.add(key);

    let invoked = false;
    function walk(n) {
      if (invoked) return;
      if (n !== container && covFunctionLike(n) && !covImmediatelyInvokedFunction(n)) return;

      if (ts.isCallExpression(n)) {
        if (ts.isIdentifier(n.expression)) {
          const name = n.expression.text;
          if (name === paramName) {
            invoked = true;
            return;
          }
          const local = localMap.get(name);
          if (local && scanExecutable(local)) {
            invoked = true;
            return;
          }
        }

        if (
          ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression) &&
          n.expression.expression.text === "Array" &&
          n.expression.name.text === "from"
        ) {
          const cb = n.arguments[1];
          if (
            cb &&
            (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) &&
            scanExecutable(cb)
          ) {
            invoked = true;
            return;
          }
          if (cb && ts.isIdentifier(cb)) {
            const local = localMap.get(cb.text);
            if (local && scanExecutable(local)) {
              invoked = true;
              return;
            }
          }
        }

        if (
          ts.isPropertyAccessExpression(n.expression) &&
          covImmediateCallbackMethods.has(n.expression.name.text)
        ) {
          for (const arg of n.arguments) {
            if (
              (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) &&
              scanExecutable(arg)
            ) {
              invoked = true;
              return;
            }
            if (ts.isIdentifier(arg)) {
              const local = localMap.get(arg.text);
              if (local && scanExecutable(local)) {
                invoked = true;
                return;
              }
            }
          }
        }
      }

      ts.forEachChild(n, walk);
    }

    walk(container);
    return invoked;
  }

  return scanExecutable(node);
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
      targets:[...(a.targets || [])],
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
  if (["CALLER_HOOK_PERSISTENT_WRITE","CALLER_TRIGGERED_HIGHER_ORDER_WRITER","TIMER_BACKGROUND_WRITER","EVENT_BACKGROUND_WRITER","DEFERRED_SERVER_CALLBACK_WRITER"].includes(d.effect_class) && !persistent) covCallbackClassMismatch.push({edge,disposition:d});
}
for (const d of covCallbackDispositions) {
  if (!covCallbackEdges.some((e)=>e.callback_id===d.callback_id)) covCallbackStale.push(d);
}
// deferred zero-set assertion: assert(covCallbackMissing.length === 0, "production callback/hook persistent writer without disposition", covCallbackMissing);
assert(covCallbackClassMismatch.length === 0, "callback/hook disposition effect class mismatch", covCallbackClassMismatch);

for (const edge of covCallbackEdges) {
  if (!(edge.dml||edge.ddl)) continue;
  const d=covCallbackDispositionById.get(edge.callback_id);
  if (!d) continue;
  for (const writer of edge.writers||[]) if (!covWriterDeclared(d.writer_entrypoints,writer)) {
    covReachableWriterMissing.push({inventory_kind:"callback_hook_disposition",inventory_id:d.callback_id,missing_writer:writer});
  }
  for (const target of edge.targets||[]) if (!covTargetDeclared(d.write_targets,target)) {
    covReachableTargetMissing.push({inventory_kind:"callback_hook_disposition",inventory_id:d.callback_id,missing_target:target});
  }
  covCheckDeclaredExactness("callback_hook_disposition",d.callback_id,d,{
    writers:edge.writers||[], targets:edge.targets||[]
  });
}

assert(covCallbackStale.length === 0, "stale callback/hook disposition", covCallbackStale);
// deferred zero-set assertion: assert(covReachableWriterMissing.length===0, "reachable writer missing from disposition.writer_entrypoints", covReachableWriterMissing);
// deferred zero-set assertion: assert(covReachableTargetMissing.length===0, "reachable persistent target missing from disposition.write_targets", covReachableTargetMissing);

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
// deferred zero-set assertion: assert(covStartupMissingUnique.length === 0, "startup mutation without explicit disposition", covStartupMissingUnique);

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
// deferred zero-set assertion: assert(covStartupRootMissing.length === 0, "startup mutation without explicit disposition from server startup graph", covStartupRootMissing);


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
// deferred zero-set assertion: assert(covRuntimeMissing.length === 0, "production runtime direct writer without inventory", covRuntimeMissing);



// Internal HTTP delegation graph.
function covNormalizeInternalTarget(text) {
  const raw=String(text||"");
  const idx=raw.indexOf("/api/");
  if (idx<0) return null;
  let target=raw.slice(idx);
  target=target.replace(/\$\{[^}]+\}/g,":dynamic");
  const quoteIndexes=['"',"'"].map((q)=>target.indexOf(q)).filter((x)=>x>=0);
  const tickIndex=target.indexOf(String.fromCharCode(96));
  if (tickIndex>=0) quoteIndexes.push(tickIndex);
  if (quoteIndexes.length) target=target.slice(0,Math.min(...quoteIndexes));
  target=target.replace(/[),;]+$/,"");
  return target.trim();
}
function covObjectProperty(obj,name) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const n=(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)) ? p.name.text : "";
    if (n===name) return p.initializer;
  }
  return null;
}
function covFetchMethod(call) {
  const init=call.arguments[1];
  const method=covObjectProperty(init,"method");
  if (method && (ts.isStringLiteral(method)||ts.isNoSubstitutionTemplateLiteral(method))) return method.text.toUpperCase();
  return "GET";
}
function covEnclosingText(call,fp) {
  let p=call.parent;
  while (p && !covFunctionLike(p)) p=p.parent;
  return p ? p.getText(covBuildModule(fp).sf) : "";
}
const covInternalDelegationEdges=[];
const covInternalDelegationSeen=new Set();
for (const fp of covFiles) {
  const sourcePath=rel(fp);
  if ((!fp.endsWith(".ts")&&!fp.endsWith(".tsx")) || isCommercialDisabledDevtools(fp) || sourcePath.startsWith("apps/server/src/services/flight_table/")) continue;
  const mod=covBuildModule(fp);
  const counters=new Map();
  function pushEdge(call,method,targetText,helperKind) {
    const target=covNormalizeInternalTarget(targetText);
    if (!target) return;
    const enclosing=covNearestFunctionName(call);
    const base=sourcePath+"::"+enclosing+"::"+method+"::"+target+"::"+helperKind;
    const ordinal=(counters.get(base)||0)+1;
    counters.set(base,ordinal);
    const edgeId=sourcePath+"#"+enclosing+"#"+method+":"+target+"#"+helperKind+"#"+ordinal;
    if (covInternalDelegationSeen.has(edgeId)) return;
    covInternalDelegationSeen.add(edgeId);
    const callText=call.getText(mod.sf);
    const enclosingText=covEnclosingText(call,fp);
    const transition=/GEOX_INTERNAL_TASK_ISSUER_TOKEN/.test(callText) || /GEOX_INTERNAL_TASK_ISSUER_TOKEN/.test(enclosingText);
    const forwards=/authorization/i.test(callText) || /req\.headers|authHeader|authz/.test(callText);
    covInternalDelegationEdges.push({
      delegation_id:edgeId,
      source_path:sourcePath,
      enclosing_symbol:enclosing,
      target_method:method,
      target_entrypoint:target,
      helper_kind:helperKind,
      principal_transition:transition,
      credential_observation:transition ? "GEOX_INTERNAL_TASK_ISSUER_TOKEN" : (forwards ? "FORWARD_CALLER_BEARER" : "UNRESOLVED_OR_NONE"),
    });
  }
  function visit(n) {
    if (ts.isCallExpression(n)) {
      if (ts.isIdentifier(n.expression) && n.expression.text==="fetch") {
        const url=n.arguments[0];
        if (url) {
          const urlText=url.getText(mod.sf);
          if (/\/api\//.test(urlText) && /(127\.0\.0\.1|buildInternalBaseUrl|hostBaseUrl|internalBaseUrl|GEOX_INTERNAL_BASE_URL|GEOX_BASE_URL)/.test(urlText)) {
            pushEdge(n,covFetchMethod(n),urlText,"DIRECT_FETCH");
          }
        }
      } else if (ts.isIdentifier(n.expression) && n.expression.text==="postJsonInternal") {
        const pathArg=n.arguments[2];
        if (pathArg && /\/api\//.test(pathArg.getText(mod.sf))) pushEdge(n,"POST",pathArg.getText(mod.sf),"POST_JSON_INTERNAL");
      } else if (ts.isIdentifier(n.expression) && n.expression.text==="fetchJson") {
        const urlArg=n.arguments[0];
        if (urlArg && /\/api\//.test(urlArg.getText(mod.sf))) {
          pushEdge(n,n.arguments.length>=3 ? "POST" : "GET",urlArg.getText(mod.sf),"FETCH_JSON_INTERNAL");
        }
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(mod.sf);
}
const covDelegationDispositions=inv.internal_http_delegation_dispositions ?? [];
const covDelegationById=new Map(covDelegationDispositions.map((d)=>[d.delegation_id,d]));
const covDelegationMissing=[];
const covPrincipalTransitionMissing=[];
const covDelegationStale=[];
for (const edge of covInternalDelegationEdges) {
  const d=covDelegationById.get(edge.delegation_id);
  if (!d) {
    covDelegationMissing.push(edge);
    if (edge.principal_transition) covPrincipalTransitionMissing.push(edge);
    continue;
  }
  assert(d.source_path===edge.source_path, "internal delegation source mismatch", {edge,disposition:d});
  assert(d.target_method===edge.target_method && d.target_entrypoint===edge.target_entrypoint, "internal delegation target mismatch", {edge,disposition:d});
  assert(typeof d.delegator_principal==="string" && d.delegator_principal, "internal delegation delegator principal missing", d);
  assert(typeof d.delegated_credential==="string" && d.delegated_credential, "internal delegation credential missing", d);
  assert(typeof d.delegated_principal==="string" && d.delegated_principal, "internal delegation delegated principal missing", d);
  assert(Array.isArray(d.target_capability), "internal delegation target capability missing", d);
  assert(Array.isArray(d.persistent_consequence), "internal delegation persistent consequence missing", d);
  if (edge.principal_transition) {
    assert(d.principal_transition===true, "production principal transition not declared", {edge,disposition:d});
    assert(d.delegated_credential==="GEOX_INTERNAL_TASK_ISSUER_TOKEN", "principal transition credential mismatch", {edge,disposition:d});
  }
}
for (const d of covDelegationDispositions) {
  if (!covInternalDelegationEdges.some((e)=>e.delegation_id===d.delegation_id)) covDelegationStale.push(d);
}
// deferred zero-set assertion: assert(covDelegationMissing.length===0, "production internal HTTP delegation edge without disposition", covDelegationMissing);
// deferred zero-set assertion: assert(covPrincipalTransitionMissing.length===0, "production principal transition without disposition", covPrincipalTransitionMissing);
assert(covDelegationStale.length===0, "stale internal HTTP delegation disposition", covDelegationStale);


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
  const escaped = service.replaceAll("-", "\\-");
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
const covLegacyTrackedAcceptanceBearer = serverBlock.includes("GEOX_TOKENS_FILE: /app/config/auth/security_acceptance_tokens.json");
const covW1IsolatedCredentialSource =
  !serverBlock.includes("GEOX_TOKENS_FILE: /app/config/auth/security_acceptance_tokens.json") &&
  serverBlock.includes("GEOX_TOKENS_JSON: ${GEOX_TOKENS_JSON:-}") &&
  serverBlock.includes("GEOX_TOKENS_FILE: ${GEOX_TOKENS_FILE:-}");
assert(covLegacyTrackedAcceptanceBearer || covW1IsolatedCredentialSource, "commercial credential source topology drift");
assert(serverBlock.includes("GEOX_INTERNAL_TASK_ISSUER_TOKEN:") && serverBlock.includes("operator_token"), "internal delegated bearer default drift");
assert(runtimeDockerfile.includes("COPY config ./config"), "runtime image config copy drift");
assert(hardeningDoc.includes("security_acceptance_tokens.json") && hardeningDoc.includes("only for test/dev acceptance"), "documented acceptance-token policy drift");
assert(hardeningDoc.includes("Staging/production must not use acceptance fixture"), "documented staging/production token policy drift");
assert(runtimeSecurity.includes('tokenPath.includes("example_tokens.json")'), "runtime security example-token check drift");
if (covLegacyTrackedAcceptanceBearer) {
  assert(!runtimeSecurity.includes("RUNTIME_ACCEPTANCE_TOKEN_FIXTURE_FORBIDDEN"), "legacy frozen credential topology unexpectedly gained W1 fixture rejection");
} else {
  assert(runtimeSecurity.includes("RUNTIME_ACCEPTANCE_TOKEN_FIXTURE_FORBIDDEN"), "W1 isolated credential topology missing tracked acceptance fixture rejection");
}

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
// deferred zero-set assertion: assert(covGlobalWorkerAmbiguous.length===0, "production global multi-tenant worker with ambiguous tenant-binding class", covGlobalWorkerAmbiguous);

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
  reachable_writer_missing_from_disposition_writer_entrypoints: covReachableWriterMissing.length,
  reachable_persistent_target_missing_from_disposition_write_targets: covReachableTargetMissing.length,
  declared_writer_without_reachable_persistent_writer: covDeclaredWriterWithoutReachablePersistentWriter.length,
  declared_sql_target_without_reachable_persistent_target: covDeclaredSqlTargetWithoutReachablePersistentTarget.length,
  production_internal_http_delegation_edge_without_disposition: covDelegationMissing.length,
  production_principal_transition_without_disposition: covPrincipalTransitionMissing.length,
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
  internal_http_delegation_disposition_count:covDelegationDispositions.length,
  discovered_internal_http_delegation_edge_count:covInternalDelegationEdges.length,
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
const covCompactCoverageFailure = {
  production_caller_triggered_mutation_without_inventory: covCallerMissing.map((x)=>({
    source_path:x.source_path, method:x.method, route:x.route,
  })),
  production_runtime_direct_writer_without_inventory: covRuntimeMissing,
  startup_mutation_without_explicit_disposition: [
    ...covStartupMissingUnique,
    ...covStartupRootMissing,
  ],
  production_callback_hook_persistent_writer_without_disposition: covCallbackMissing.map((x)=>({
    callback_id:x.callback_id, source_path:x.source_path, callback_kind:x.callback_kind, trigger:x.trigger, caller_route:x.caller_route ?? null,
  })),
  reachable_writer_missing_from_disposition_writer_entrypoints: covReachableWriterMissing,
  reachable_persistent_target_missing_from_disposition_write_targets: covReachableTargetMissing,
  declared_writer_without_reachable_persistent_writer: covDeclaredWriterWithoutReachablePersistentWriter,
  declared_sql_target_without_reachable_persistent_target: covDeclaredSqlTargetWithoutReachablePersistentTarget,
  production_internal_http_delegation_edge_without_disposition: covDelegationMissing.map((x)=>({
    delegation_id:x.delegation_id, source_path:x.source_path, enclosing_symbol:x.enclosing_symbol,
    target_method:x.target_method, target_entrypoint:x.target_entrypoint,
    helper_kind:x.helper_kind, principal_transition:x.principal_transition,
    credential_observation:x.credential_observation,
  })),
  production_principal_transition_without_disposition: covPrincipalTransitionMissing.map((x)=>({
    delegation_id:x.delegation_id, source_path:x.source_path,
    target_method:x.target_method, target_entrypoint:x.target_entrypoint,
    credential_observation:x.credential_observation,
  })),
  production_service_credential_without_principal_classification: covCredentialMissing,
  production_global_multi_tenant_worker_with_ambiguous_tenant_binding_class: covGlobalWorkerAmbiguous.map((x)=>({
    writer_id:x.writer_id, source_path:x.source_path, entry_symbol:x.entry_symbol,
    tenant_binding_class:x.tenant_binding_class, tenant_binding_detail:x.tenant_binding_detail ?? null,
  })),
};
const covCoverageClosed = Object.values(covZeroSets).every((n)=>n===0);
assert(covCoverageClosed, "PR-SEC-1 machine coverage zero-set closure failed", {
  zero_sets:covZeroSets,
  missing:covCompactCoverageFailure,
});

console.log("[BLINE_CALLER_AUTHORITY_INVENTORY] PASS");
