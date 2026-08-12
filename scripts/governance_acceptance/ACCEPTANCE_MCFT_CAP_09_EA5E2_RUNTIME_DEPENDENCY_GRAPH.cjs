#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const LIVE_WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const GRAPH_SCRIPT = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.cjs";
const ENTRYPOINTS = [
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
];
const STATIC_ROOTS = [LIVE_WORKFLOW, GRAPH_SCRIPT];
const REQUIRED_DISCOVERED = [
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json",
];
const REPO_TOKEN_RE = /(?:apps|scripts|docs|packages)\/[0-9A-Za-z_.@+\-/]+\.(?:ts|tsx|js|cjs|mjs|py|json|md|yml|yaml|sql)/g;

function repoFile(rel) {
  const normalized = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  const abs = path.resolve(ROOT, normalized);
  const rootPrefix = `${path.resolve(ROOT)}${path.sep}`;
  if (abs !== path.resolve(ROOT) && !abs.startsWith(rootPrefix)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return path.relative(ROOT, abs).replace(/\\/g, "/");
}

function resolveLocalImport(fromRel, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(ROOT, path.dirname(fromRel), specifier);
  const ext = path.extname(base);
  const candidates = [];
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/, ".ts"));
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/, ".tsx"));
    candidates.push(base);
  } else if (ext) {
    candidates.push(base);
  } else {
    for (const suffix of [".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".py"]) candidates.push(`${base}${suffix}`);
    for (const suffix of ["index.ts", "index.tsx", "index.js", "index.cjs", "index.mjs"]) candidates.push(path.join(base, suffix));
  }
  for (const candidate of candidates) {
    const rel = repoFile(path.relative(ROOT, candidate));
    if (rel) return rel;
  }
  return null;
}

function runtimeImports(rel, text) {
  const out = new Set();
  const patterns = [
    /\bimport\s+(?!type\b)(?:[^\"'`]*?\sfrom\s*)?[\"']([^\"']+)[\"']/g,
    /\bimport\(\s*[\"']([^\"']+)[\"']\s*\)/g,
    /\brequire\(\s*[\"']([^\"']+)[\"']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const resolved = resolveLocalImport(rel, match[1]);
      if (resolved) out.add(resolved);
    }
  }
  return out;
}

function repositoryPathReferences(text) {
  const out = new Set();
  for (const match of text.matchAll(REPO_TOKEN_RE)) {
    const resolved = repoFile(match[0]);
    if (resolved) out.add(resolved);
  }
  return out;
}

function shouldScan(rel) {
  return /\.(?:ts|tsx|js|cjs|mjs|py)$/.test(rel) && rel !== LIVE_WORKFLOW && rel !== GRAPH_SCRIPT;
}

function discoverGraph() {
  const discovered = new Set();
  const queue = [];
  for (const rel of [...STATIC_ROOTS, ...ENTRYPOINTS]) {
    const exact = repoFile(rel);
    if (!exact) throw new Error(`EA5E2_RUNTIME_DEPENDENCY_ROOT_MISSING:${rel}`);
    if (!discovered.has(exact)) {
      discovered.add(exact);
      queue.push(exact);
    }
  }

  while (queue.length) {
    const rel = queue.shift();
    if (!shouldScan(rel)) continue;
    const text = fs.readFileSync(path.resolve(ROOT, rel), "utf8");
    const next = new Set([...runtimeImports(rel, text), ...repositoryPathReferences(text)]);
    for (const child of next) {
      if (discovered.has(child)) continue;
      discovered.add(child);
      queue.push(child);
    }
  }
  return [...discovered].sort();
}

function parsePushPathPatterns() {
  const text = fs.readFileSync(path.resolve(ROOT, LIVE_WORKFLOW), "utf8");
  const push = text.indexOf("\n  push:\n");
  const paths = text.indexOf("\n    paths:\n", push);
  const end = text.indexOf("\n  workflow_dispatch:", paths);
  if (push < 0 || paths < 0 || end < 0) throw new Error("EA5E2_RUNTIME_DEPENDENCY_LIVE_PUSH_PATH_BLOCK_REQUIRED");
  const block = text.slice(paths, end);
  const values = [];
  for (const line of block.split(/\r?\n/)) {
    const match = /^\s+-\s+[\"']?([^\"']+?)[\"']?\s*$/.exec(line);
    if (match) values.push(match[1]);
  }
  if (!values.length) throw new Error("EA5E2_RUNTIME_DEPENDENCY_LIVE_PUSH_PATHS_REQUIRED");
  return values;
}

function globRegex(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function graphDigest(paths) {
  const hash = crypto.createHash("sha256");
  for (const rel of paths) {
    hash.update(rel, "utf8");
    hash.update("\0");
    hash.update(fs.readFileSync(path.resolve(ROOT, rel)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function main() {
  const dependencies = discoverGraph();
  for (const required of REQUIRED_DISCOVERED) {
    if (!dependencies.includes(required)) throw new Error(`EA5E2_RUNTIME_DEPENDENCY_DISCOVERY_REGRESSION:${required}`);
  }

  const triggerPatterns = parsePushPathPatterns();
  const triggerRegexes = triggerPatterns.map((pattern) => [pattern, globRegex(pattern)]);
  const uncovered = dependencies.filter((rel) => !triggerRegexes.some(([, re]) => re.test(rel)));
  if (uncovered.length) throw new Error(`EA5E2_RUNTIME_DEPENDENCY_NOT_COVERED_BY_LIVE_TRIGGER:${uncovered.join(",")}`);

  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_runtime_dependency_graph_v1",
    status: "PASS",
    entrypoints: [...ENTRYPOINTS],
    dependency_count: dependencies.length,
    dependency_paths: dependencies,
    dependency_graph_sha256: graphDigest(dependencies),
    live_push_path_patterns: triggerPatterns,
    uncovered_dependency_count: 0,
    dynamic_python_helper_bound: dependencies.includes("scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"),
    soil_executor_bound: dependencies.includes("apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts"),
    isolated_db_ingress_bound: dependencies.includes("apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts"),
    formal_runtime_config_bound: dependencies.includes("apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts"),
    crop_authority_runtime_file_bound: dependencies.includes("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json"),
    raw_value_emission_count: 0,
    database_write_count: 0,
    provider_request_count: 0,
  };

  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error("EA5E2_RUNTIME_DEPENDENCY_OUTPUT_PATH_REQUIRED");
    fs.mkdirSync(path.dirname(path.resolve(ROOT, output)), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, output), `${JSON.stringify(proof, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

main();
