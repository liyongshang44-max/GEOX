#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const STATIC_GATE_WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml";
const BINDING_CARRIER = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const BINDING_PLACEHOLDER = "__EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256__";
const ENTRYPOINTS = [
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
];
const STATIC_BINDING_ROOTS = [
  LIVE,
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
  BINDING_CARRIER,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json",
];
const TOOLCHAIN_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "apps/server/package.json",
];
const REQUIRED_RUNTIME_DISCOVERY = [
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
  "apps/server/src/domain/soil_water/hourly_water_balance_v1.ts",
  "apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.ts",
];
const REPO_PATH_RE = /(?:apps|scripts|docs|packages)\/[0-9A-Za-z_.@+\-/]+\.(?:ts|tsx|js|cjs|mjs|py|json|sql)/g;

function normalize(rel) {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "");
}

function existingFile(rel) {
  const normalized = normalize(rel);
  const abs = path.resolve(ROOT, normalized);
  const root = path.resolve(ROOT);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return normalize(path.relative(ROOT, abs));
}

function requireRoot(rel, kind) {
  const found = existingFile(rel);
  if (!found) throw new Error(`EA5E2_DEPENDENCY_${kind}_MISSING:${rel}`);
  return found;
}

function resolveLocal(fromRel, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(ROOT, path.dirname(fromRel), specifier);
  const ext = path.extname(base);
  const candidates = [];
  if ([".js", ".mjs", ".cjs"].includes(ext)) {
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/, ".ts"));
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/, ".tsx"));
    candidates.push(base);
  } else if (ext) {
    candidates.push(base);
  } else {
    for (const suffix of [".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".py"]) {
      candidates.push(`${base}${suffix}`);
    }
    for (const name of ["index.ts", "index.tsx", "index.js", "index.cjs", "index.mjs"]) {
      candidates.push(path.join(base, name));
    }
  }
  for (const candidate of candidates) {
    const found = existingFile(path.relative(ROOT, candidate));
    if (found) return found;
  }
  return null;
}

function importSpecifiers(text) {
  const values = [];
  const patterns = [
    /\bimport\s+(?!type\b)[^;]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) values.push(match[1]);
  }
  return values;
}

function repoPathReferences(text) {
  const values = new Set();
  for (const match of text.matchAll(REPO_PATH_RE)) {
    const found = existingFile(match[0]);
    if (found) values.add(found);
  }
  return values;
}

function scanChildren(rel) {
  if (!/\.(?:ts|tsx|js|cjs|mjs|py)$/.test(rel)) return [];
  const text = fs.readFileSync(path.resolve(ROOT, rel), "utf8");
  const out = new Set(repoPathReferences(text));
  if (/\.(?:ts|tsx|js|cjs|mjs)$/.test(rel)) {
    for (const specifier of importSpecifiers(text)) {
      const resolved = resolveLocal(rel, specifier);
      if (resolved) out.add(resolved);
    }
  }
  return [...out];
}

function discoverRuntimeClosure() {
  const seen = new Set();
  const queue = [];
  for (const rel of ENTRYPOINTS) {
    const found = requireRoot(rel, "ENTRYPOINT");
    seen.add(found);
    queue.push(found);
  }
  while (queue.length) {
    const rel = queue.shift();
    for (const child of scanChildren(rel)) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return [...seen].sort();
}

function buildBoundGraph(runtimeClosure) {
  const all = new Set(runtimeClosure);
  for (const rel of STATIC_BINDING_ROOTS) all.add(requireRoot(rel, "STATIC_ROOT"));
  for (const rel of TOOLCHAIN_FILES) all.add(requireRoot(rel, "TOOLCHAIN_FILE"));
  return [...all].sort();
}

function parsePathListBlock(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start + Math.max(1, startNeedle.length));
  if (start < 0 || end < 0) return null;
  const values = [];
  for (const line of text.slice(start, end).split(/\r?\n/)) {
    const match = /^\s+-\s+["']?([^"']+?)["']?\s*$/.exec(line);
    if (match) values.push(match[1]);
  }
  return values;
}

