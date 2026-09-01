#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const BASE = path.join(ROOT, "docs/architecture/semantic_convergence");
const REGISTRY = path.join(BASE, "GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json");
const RESIDUAL = path.join(BASE, "GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json");
const RESIDUAL_SCANNER = path.join(ROOT, "scripts/governance_acceptance/ACCEPTANCE_BLINE_RESIDUAL_AUTHORITY_AUDIT_V1.cjs");
const ROOT_REGISTRY = "apps/server/src/modules/domain/registerDomainModules.ts";

const ALLOWED_ROLES = new Set([
  "AUTHORITY","DERIVER","ADAPTER","COMPATIBILITY","PROJECTION","READ_ONLY","ACTIVATION_ONLY","INFRASTRUCTURE"
]);
const REQUIRED_FIELDS = [
  "source_path","activation_parent","surface_role","delegates_to","replacement_path",
  "sunset_condition","semantic_family","runtime_reachable","owner"
];
const failures = [];
const warnings = [];
const edges = [];
const activeParents = new Map();
const visited = new Set();

const rel = p => path.relative(ROOT, p).split(path.sep).join("/");
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));
const esc = s => s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");

function resolveImport(importerPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const importerAbs = path.join(ROOT, importerPath);
  const raw = path.resolve(path.dirname(importerAbs), specifier);
  const candidates = [raw];
  if (raw.endsWith(".js")) candidates.push(raw.slice(0, -3) + ".ts", raw.slice(0, -3) + ".tsx");
  if (raw.endsWith(".mjs")) candidates.push(raw.slice(0, -4) + ".ts");
  if (!path.extname(raw)) candidates.push(raw + ".ts", raw + ".tsx", raw + ".js", path.join(raw, "index.ts"));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return rel(candidate);
  }
  return null;
}

function parseRegistrationImports(filePath) {
  const content = read(filePath);
  const out = [];
  const re = /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const sourcePath = resolveImport(filePath, String(m[2] || ""));
    if (!sourcePath) continue;
    for (const rawBinding of String(m[1] || "").split(",")) {
      const binding = rawBinding.trim().replace(/^type\s+/, "");
      if (!binding) continue;
      const parts = binding.split(/\s+as\s+/i).map(x => x.trim());
      const importedName = parts[0];
      const localName = parts[1] || importedName;
      if (!/^(?:register|install)[A-Z]/.test(importedName)) continue;
      const call = new RegExp("\\b" + esc(localName) + "\\s*\\(", "m");
      if (!call.test(content)) continue;
      out.push({ importedName, localName, sourcePath });
    }
  }
  return out;
}

function addParent(child, parent) {
  const set = activeParents.get(child) || new Set();
  set.add(parent);
  activeParents.set(child, set);
}

function walkRegistrationGraph(filePath) {
  if (visited.has(filePath)) return;
  visited.add(filePath);
  if (!fs.existsSync(path.join(ROOT, filePath))) {
    failures.push("ACTIVE_GRAPH_FILE_MISSING:" + filePath);
    return;
  }
  for (const x of parseRegistrationImports(filePath)) {
    edges.push({ parent: filePath, child: x.sourcePath, symbol: x.importedName, local: x.localName });
    addParent(x.sourcePath, filePath);
    walkRegistrationGraph(x.sourcePath);
  }
}

function parseScannerArray(source, name) {
  const m = source.match(new RegExp("const\\s+" + name + "\\s*=\\s*\\[([\\s\\S]*?)\\];"));
  if (!m) {
    failures.push("SCANNER_ARRAY_NOT_FOUND:" + name);
    return [];
  }
  return [...String(m[1]).matchAll(/["']([^"']+)["']/g)].map(x => x[1]);
}

function exactArrayEqual(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
}

