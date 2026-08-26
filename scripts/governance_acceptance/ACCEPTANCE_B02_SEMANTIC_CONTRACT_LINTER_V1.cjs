#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const baseDir = path.join(repoRoot, "docs/architecture/semantic_convergence");
const registerPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const graphPath = path.join(baseDir, "GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const allowlistPath = path.join(baseDir, "GEOX-B02-STATIC-SCAN-ALLOWLIST-V1.json");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const abs = (p) => path.join(repoRoot, p);
const exists = (p) => fs.existsSync(abs(p));
const repoPath = (p) => path.relative(repoRoot, p).split(path.sep).join("/");

function listFiles(root, extensions, ignores) {
  const out = [];
  const stack = [abs(root)];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rp = repoPath(p);
      if (ignores.some((x) => rp.includes(x))) continue;
      if (e.isDirectory()) {
        if (!["node_modules","dist",".git"].includes(e.name)) stack.push(p);
      } else if (e.isFile() && (!extensions.length || extensions.some((x) => rp.endsWith(x)))) {
        out.push(p);
      }
    }
  }
  return out;
}

function matches(content, spec) {
  const all = Array.isArray(spec?.all_of) ? spec.all_of : [];
  const any = Array.isArray(spec?.any_of) ? spec.any_of : [];
  if (all.length && !all.every((x) => content.includes(String(x)))) return false;
  if (any.length && !any.some((x) => content.includes(String(x)))) return false;
  return all.length > 0 || any.length > 0;
}

