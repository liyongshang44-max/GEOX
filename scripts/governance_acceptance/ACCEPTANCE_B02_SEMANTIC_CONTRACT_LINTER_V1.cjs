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
        if (!["node_modules", "dist", ".git"].includes(e.name)) stack.push(p);
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
    if (!fs.existsSync(p)) failures.push(`REQUIRED_FILE_MISSING:${repoPath(p)}`);
  }
  if (failures.length) return finish(failures, warnings, {});

  const register = readJson(registerPath);
  const graph = readJson(graphPath);
  const allowlist = readJson(allowlistPath);

  if (register.phase !== "B-02") failures.push(`REGISTER_PHASE_INVALID:${register.phase}`);
  if (graph.phase !== "B-02") failures.push(`GRAPH_PHASE_INVALID:${graph.phase}`);
  if (allowlist.phase !== "B-02") failures.push(`ALLOWLIST_PHASE_INVALID:${allowlist.phase}`);
  if (register.enforcement_model?.linter_scope !== "STATIC_EXPLICIT_ONLY") {
    failures.push("REGISTER_LINTER_SCOPE_MUST_BE_STATIC_EXPLICIT_ONLY");
  }

  const semantics = Array.isArray(register.semantics) ? register.semantics : [];
  const semanticIds = new Set();
  const producerIndex = new Map();
  const consumerIndex = new Map();

  for (const semantic of semantics) {
    const sid = String(semantic.semantic_id || "").trim();
    if (!sid) { failures.push("SEMANTIC_ID_MISSING"); continue; }
    if (semanticIds.has(sid)) failures.push(`SEMANTIC_ID_DUPLICATE:${sid}`);
    semanticIds.add(sid);
    for (const key of ["target_owner", "canonical_output_type", "new_owner_creation"]) {
      if (!String(semantic[key] || "").trim()) failures.push(`SEMANTIC_FIELD_MISSING:${sid}:${key}`);
    }

    for (const p of Array.isArray(semantic.registered_producers) ? semantic.registered_producers : []) {
      const pid = String(p.producer_id || "").trim();
      const pp = String(p.path || "").trim();
      if (!pid) { failures.push(`PRODUCER_ID_MISSING:${sid}`); continue; }
      if (producerIndex.has(pid)) failures.push(`PRODUCER_ID_GLOBAL_DUPLICATE:${pid}`);
      producerIndex.set(pid, { semantic_id: sid, producer: p });
      if (!pp) failures.push(`PRODUCER_PATH_MISSING:${sid}:${pid}`);
      if (p.current !== false && pp && !exists(pp)) failures.push(`REGISTERED_PRODUCER_PATH_MISSING:${sid}:${pid}:${pp}`);
      if (p.grandfathered_duplicate === true) {
        const target = String(p.removal_target || "");
        if (!/^B-0[4-9]$/.test(target)) failures.push(`GRANDFATHERED_REMOVAL_TARGET_INVALID:${sid}:${pid}:${target || "NONE"}`);
        if (!["FORBIDDEN", "ALLOWED_ONLY_BY_EXPLICIT_REGISTER"].includes(semantic.new_owner_creation)) {
          failures.push(`GRANDFATHERED_NEW_OWNER_RULE_WEAK:${sid}:${pid}`);
        }
      }
      if (p.current !== false && pp && exists(pp) && Array.isArray(p.fingerprints)) {
        const content = fs.readFileSync(abs(pp), "utf8");
        for (const fp of p.fingerprints) if (!content.includes(String(fp))) failures.push(`PRODUCER_FINGERPRINT_MISSING:${sid}:${pid}:${fp}`);
      }
    }

    for (const c of Array.isArray(semantic.registered_consumers) ? semantic.registered_consumers : []) {
      const cid = String(c.consumer_id || "").trim();
      const cp = String(c.path || "").trim();
      if (!cid) failures.push(`CONSUMER_ID_MISSING:${sid}`);
      if (cid && consumerIndex.has(cid)) warnings.push(`CONSUMER_ID_REUSED:${cid}`);
      if (cid) consumerIndex.set(cid, { semantic_id: sid, consumer: c });
      if (!cp) failures.push(`CONSUMER_PATH_MISSING:${sid}:${cid || "UNKNOWN"}`);
      if (c.current !== false && cp && !exists(cp)) failures.push(`REGISTERED_CONSUMER_PATH_MISSING:${sid}:${cid}:${cp}`);
    }
  }

  const allowByGuard = new Map();
  for (const rule of Array.isArray(allowlist.rules) ? allowlist.rules : []) {
    const gid = String(rule.guard_id || "");
    if (!gid) { failures.push("ALLOWLIST_GUARD_ID_MISSING"); continue; }
    allowByGuard.set(gid, new Set(Array.isArray(rule.additional_registered_paths) ? rule.additional_registered_paths : []));
    for (const p of allowByGuard.get(gid)) if (!exists(p)) failures.push(`ALLOWLIST_PATH_MISSING:${gid}:${p}`);
  }

  const guards = Array.isArray(register.static_guards) ? register.static_guards : [];
  const guardIds = new Set();
  for (const guard of guards) {
    const gid = String(guard.guard_id || "");
    const sid = String(guard.semantic_id || "");
    if (!gid) { failures.push("STATIC_GUARD_ID_MISSING"); continue; }
    if (guardIds.has(gid)) failures.push(`STATIC_GUARD_ID_DUPLICATE:${gid}`);
    guardIds.add(gid);
    if (!semanticIds.has(sid)) failures.push(`STATIC_GUARD_UNKNOWN_SEMANTIC:${gid}:${sid}`);

    if (Array.isArray(guard.scan_files)) {
      for (const file of guard.scan_files) {
        if (!exists(file)) { failures.push(`STATIC_GUARD_SCAN_FILE_MISSING:${gid}:${file}`); continue; }
        const content = fs.readFileSync(abs(file), "utf8");
        for (const raw of Array.isArray(guard.forbid?.any_of_regex) ? guard.forbid.any_of_regex : []) {
          let re;
          try { re = new RegExp(raw, "m"); } catch (e) { failures.push(`STATIC_GUARD_REGEX_INVALID:${gid}:${raw}`); continue; }
          if (re.test(content)) failures.push(`${guard.failure || "FORBIDDEN_PATTERN"}:${gid}:${file}`);
        }
      }
      continue;
    }

    const allowed = new Set(Array.isArray(guard.registered_paths) ? guard.registered_paths : []);
    for (const p of allowByGuard.get(gid) || []) allowed.add(p);
    const matched = new Set();
    for (const root of Array.isArray(guard.scan_roots) ? guard.scan_roots : []) {
      if (!exists(root)) { failures.push(`STATIC_GUARD_SCAN_ROOT_MISSING:${gid}:${root}`); continue; }
      for (const file of listFiles(root, guard.extensions || [], guard.ignore_path_fragments || [])) {
        const content = fs.readFileSync(file, "utf8");
        if (!matches(content, guard.match)) continue;
        const rp = repoPath(file);
        matched.add(rp);
        if (!allowed.has(rp)) failures.push(`${guard.failure || "UNREGISTERED_TOUCHPOINT"}:${gid}:${rp}`);
      }
    }
    for (const p of allowed) {
      if (!exists(p)) failures.push(`STATIC_GUARD_REGISTERED_PATH_MISSING:${gid}:${p}`);
      else if (!matched.has(p)) failures.push(`STATIC_GUARD_REGISTERED_FINGERPRINT_MISSING:${gid}:${p}`);
    }
  }

  const edgeIds = new Set();
  const edgeId = (e, family) => {
    const id = String(e.edge_id || "");
    if (!id) failures.push(`GRAPH_EDGE_ID_MISSING:${family}`);
    else if (edgeIds.has(id)) failures.push(`GRAPH_EDGE_ID_DUPLICATE:${id}`);
    else edgeIds.add(id);
  };

  for (const e of graph.semantic_edges || []) {
    edgeId(e, "semantic_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push(`GRAPH_UNKNOWN_FROM_SEMANTIC:${e.edge_id}:${e.from}`);
    if (!semanticIds.has(String(e.to || ""))) failures.push(`GRAPH_UNKNOWN_TO_SEMANTIC:${e.edge_id}:${e.to}`);
  }
  for (const e of graph.current_parallel_edges || []) {
    edgeId(e, "current_parallel_edges");
    const sid = String(e.semantic_id || "");
    const pid = String(e.producer_id || "");
    const p = producerIndex.get(pid);
    if (!semanticIds.has(sid)) failures.push(`PARALLEL_UNKNOWN_SEMANTIC:${e.edge_id}:${sid}`);
    if (!p) failures.push(`PARALLEL_UNKNOWN_PRODUCER:${e.edge_id}:${pid}`);
    else if (p.semantic_id !== sid) failures.push(`PARALLEL_PRODUCER_SEMANTIC_MISMATCH:${e.edge_id}:${pid}:${sid}`);
    if (!/^B-0[4-9]$/.test(String(e.removal_target || ""))) failures.push(`PARALLEL_REMOVAL_TARGET_INVALID:${e.edge_id}`);
    if (e.new_owner_creation !== "FORBIDDEN") failures.push(`PARALLEL_NEW_OWNER_NOT_FORBIDDEN:${e.edge_id}`);
  }
  for (const e of graph.forbidden_edges || []) {
    edgeId(e, "forbidden_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push(`FORBIDDEN_UNKNOWN_FROM_SEMANTIC:${e.edge_id}:${e.from}`);
    if (!semanticIds.has(String(e.to || ""))) failures.push(`FORBIDDEN_UNKNOWN_TO_SEMANTIC:${e.edge_id}:${e.to}`);
    if (!String(e.reason || "").trim()) failures.push(`FORBIDDEN_REASON_MISSING:${e.edge_id}`);
    if (!String(e.enforcement || "").trim()) failures.push(`FORBIDDEN_ENFORCEMENT_MISSING:${e.edge_id}`);
  }

  finish(failures, warnings, {
    semantics: semanticIds.size,
    producers: producerIndex.size,
    consumers: consumerIndex.size,
    static_guards: guards.length,
    semantic_edges: (graph.semantic_edges || []).length,
    parallel_edges: (graph.current_parallel_edges || []).length,
    forbidden_edges: (graph.forbidden_edges || []).length
  });
}

function finish(failures, warnings, stats) {
  for (const w of warnings) console.warn(`WARN ${w}`);
  for (const f of failures) console.error(`FAIL ${f}`);
  console.log(`B02_SEMANTIC_REGISTER_STATS ${JSON.stringify(stats)}`);
  if (failures.length) {
    console.error(`B02_SEMANTIC_CONTRACT_LINTER_FAIL count=${failures.length}`);
    process.exitCode = 1;
  } else {
    console.log("B02_SEMANTIC_CONTRACT_LINTER_PASS");
  }
}

try { run(); }
catch (e) {
  console.error(`B02_SEMANTIC_CONTRACT_LINTER_CRASH ${e?.stack || String(e)}`);
  process.exitCode = 1;
}