function hasSemanticWrite(filePath) {
  const content = read(filePath);
  const reasons = [];
  if (/app\.(?:post|put|patch|delete)\s*\(/.test(content)) reasons.push("mutating-http-method");
  if (/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_."']+\s+SET|DELETE\s+FROM)\b/i.test(content)) reasons.push("sql-dml");
  const hidden = [
    "ensureSkillRunFact","updateRulePerformance","recordRulePerformance",
    "recordMemoryV1","appendFact","insertFact","writeFact"
  ];
  for (const name of hidden) {
    if (new RegExp("\\b" + esc(name) + "\\s*\\(").test(content)) reasons.push("call:" + name);
  }
  return reasons;
}

function isStaleOrphan(surface) {
  const a = String(surface.activation_mode || "").toUpperCase();
  const r = String(surface.runtime_reachable || "").toUpperCase();
  const c = String(surface.authority_class || "").toUpperCase();
  return /(ORPHAN|NOT_REFERENCED|STALE)/.test(a) ||
    /(NOT_PROVEN|NOT_REFERENCED|ORPHAN)/.test(r) ||
    /(ORPHAN|STALE)/.test(c);
}

function main() {
  for (const p of [REGISTRY, RESIDUAL, RESIDUAL_SCANNER, path.join(ROOT, ROOT_REGISTRY)]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:" + rel(p));
  }
  if (failures.length) return finish();

  const registry = readJson(REGISTRY);
  const residual = readJson(RESIDUAL);
  const scanner = fs.readFileSync(RESIDUAL_SCANNER, "utf8");

  if (registry.schema_version !== "bline_active_runtime_surface_disposition_v1") {
    failures.push("ACTIVE_REGISTRY_SCHEMA_VERSION_INVALID");
  }
  if (registry.root_registry !== ROOT_REGISTRY) failures.push("ACTIVE_REGISTRY_ROOT_MISMATCH");

  const byPath = new Map();
  for (const row of Array.isArray(registry.surfaces) ? registry.surfaces : []) {
    const p = String(row.source_path || "").trim();
    if (!p) { failures.push("ACTIVE_DISPOSITION_PATH_MISSING:" + String(row.surface_id || "")); continue; }
    if (byPath.has(p)) failures.push("ACTIVE_DISPOSITION_DUPLICATE_PATH:" + p);
    byPath.set(p, row);
    for (const k of REQUIRED_FIELDS) if (!Object.hasOwn(row, k)) failures.push("ACTIVE_DISPOSITION_FIELD_MISSING:" + p + ":" + k);
    if (!ALLOWED_ROLES.has(String(row.surface_role || ""))) failures.push("ACTIVE_DISPOSITION_ROLE_INVALID:" + p);
    if (!Array.isArray(row.activation_parent)) failures.push("ACTIVE_DISPOSITION_PARENT_NOT_ARRAY:" + p);
    if (!Array.isArray(row.delegates_to)) failures.push("ACTIVE_DISPOSITION_DELEGATES_NOT_ARRAY:" + p);
    if (!Array.isArray(row.replacement_path)) failures.push("ACTIVE_DISPOSITION_REPLACEMENT_NOT_ARRAY:" + p);
    if (!Array.isArray(row.semantic_family)) failures.push("ACTIVE_DISPOSITION_FAMILY_NOT_ARRAY:" + p);
    if (!fs.existsSync(path.join(ROOT, p))) failures.push("ACTIVE_DISPOSITION_CURRENT_PATH_MISSING:" + p);
  }

  walkRegistrationGraph(ROOT_REGISTRY);
  const activePaths = new Set([ROOT_REGISTRY, ...activeParents.keys()]);

  for (const p of [...activePaths].sort()) {
    if (!byPath.has(p)) failures.push("ACTIVE_RUNTIME_SURFACE_WITHOUT_DISPOSITION:" + p);
  }

  for (const [p, parents] of activeParents.entries()) {
    const row = byPath.get(p);
    if (!row) continue;
    const declared = new Set((row.activation_parent || []).map(String));
    for (const parent of parents) {
      if (!declared.has(parent)) failures.push("ACTIVE_PARENT_EDGE_UNDECLARED:" + p + ":" + parent);
    }
  }

  const residualRows = Array.isArray(residual.surfaces) ? residual.surfaces : [];
  const residualByPath = new Map();
  for (const row of residualRows) {
    const p = String(row.source_path || "").trim();
    if (!p) continue;
    const list = residualByPath.get(p) || [];
    list.push(row);
    residualByPath.set(p, list);
    if (activePaths.has(p) && isStaleOrphan(row)) {
      failures.push("STALE_ORPHAN_CLASSIFICATION_CONTRADICTS_MODULE_GRAPH:" + String(row.surface_id || "") + ":" + p);
    }
  }

  for (const [p, row] of byPath.entries()) {
    if (!activePaths.has(p)) continue;
    const role = String(row.surface_role || "");
    if (role === "READ_ONLY" || role === "PROJECTION") {
      for (const reason of hasSemanticWrite(p)) failures.push("READ_ROUTE_WITH_SEMANTIC_WRITE:" + p + ":" + reason);
    }

    const families = Array.isArray(row.semantic_family) ? row.semantic_family.map(String) : [];
    const onlyPresentation = families.length > 0 && families.every(f =>
      f === "presentation.read_model" || f === "governance.runtime_activation" || f === "governance.trace_projection"
    );
    const authorityRole = ["AUTHORITY","DERIVER","ADAPTER"].includes(role) || (role === "COMPATIBILITY" && !onlyPresentation);
    if (authorityRole && !residualByPath.has(p)) {
      failures.push("AUTHORITY_DISPOSITION_WITHOUT_RESIDUAL_INVENTORY:" + p + ":" + role);
    }

    for (const delegate of Array.isArray(row.delegates_to) ? row.delegates_to : []) {
      const d = String(delegate || "").trim();
      if (!d) continue;
      if (!fs.existsSync(path.join(ROOT, d))) failures.push("DECLARED_DELEGATE_PATH_MISSING:" + p + ":" + d);
      if (!byPath.has(d) && !residualByPath.has(d) && role !== "ACTIVATION_ONLY") {
        failures.push("DELEGATE_WITHOUT_DISPOSITION_OR_INVENTORY:" + p + ":" + d);
      }
    }
  }

  const expectedRoots = [
    ...parseScannerArray(scanner, "PROD_ROOTS"),
    ...parseScannerArray(scanner, "AUX_ROOTS")
  ];
  const expectedFiles = parseScannerArray(scanner, "PROD_FILES");
  if (!exactArrayEqual(residual.scan_roots, expectedRoots)) {
    failures.push("INVENTORY_METADATA_DRIFT:scan_roots");
  }
  if (!exactArrayEqual(residual.scan_files, expectedFiles)) {
    failures.push("INVENTORY_METADATA_DRIFT:scan_files");
  }

  const legacyTwin = [
    "apps/server/src/routes/v1/twin_kernel.ts",
    "apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts",
    "apps/server/src/domain/twin_kernel/forecast_run_v1.ts",
    "apps/server/src/domain/twin_kernel/scenario_set_v1.ts",
    "apps/server/src/domain/twin_kernel/calibration_replay_v1.ts",
    "apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts",
    "apps/server/src/routes/v1/twin_kernel_production_ingestion.ts"
  ];
  for (const p of legacyTwin) {
    const rows = residualByPath.get(p) || [];
    const declared = rows.some(row => {
      const cls = String(row.authority_class || "").toUpperCase();
      const removal = String(row.removal_target || "").toUpperCase();
      return cls.includes("LEGACY_TWIN") && /(MCFT|SHADOW|REPLAY|TRACE)/.test(removal);
    });
    if (!declared) failures.push("LEGACY_TWIN_AUTHORITY_NOT_DECLARED:" + p);
  }

  console.log("BLINE_ACTIVE_RUNTIME_GRAPH " + JSON.stringify({
    root: ROOT_REGISTRY,
    active_surface_count: activePaths.size,
    edge_count: edges.length,
    disposition_count: byPath.size,
    missing_disposition_count: failures.filter(x => x.startsWith("ACTIVE_RUNTIME_SURFACE_WITHOUT_DISPOSITION:")).length,
    edges
  }));

  finish();
}

function finish() {
  for (const w of warnings) console.warn("WARN " + w);
  for (const f of failures) console.error("FAIL " + f);
  console.log("BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_STATS " + JSON.stringify({
    failures: failures.length,
    warnings: warnings.length,
    failure_classes: [...new Set(failures.map(x => x.split(":")[0]))].sort()
  }));
  if (failures.length) {
    console.error("BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_FAIL count=" + failures.length);
    process.exitCode = 1;
  } else {
    console.log("BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_PASS");
  }
}

try { main(); }
catch (e) {
  console.error("BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_CRASH " + (e?.stack || String(e)));
  process.exitCode = 1;
}