function run() {
  const failures = [];
  const warnings = [];
  for (const p of [registerPath, graphPath, allowlistPath]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:" + repoPath(p));
  }
  if (failures.length) return finish(failures, warnings, {}, {});

  const register = readJson(registerPath);
  const graph = readJson(graphPath);
  const allowlist = readJson(allowlistPath);

  if (register.phase !== "B-02") failures.push("REGISTER_PHASE_INVALID:" + register.phase);
  if (graph.phase !== "B-02") failures.push("GRAPH_PHASE_INVALID:" + graph.phase);
  if (allowlist.phase !== "B-02") failures.push("ALLOWLIST_PHASE_INVALID:" + allowlist.phase);
  if (register.enforcement_model?.linter_scope !== "STATIC_EXPLICIT_ONLY") failures.push("REGISTER_LINTER_SCOPE_MUST_BE_STATIC_EXPLICIT_ONLY");

  const ccValues = new Set(register.connectivity_model?.connection_class_values || []);
  const activationValues = new Set(register.connectivity_model?.activation_values || []);
  const runtimeValues = new Set(register.connectivity_model?.runtime_edge_values || []);
  for (const required of ["MAINLINE","ACTIVE_PARALLEL","ROUTE_ISLAND","MANUAL_SEAM","ACCEPTANCE_LIBRARY_ISLAND","COMPATIBILITY","DEVTOOLS_ONLY","ORPHANED","INTENTIONAL_ISOLATION","REGISTERED_CAPABILITY_ISLAND","ACTIVE_LEGACY_WRITER"]) {
    if (!ccValues.has(required)) failures.push("CONNECTIVITY_CLASS_ENUM_MISSING:" + required);
  }

  const semantics = Array.isArray(register.semantics) ? register.semantics : [];
  const semanticIds = new Set();
  const producerIndex = new Map();
  const consumerIndex = new Map();

  for (const semantic of semantics) {
    const sid = String(semantic.semantic_id || "").trim();
    if (!sid) { failures.push("SEMANTIC_ID_MISSING"); continue; }
    if (semanticIds.has(sid)) failures.push("SEMANTIC_ID_DUPLICATE:" + sid);
    semanticIds.add(sid);
    for (const key of ["target_owner","canonical_output_type","new_owner_creation"]) {
      if (!String(semantic[key] || "").trim()) failures.push("SEMANTIC_FIELD_MISSING:" + sid + ":" + key);
    }
    if (!Array.isArray(semantic.registered_consumers)) failures.push("REGISTERED_CONSUMERS_MISSING:" + sid);
    if (!Array.isArray(semantic.runtime_consumers)) failures.push("RUNTIME_CONSUMERS_MISSING:" + sid);

    for (const p of Array.isArray(semantic.registered_producers) ? semantic.registered_producers : []) {
      const pid = String(p.producer_id || "").trim();
      const pp = String(p.path || "").trim();
      if (!pid) { failures.push("PRODUCER_ID_MISSING:" + sid); continue; }
      if (producerIndex.has(pid)) failures.push("PRODUCER_ID_GLOBAL_DUPLICATE:" + pid);
      producerIndex.set(pid, { semantic_id:sid, producer:p });
      if (!pp) failures.push("PRODUCER_PATH_MISSING:" + sid + ":" + pid);
      if (p.current !== false && pp && !exists(pp)) failures.push("REGISTERED_PRODUCER_PATH_MISSING:" + sid + ":" + pid + ":" + pp);
      for (const key of ["connection_class","activation","runtime_edge"]) if (!String(p[key] || "").trim()) failures.push("PRODUCER_CONNECTIVITY_FIELD_MISSING:" + sid + ":" + pid + ":" + key);
      if (!ccValues.has(p.connection_class)) failures.push("PRODUCER_CONNECTION_CLASS_INVALID:" + sid + ":" + pid + ":" + p.connection_class);
      if (!activationValues.has(p.activation)) failures.push("PRODUCER_ACTIVATION_INVALID:" + sid + ":" + pid + ":" + p.activation);
      if (!runtimeValues.has(p.runtime_edge)) failures.push("PRODUCER_RUNTIME_EDGE_INVALID:" + sid + ":" + pid + ":" + p.runtime_edge);
      if (p.grandfathered_duplicate === true) {
        const target = String(p.removal_target || "");
        if (!/^B-0[4-9]$/.test(target)) failures.push("GRANDFATHERED_REMOVAL_TARGET_INVALID:" + sid + ":" + pid + ":" + (target || "NONE"));
        if (!["FORBIDDEN","ALLOWED_ONLY_BY_EXPLICIT_REGISTER"].includes(semantic.new_owner_creation)) failures.push("GRANDFATHERED_NEW_OWNER_RULE_WEAK:" + sid + ":" + pid);
      }
      if (["COMPATIBILITY","ACTIVE_LEGACY_WRITER","DEVTOOLS_ONLY","ORPHANED","ACCEPTANCE_LIBRARY_ISLAND"].includes(p.connection_class)) {
        if (p.new_runtime_consumer_creation !== "FORBIDDEN") failures.push("COMPATIBILITY_PRODUCER_CAN_GAIN_NEW_RUNTIME_CONSUMER:" + sid + ":" + pid);
        if (!Array.isArray(p.grandfathered_runtime_consumers)) failures.push("COMPATIBILITY_RUNTIME_CONSUMER_SNAPSHOT_MISSING:" + sid + ":" + pid);
      }
      if (p.connection_class === "ROUTE_ISLAND" && p.activation !== "API_ONLY") failures.push("ROUTE_ISLAND_MUST_BE_EXPLICIT:" + sid + ":" + pid + ":activation=" + p.activation);
      if (p.connection_class === "ACTIVE_LEGACY_WRITER" && p.runtime_edge !== "PROVEN") failures.push("ACTIVE_LEGACY_WRITER_MUST_BE_REGISTERED:" + sid + ":" + pid);
      if (p.connection_class === "ORPHANED" && !(p.activation === "NOT_REFERENCED" && p.runtime_edge === "NONE")) failures.push("ORPHANED_SEMANTIC_EXPORT_MUST_BE_REGISTERED:" + sid + ":" + pid);
      if (p.connection_class === "MANUAL_SEAM" && p.activation !== "MANUAL") failures.push("MANUAL_SEAM_MUST_BE_EXPLICIT:" + sid + ":" + pid);
      if (p.current !== false && pp && exists(pp) && Array.isArray(p.fingerprints)) {
        const content = fs.readFileSync(abs(pp), "utf8");
        for (const fp of p.fingerprints) if (!content.includes(String(fp))) failures.push("PRODUCER_FINGERPRINT_MISSING:" + sid + ":" + pid + ":" + fp);
      }
    }

    for (const c of Array.isArray(semantic.registered_consumers) ? semantic.registered_consumers : []) {
      const cid = String(c.consumer_id || "").trim();
      const cp = String(c.path || "").trim();
      if (!cid) failures.push("CONSUMER_ID_MISSING:" + sid);
      const key = sid + "::" + cid;
      if (cid && consumerIndex.has(key)) failures.push("CONSUMER_ID_DUPLICATE_IN_SEMANTIC:" + key);
      if (cid) consumerIndex.set(key, { semantic_id:sid, consumer:c });
      if (!cp) failures.push("CONSUMER_PATH_MISSING:" + sid + ":" + (cid || "UNKNOWN"));
      if (c.current !== false && cp && !exists(cp)) failures.push("REGISTERED_CONSUMER_PATH_MISSING:" + sid + ":" + cid + ":" + cp);
      for (const field of ["connection_class","activation","runtime_edge"]) if (!String(c[field] || "").trim()) failures.push("CONSUMER_CONNECTIVITY_FIELD_MISSING:" + sid + ":" + cid + ":" + field);
      if (!ccValues.has(c.connection_class)) failures.push("CONSUMER_CONNECTION_CLASS_INVALID:" + sid + ":" + cid + ":" + c.connection_class);
      if (!activationValues.has(c.activation)) failures.push("CONSUMER_ACTIVATION_INVALID:" + sid + ":" + cid + ":" + c.activation);
      if (!runtimeValues.has(c.runtime_edge)) failures.push("CONSUMER_RUNTIME_EDGE_INVALID:" + sid + ":" + cid + ":" + c.runtime_edge);
    }

    for (const rc of semantic.runtime_consumers || []) {
      const cid = String(rc.consumer_id || "").trim();
      if (!(semantic.registered_consumers || []).some((c) => c.consumer_id === cid)) failures.push("RUNTIME_CONSUMER_NOT_REGISTERED:" + sid + ":" + cid);
      if (rc.runtime_edge !== "PROVEN") failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + sid + ":" + cid + ":runtime_edge=" + rc.runtime_edge);
      if (!String(rc.evidence_edge_id || "").trim()) failures.push("RUNTIME_CONSUMER_EVIDENCE_EDGE_MISSING:" + sid + ":" + cid);
    }
  }

  const allowByGuard = new Map();
  for (const rule of Array.isArray(allowlist.rules) ? allowlist.rules : []) {
    const gid = String(rule.guard_id || "");
    if (!gid) { failures.push("ALLOWLIST_GUARD_ID_MISSING"); continue; }
    allowByGuard.set(gid, new Set(Array.isArray(rule.additional_registered_paths) ? rule.additional_registered_paths : []));
    for (const p of allowByGuard.get(gid)) if (!exists(p)) failures.push("ALLOWLIST_PATH_MISSING:" + gid + ":" + p);
  }

  const guards = Array.isArray(register.static_guards) ? register.static_guards : [];
  const guardIds = new Set();
  for (const guard of guards) {
    const gid = String(guard.guard_id || "");
    const sid = String(guard.semantic_id || "");
    if (!gid) { failures.push("STATIC_GUARD_ID_MISSING"); continue; }
    if (guardIds.has(gid)) failures.push("STATIC_GUARD_ID_DUPLICATE:" + gid);
    guardIds.add(gid);
    if (!semanticIds.has(sid)) failures.push("STATIC_GUARD_UNKNOWN_SEMANTIC:" + gid + ":" + sid);

    const scanFiles = [];
    if (Array.isArray(guard.scan_files)) {
      for (const file of guard.scan_files) {
        if (!exists(file)) failures.push("STATIC_GUARD_SCAN_FILE_MISSING:" + gid + ":" + file);
        else scanFiles.push(abs(file));
      }
    } else {
      for (const root of Array.isArray(guard.scan_roots) ? guard.scan_roots : []) {
        if (!exists(root)) { failures.push("STATIC_GUARD_SCAN_ROOT_MISSING:" + gid + ":" + root); continue; }
        scanFiles.push(...listFiles(root, guard.extensions || [], guard.ignore_path_fragments || []));
      }
    }

    if (guard.forbid?.any_of_regex) {
      for (const file of scanFiles) {
        const content = fs.readFileSync(file, "utf8");
        for (const raw of guard.forbid.any_of_regex) {
          let re;
          try { re = new RegExp(raw, "m"); } catch { failures.push("STATIC_GUARD_REGEX_INVALID:" + gid + ":" + raw); continue; }
          if (re.test(content)) failures.push((guard.failure || "FORBIDDEN_PATTERN") + ":" + gid + ":" + repoPath(file));
        }
      }
      continue;
    }

    const allowed = new Set(Array.isArray(guard.registered_paths) ? guard.registered_paths : []);
    for (const p of allowByGuard.get(gid) || []) allowed.add(p);
    const matched = new Set();
    for (const file of scanFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (!matches(content, guard.match)) continue;
      const rp = repoPath(file);
      matched.add(rp);
      if (!allowed.has(rp)) failures.push((guard.failure || "UNREGISTERED_TOUCHPOINT") + ":" + gid + ":" + rp);
    }
    for (const p of allowed) {
      if (!exists(p)) failures.push("STATIC_GUARD_REGISTERED_PATH_MISSING:" + gid + ":" + p);
      else if (!matched.has(p)) failures.push("STATIC_GUARD_REGISTERED_FINGERPRINT_MISSING:" + gid + ":" + p);
    }
  }

  const edgeIds = new Set();
  const edgeId = (e, family) => {
    const id = String(e.edge_id || "");
    if (!id) failures.push("GRAPH_EDGE_ID_MISSING:" + family);
    else if (edgeIds.has(id)) failures.push("GRAPH_EDGE_ID_DUPLICATE:" + id);
    else edgeIds.add(id);
  };

  for (const e of graph.semantic_edges || []) {
    edgeId(e, "semantic_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push("GRAPH_UNKNOWN_FROM_SEMANTIC:" + e.edge_id + ":" + e.from);
    if (!semanticIds.has(String(e.to || ""))) failures.push("GRAPH_UNKNOWN_TO_SEMANTIC:" + e.edge_id + ":" + e.to);
  }
  for (const e of graph.current_parallel_edges || []) {
    edgeId(e, "current_parallel_edges");
    const sid = String(e.semantic_id || "");
    const pid = String(e.producer_id || "");
    const p = producerIndex.get(pid);
    if (!semanticIds.has(sid)) failures.push("PARALLEL_UNKNOWN_SEMANTIC:" + e.edge_id + ":" + sid);
    if (!p) failures.push("PARALLEL_UNKNOWN_PRODUCER:" + e.edge_id + ":" + pid);
    else if (p.semantic_id !== sid) failures.push("PARALLEL_PRODUCER_SEMANTIC_MISMATCH:" + e.edge_id + ":" + pid + ":" + sid);
    if (!/^B-0[4-9]$/.test(String(e.removal_target || ""))) failures.push("PARALLEL_REMOVAL_TARGET_INVALID:" + e.edge_id);
    if (e.new_owner_creation !== "FORBIDDEN") failures.push("PARALLEL_NEW_OWNER_NOT_FORBIDDEN:" + e.edge_id);
  }

  const connectivityEdges = Array.isArray(graph.current_connectivity_edges) ? graph.current_connectivity_edges : [];
  const connectivityById = new Map();
  for (const e of connectivityEdges) {
    edgeId(e, "current_connectivity_edges");
    connectivityById.set(e.edge_id, e);
    const sid = String(e.semantic_id || "");
    const pEntry = producerIndex.get(String(e.from_producer || ""));
    if (!semanticIds.has(sid)) failures.push("CONNECTIVITY_UNKNOWN_SEMANTIC:" + e.edge_id + ":" + sid);
    if (!pEntry) failures.push("CONNECTIVITY_UNKNOWN_PRODUCER:" + e.edge_id + ":" + e.from_producer);
    else if (pEntry.semantic_id !== sid) failures.push("CONNECTIVITY_PRODUCER_SEMANTIC_MISMATCH:" + e.edge_id + ":" + e.from_producer + ":" + sid);
    if (!ccValues.has(e.connection_class)) failures.push("CONNECTIVITY_CLASS_INVALID:" + e.edge_id + ":" + e.connection_class);
    if (!activationValues.has(e.activation)) failures.push("CONNECTIVITY_ACTIVATION_INVALID:" + e.edge_id + ":" + e.activation);
    if (!runtimeValues.has(e.runtime_edge)) failures.push("CONNECTIVITY_RUNTIME_EDGE_INVALID:" + e.edge_id + ":" + e.runtime_edge);
    if (!["CURRENT_PROVEN","ROUTE_ONLY","MANUAL","TEST_ONLY","NOT_WIRED"].includes(e.status)) failures.push("CONNECTIVITY_STATUS_INVALID:" + e.edge_id + ":" + e.status);
    const evidence = e.evidence || {};
    for (const key of ["kind","caller_path","callee_path","fingerprint"]) if (!String(evidence[key] || "").trim()) failures.push("DECLARED_RUNTIME_EDGE_REQUIRES_EVIDENCE:" + e.edge_id + ":" + key);
    if (String(evidence.caller_path || "") && !exists(evidence.caller_path)) failures.push("CONNECTIVITY_CALLER_PATH_MISSING:" + e.edge_id + ":" + evidence.caller_path);
    if (String(evidence.callee_path || "") && !exists(evidence.callee_path)) failures.push("CONNECTIVITY_CALLEE_PATH_MISSING:" + e.edge_id + ":" + evidence.callee_path);
    if (e.runtime_edge === "PROVEN" && !["CURRENT_PROVEN","ROUTE_ONLY","TEST_ONLY"].includes(e.status)) failures.push("PROVEN_RUNTIME_EDGE_STATUS_MISMATCH:" + e.edge_id + ":" + e.status);
    if (e.status === "CURRENT_PROVEN" && e.runtime_edge !== "PROVEN") failures.push("CURRENT_PROVEN_REQUIRES_PROVEN_EDGE:" + e.edge_id);
    if (e.status === "NOT_WIRED" && !["NONE","NOT_PROVEN","INTENTIONAL_NONE"].includes(e.runtime_edge)) failures.push("NOT_WIRED_EDGE_CANNOT_BE_PROVEN:" + e.edge_id);
    if (e.to_consumer !== "NONE") {
      const cKey = sid + "::" + e.to_consumer;
      if (!consumerIndex.has(cKey)) failures.push("CONNECTIVITY_UNKNOWN_CONSUMER:" + e.edge_id + ":" + e.to_consumer);
    }

    if (pEntry) {
      const p = pEntry.producer;
      if (p.new_runtime_consumer_creation === "FORBIDDEN" && e.to_consumer !== "NONE" && e.runtime_edge === "PROVEN") {
        const allowed = new Set(p.grandfathered_runtime_consumers || []);
        if (!allowed.has(e.to_consumer)) failures.push("COMPATIBILITY_PRODUCER_CANNOT_GAIN_NEW_RUNTIME_CONSUMER:" + e.edge_id + ":" + p.producer_id + ":" + e.to_consumer);
      }
    }
  }

  for (const semantic of semantics) {
    for (const rc of semantic.runtime_consumers || []) {
      const e = connectivityById.get(String(rc.evidence_edge_id || ""));
      if (!e) failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + semantic.semantic_id + ":" + rc.consumer_id + ":edge_missing");
      else if (e.runtime_edge !== "PROVEN") failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + semantic.semantic_id + ":" + rc.consumer_id + ":edge_not_proven");
      else if (e.to_consumer !== rc.consumer_id || e.from_producer !== rc.producer_id) failures.push("RUNTIME_CONSUMER_EDGE_MISMATCH:" + semantic.semantic_id + ":" + rc.consumer_id + ":" + e.edge_id);
    }
  }

  for (const e of graph.forbidden_edges || []) {
    edgeId(e, "forbidden_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push("FORBIDDEN_UNKNOWN_FROM_SEMANTIC:" + e.edge_id + ":" + e.from);
    if (!semanticIds.has(String(e.to || ""))) failures.push("FORBIDDEN_UNKNOWN_TO_SEMANTIC:" + e.edge_id + ":" + e.to);
    if (!String(e.reason || "").trim()) failures.push("FORBIDDEN_REASON_MISSING:" + e.edge_id);
    if (!String(e.enforcement || "").trim()) failures.push("FORBIDDEN_ENFORCEMENT_MISSING:" + e.edge_id);
  }

  const classCount = (name) => connectivityEdges.filter((e) => e.connection_class === name).length;
  const connectivityStats = {
    mainline_edges: classCount("MAINLINE"),
    active_parallel: classCount("ACTIVE_PARALLEL"),
    route_islands: classCount("ROUTE_ISLAND"),
    manual_seams: classCount("MANUAL_SEAM"),
    acceptance_only: classCount("ACCEPTANCE_LIBRARY_ISLAND"),
    active_legacy_writers: classCount("ACTIVE_LEGACY_WRITER"),
    orphans: classCount("ORPHANED"),
    intentional_isolation: classCount("INTENTIONAL_ISOLATION") + classCount("DEVTOOLS_ONLY"),
    registered_capability_islands: classCount("REGISTERED_CAPABILITY_ISLAND"),
    reporting_artifact_plane: classCount("REPORTING_ARTIFACT_PLANE"),
    unproven_runtime_edges: connectivityEdges.filter((e) => e.runtime_edge === "NOT_PROVEN").length,
    unknown_unclassified_production_edge: 0
  };

  finish(failures, warnings, {
    semantics: semanticIds.size,
    producers: producerIndex.size,
    registered_consumers: consumerIndex.size,
    runtime_consumers: semantics.reduce((n,s) => n + (s.runtime_consumers || []).length, 0),
    static_guards: guards.length,
    semantic_edges: (graph.semantic_edges || []).length,
    parallel_edges: (graph.current_parallel_edges || []).length,
    connectivity_edges: connectivityEdges.length,
    forbidden_edges: (graph.forbidden_edges || []).length
  }, connectivityStats);
}

function finish(failures, warnings, stats, connectivityStats) {
  for (const w of warnings) console.warn("WARN " + w);
  for (const f of failures) console.error("FAIL " + f);
  console.log("B02_SEMANTIC_REGISTER_STATS " + JSON.stringify(stats));
  console.log("B02_CONNECTIVITY_STATS " + JSON.stringify(connectivityStats));
  if (failures.length) {
    console.error("B02_SEMANTIC_CONTRACT_LINTER_FAIL count=" + failures.length);
    process.exitCode = 1;
  } else {
    console.log("B02_SEMANTIC_CONTRACT_LINTER_PASS");
  }
}

try { run(); }
catch (e) {
  console.error("B02_SEMANTIC_CONTRACT_LINTER_CRASH " + (e?.stack || String(e)));
  process.exitCode = 1;
}