function parseLiveBindings(text) {
  const push = parsePathListBlock(text, "\n    paths:\n", "\n  workflow_dispatch:");
  if (!push || !push.length) throw new Error("EA5E2_DEPENDENCY_LIVE_PUSH_PATH_BLOCK_REQUIRED");
  const criticalStart = text.indexOf("critical=(");
  const criticalEnd = text.indexOf("\n          )", criticalStart);
  if (criticalStart < 0 || criticalEnd < 0) throw new Error("EA5E2_DEPENDENCY_CRITICAL_BLOCK_REQUIRED");
  const critical = [];
  for (const line of text.slice(criticalStart, criticalEnd).split(/\r?\n/)) {
    const match = /^\s+([^\s()]+)\s*$/.exec(line);
    if (match && match[1] !== "critical=(") critical.push(match[1].replace(/^['"]|['"]$/g, ""));
  }
  return { push: new Set(push), critical: new Set(critical) };
}

function parseStaticGatePatterns(text) {
  const paths = parsePathListBlock(text, "\n    paths:\n", "\n  workflow_dispatch:");
  if (!paths || !paths.length) throw new Error("EA5E2_DEPENDENCY_STATIC_GATE_PATH_BLOCK_REQUIRED");
  return paths;
}

function globRegex(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i += 1;
    } else if (ch === "*") {
      source += "[^/]*";
    } else if (ch === "?") {
      source += "[^/]";
    } else {
      source += ch.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function digestBytes(rel) {
  const raw = fs.readFileSync(path.resolve(ROOT, rel));
  if (rel !== BINDING_CARRIER) return raw;
  const parsed = JSON.parse(raw.toString("utf8"));
  if (!parsed.qualification_boundary || typeof parsed.qualification_boundary !== "object") {
    throw new Error("EA5E2_DEPENDENCY_BINDING_CARRIER_QUALIFICATION_BOUNDARY_REQUIRED");
  }
  parsed.qualification_boundary.runtime_dependency_graph_sha256 = BINDING_PLACEHOLDER;
  return Buffer.from(JSON.stringify(parsed));
}

function digest(paths) {
  const hash = crypto.createHash("sha256");
  for (const rel of paths) {
    hash.update(rel);
    hash.update("\0");
    hash.update(digestBytes(rel));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function readCarrierDigest() {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(ROOT, BINDING_CARRIER), "utf8"));
  return parsed?.qualification_boundary?.runtime_dependency_graph_sha256 ?? null;
}

function writeProof(proof) {
  fs.mkdirSync("acceptance-output", { recursive: true });
  fs.writeFileSync(
    "acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json",
    `${JSON.stringify(proof, null, 2)}\n`,
  );
  console.log(JSON.stringify(proof));
}

function main() {
  const runtimeClosure = discoverRuntimeClosure();
  const dependencies = buildBoundGraph(runtimeClosure);
  const discoveryRegression = REQUIRED_RUNTIME_DISCOVERY.filter((rel) => !runtimeClosure.includes(rel));

  const liveText = fs.readFileSync(path.resolve(ROOT, LIVE), "utf8");
  const { push, critical } = parseLiveBindings(liveText);
  const staticGateText = fs.readFileSync(path.resolve(ROOT, STATIC_GATE_WORKFLOW), "utf8");
  const staticPatterns = parseStaticGatePatterns(staticGateText);
  const staticRegexes = staticPatterns.map(globRegex);
  const staticGateUncovered = dependencies.filter((rel) => !staticRegexes.some((re) => re.test(rel)));

  const expectedDigest = digest(dependencies);
  const actualDigest = readCarrierDigest();
  const carrierInLivePush = push.has(BINDING_CARRIER);
  const carrierInExactMainCritical = critical.has(BINDING_CARRIER);

  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_runtime_dependency_graph_v2",
    status:
      discoveryRegression.length ||
      staticGateUncovered.length ||
      !carrierInLivePush ||
      !carrierInExactMainCritical ||
      actualDigest !== expectedDigest
        ? "FAIL"
        : "PASS",
    binding_model: "STATIC_PR_CLOSURE_DIGEST_TO_EXISTING_LIVE_CRITICAL_CARRIER",
    entrypoints: ENTRYPOINTS,
    static_binding_roots: STATIC_BINDING_ROOTS,
    toolchain_files: TOOLCHAIN_FILES,
    runtime_dependency_count: runtimeClosure.length,
    runtime_dependency_paths: runtimeClosure,
    bound_graph_count: dependencies.length,
    bound_graph_paths: dependencies,
    expected_dependency_graph_sha256: expectedDigest,
    carrier_dependency_graph_sha256: actualDigest,
    binding_carrier_path: BINDING_CARRIER,
    binding_carrier_in_live_push_paths: carrierInLivePush,
    binding_carrier_in_exact_main_critical_paths: carrierInExactMainCritical,
    runtime_discovery_regressions: discoveryRegression,
    static_preflight_uncovered_dependency_paths: staticGateUncovered,
    provider_request_count: 0,
    database_read_count: 0,
    database_write_count: 0,
    raw_value_emission_count: 0,
    formal_effect: false,
  };

  writeProof(proof);
  if (proof.status !== "PASS") {
    throw new Error(
      `EA5E2_RUNTIME_DEPENDENCY_GRAPH_UNBOUND:discovery=${discoveryRegression.length}:static_trigger=${staticGateUncovered.length}:carrier_push=${carrierInLivePush}:carrier_critical=${carrierInExactMainCritical}:digest_match=${actualDigest === expectedDigest}`,
    );
  }
}

main();
