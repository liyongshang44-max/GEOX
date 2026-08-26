#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const registerPath = path.join(
  repoRoot,
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
);
const graphPath = path.join(
  repoRoot,
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toRepoPath(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

function existsRepoPath(repoPath) {
  return fs.existsSync(path.join(repoRoot, repoPath));
}

function listFilesRecursive(rootAbs, extensions, ignoreFragments) {
  const out = [];
  if (!fs.existsSync(rootAbs)) return out;
  const stack = [rootAbs];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const repoPath = toRepoPath(abs);
      if (ignoreFragments.some((fragment) => repoPath.includes(fragment))) continue;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (extensions.length > 0 && !extensions.some((ext) => repoPath.endsWith(ext))) continue;
      out.push(abs);
    }
  }
  return out;
}

function contentMatches(content, match) {
  if (!match || typeof match !== "object") return false;
  const allOf = Array.isArray(match.all_of) ? match.all_of : [];
  const anyOf = Array.isArray(match.any_of) ? match.any_of : [];
  if (allOf.length > 0 && !allOf.every((token) => content.includes(String(token)))) return false;
  if (anyOf.length > 0 && !anyOf.some((token) => content.includes(String(token)))) return false;
  return allOf.length > 0 || anyOf.length > 0;
}

function run() {
  const failures = [];
  const warnings = [];

  if (!fs.existsSync(registerPath)) failures.push("REGISTER_MISSING");
  if (!fs.existsSync(graphPath)) failures.push("GRAPH_MISSING");
  if (failures.length > 0) return finish(failures, warnings, {});

  const register = readJson(registerPath);
  const graph = readJson(graphPath);

  if (register.phase !== "B-02") failures.push(`REGISTER_PHASE_INVALID:${String(register.phase)}`);
  if (graph.phase !== "B-02") failures.push(`GRAPH_PHASE_INVALID:${String(graph.phase)}`);
  if (register.enforcement_model?.linter_scope !== "STATIC_EXPLICIT_ONLY") {
    failures.push("REGISTER_LINTER_SCOPE_MUST_BE_STATIC_EXPLICIT_ONLY");
  }

  const semantics = Array.isArray(register.semantics) ? register.semantics : [];
  if (semantics.length === 0) failures.push("REGISTER_SEMANTICS_EMPTY");

  const semanticIds = new Set();
  const producerIndex = new Map();
  const currentProducerPaths = new Set();

  for (const semantic of semantics) {
    const sid = String(semantic.semantic_id || "").trim();
    if (!sid) {
      failures.push("SEMANTIC_ID_MISSING");
      continue;
    }
    if (semanticIds.has(sid)) failures.push(`SEMANTIC_ID_DUPLICATE:${sid}`);
    semanticIds.add(sid);

    if (!String(semantic.target_owner || "").trim()) failures.push(`TARGET_OWNER_MISSING:${sid}`);
    if (!String(semantic.canonical_output_type || "").trim()) failures.push(`CANONICAL_OUTPUT_TYPE_MISSING:${sid}`);
    if (!String(semantic.new_owner_creation || "").trim()) failures.push(`NEW_OWNER_RULE_MISSING:${sid}`);

    const producers = Array.isArray(semantic.registered_producers) ? semantic.registered_producers : [];
    const localProducerIds = new Set();
    for (const producer of producers) {
      const pid = String(producer.producer_id || "").trim();
      const ppath = String(producer.path || "").trim();
      if (!pid) {
        failures.push(`PRODUCER_ID_MISSING:${sid}`);
        continue;
      }
      if (localProducerIds.has(pid)) failures.push(`PRODUCER_ID_DUPLICATE_WITHIN_SEMANTIC:${sid}:${pid}`);
      localProducerIds.add(pid);
      if (producerIndex.has(pid)) failures.push(`PRODUCER_ID_GLOBAL_DUPLICATE:${pid}`);
      producerIndex.set(pid, { semantic_id: sid, producer });

      if (!ppath) failures.push(`PRODUCER_PATH_MISSING:${sid}:${pid}`);
      if (producer.current !== false && ppath) {
        currentProducerPaths.add(ppath);
        if (!existsRepoPath(ppath)) failures.push(`REGISTERED_PRODUCER_PATH_MISSING:${sid}:${pid}:${ppath}`);
      }

      if (producer.grandfathered_duplicate === true) {
        const removal = String(producer.removal_target || "").trim();
        if (!/^B-0[4-9]$/.test(removal)) {
          failures.push(`GRANDFATHERED_DUPLICATE_REMOVAL_TARGET_INVALID:${sid}:${pid}:${removal || "NONE"}`);
        }
        if (semantic.new_owner_creation !== "FORBIDDEN" && semantic.new_owner_creation !== "ALLOWED_ONLY_BY_EXPLICIT_REGISTER") {
          failures.push(`GRANDFATHERED_DUPLICATE_NEW_OWNER_RULE_WEAK:${sid}:${pid}`);
        }
      }

      const fingerprints = Array.isArray(producer.fingerprints) ? producer.fingerprints : [];
      if (producer.current !== false && ppath && fingerprints.length > 0 && existsRepoPath(ppath)) {
        const content = fs.readFileSync(path.join(repoRoot, ppath), "utf8");
        for (const fingerprint of fingerprints) {
          if (!content.includes(String(fingerprint))) {
            failures.push(`REGISTERED_PRODUCER_FINGERPRINT_MISSING:${sid}:${pid}:${fingerprint}`);
          }
        }
      }
    }

    const consumers = Array.isArray(semantic.registered_consumers) ? semantic.registered_consumers : [];
    for (const consumer of consumers) {
      const cid = String(consumer.consumer_id || "").trim();
      const cpath = String(consumer.path || "").trim();
      if (!cid) failures.push(`CONSUMER_ID_MISSING:${sid}`);
      if (!cpath) failures.push(`CONSUMER_PATH_MISSING:${sid}:${cid || "UNKNOWN"}`);
      if (consumer.current !== false && cpath && !existsRepoPath(cpath)) {
        failures.push(`REGISTERED_CONSUMER_PATH_MISSING:${sid}:${cid}:${cpath}`);
      }
    }
  }

  const guards = Array.isArray(register.static_guards) ? register.static_guards : [];
  const guardIds = new Set();
  for (const guard of guards) {
    const gid = String(guard.guard_id || "").trim();
    const sid = String(guard.semantic_id || "").trim();
    if (!gid) {
      failures.push("STATIC_GUARD_ID_MISSING");
      continue;
    }
    if (guardIds.has(gid)) failures.push(`STATIC_GUARD_ID_DUPLICATE:${gid}`);
    guardIds.add(gid);
    if (!semanticIds.has(sid)) failures.push(`STATIC_GUARD_UNKNOWN_SEMANTIC:${gid}:${sid}`);

    if (Array.isArray(guard.scan_files)) {
      const patterns = Array.isArray(guard.forbid?.any_of_regex) ? guard.forbid.any_of_regex : [];
      if (patterns.length === 0) failures.push(`STATIC_GUARD_FORBID_REGEX_EMPTY:${gid}`);
      for (const repoPath of guard.scan_files) {
        if (!existsRepoPath(repoPath)) {
          failures.push(`STATIC_GUARD_SCAN_FILE_MISSING:${gid}:${repoPath}`);
          continue;
        }
        const content = fs.readFileSync(path.join(repoRoot, repoPath), "utf8");
        for (const rawPattern of patterns) {
          let regex;
          try {
            regex = new RegExp(rawPattern, "m");
          } catch (error) {
            failures.push(`STATIC_GUARD_REGEX_INVALID:${gid}:${rawPattern}:${String(error.message || error)}`);
            continue;
          }
          if (regex.test(content)) failures.push(`${guard.failure || "FORBIDDEN_PATTERN"}:${gid}:${repoPath}:${rawPattern}`);
        }
      }
      continue;
    }

    const roots = Array.isArray(guard.scan_roots) ? guard.scan_roots : [];
    const extensions = Array.isArray(guard.extensions) ? guard.extensions : [];
    const ignoreFragments = Array.isArray(guard.ignore_path_fragments) ? guard.ignore_path_fragments : [];
    const registeredPaths = new Set(Array.isArray(guard.registered_paths) ? guard.registered_paths : []);
    const matchedPaths = new Set();

    for (const root of roots) {
      const rootAbs = path.join(repoRoot, root);
      if (!fs.existsSync(rootAbs)) {
        failures.push(`STATIC_GUARD_SCAN_ROOT_MISSING:${gid}:${root}`);
        continue;
      }
      for (const abs of listFilesRecursive(rootAbs, extensions, ignoreFragments)) {
        const content = fs.readFileSync(abs, "utf8");
        if (!contentMatches(content, guard.match)) continue;
        const repoPath = toRepoPath(abs);
        matchedPaths.add(repoPath);
        if (!registeredPaths.has(repoPath)) {
          failures.push(`${guard.failure || "UNREGISTERED_SEMANTIC_TOUCHPOINT"}:${gid}:${repoPath}`);
        }
      }
    }

    for (const repoPath of registeredPaths) {
      if (!existsRepoPath(repoPath)) {
        failures.push(`STATIC_GUARD_REGISTERED_PATH_MISSING:${gid}:${repoPath}`);
        continue;
      }
      if (!matchedPaths.has(repoPath)) {
        failures.push(`STATIC_GUARD_REGISTERED_FINGERPRINT_MISSING:${gid}:${repoPath}`);
      }
    }
  }

  const semanticEdges = Array.isArray(graph.semantic_edges) ? graph.semantic_edges : [];
  const parallelEdges = Array.isArray(graph.current_parallel_edges) ? graph.current_parallel_edges : [];
  const forbiddenEdges = Array.isArray(graph.forbidden_edges) ? graph.forbidden_edges : [];
  const graphEdgeIds = new Set();

  function registerEdgeId(edge, family) {
    const eid = String(edge.edge_id || "").trim();
    if (!eid) {
      failures.push(`GRAPH_EDGE_ID_MISSING:${family}`);
      return;
    }
    if (graphEdgeIds.has(eid)) failures.push(`GRAPH_EDGE_ID_DUPLICATE:${eid}`);
    graphEdgeIds.add(eid);
  }

  for (const edge of semanticEdges) {
    registerEdgeId(edge, "semantic_edges");
    if (!semanticIds.has(String(edge.from || ""))) failures.push(`GRAPH_UNKNOWN_FROM_SEMANTIC:${edge.edge_id}:${edge.from}`);
    if (!semanticIds.has(String(edge.to || ""))) failures.push(`GRAPH_UNKNOWN_TO_SEMANTIC:${edge.edge_id}:${edge.to}`);
  }

  for (const edge of parallelEdges) {
    registerEdgeId(edge, "current_parallel_edges");
    const sid = String(edge.semantic_id || "");
    const pid = String(edge.producer_id || "");
    if (!semanticIds.has(sid)) failures.push(`PARALLEL_EDGE_UNKNOWN_SEMANTIC:${edge.edge_id}:${sid}`);
    const producer = producerIndex.get(pid);
    if (!producer) failures.push(`PARALLEL_EDGE_UNKNOWN_PRODUCER:${edge.edge_id}:${pid}`);
    else if (producer.semantic_id !== sid) failures.push(`PARALLEL_EDGE_PRODUCER_SEMANTIC_MISMATCH:${edge.edge_id}:${pid}:${sid}`);
    if (!/^B-0[4-9]$/.test(String(edge.removal_target || ""))) {
      failures.push(`PARALLEL_EDGE_REMOVAL_TARGET_INVALID:${edge.edge_id}:${String(edge.removal_target || "NONE")}`);
    }
    if (edge.new_owner_creation !== "FORBIDDEN") failures.push(`PARALLEL_EDGE_NEW_OWNER_NOT_FORBIDDEN:${edge.edge_id}`);
  }

  for (const edge of forbiddenEdges) {
    registerEdgeId(edge, "forbidden_edges");
    if (!semanticIds.has(String(edge.from || ""))) failures.push(`FORBIDDEN_EDGE_UNKNOWN_FROM_SEMANTIC:${edge.edge_id}:${edge.from}`);
    if (!semanticIds.has(String(edge.to || ""))) failures.push(`FORBIDDEN_EDGE_UNKNOWN_TO_SEMANTIC:${edge.edge_id}:${edge.to}`);
    if (!String(edge.reason || "").trim()) failures.push(`FORBIDDEN_EDGE_REASON_MISSING:${edge.edge_id}`);
    if (!String(edge.enforcement || "").trim()) failures.push(`FORBIDDEN_EDGE_ENFORCEMENT_MISSING:${edge.edge_id}`);
  }

  const stats = {
    semantics: semanticIds.size,
    producers: producerIndex.size,
    current_producer_paths: currentProducerPaths.size,
    static_guards: guards.length,
    semantic_edges: semanticEdges.length,
    parallel_edges: parallelEdges.length,
    forbidden_edges: forbiddenEdges.length,
  };

  finish(failures, warnings, stats);
}

function finish(failures, warnings, stats) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`B02_SEMANTIC_REGISTER_STATS ${JSON.stringify(stats)}`);
  if (failures.length > 0) {
    console.error(`B02_SEMANTIC_CONTRACT_LINTER_FAIL count=${failures.length}`);
    process.exitCode = 1;
    return;
  }
  console.log("B02_SEMANTIC_CONTRACT_LINTER_PASS");
}

try {
  run();
} catch (error) {
  console.error(`B02_SEMANTIC_CONTRACT_LINTER_CRASH ${error && error.stack ? error.stack : String(error)}`);
  process.exitCode = 1;
}
