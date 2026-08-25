#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const REGISTRY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json";
const ACTUAL_FORMAL_STORE_AUTHORITY_PATH =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function norm(rel) {
  return String(rel).replace(/\\/g, "/").replace(/^\.\//, "");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function resolveLocalImport(root, importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const importerDir = path.posix.dirname(importer);
  const base = path.posix.normalize(path.posix.join(importerDir, specifier));
  const candidates = [];
  const ext = path.posix.extname(base);
  if (ext) {
    candidates.push(base);
    if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
      const stem = base.slice(0, -ext.length);
      candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.js`, `${stem}.cjs`, `${stem}.mjs`, `${stem}.json`);
    }
  } else {
    candidates.push(base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.cjs`, `${base}.mjs`, `${base}.json`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.cjs`);
  }
  for (const candidate of candidates) if (exists(root, candidate)) return norm(candidate);
  return null;
}

function localImportSpecifiers(text) {
  const specs = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(text)) !== null) specs.add(match[1]);
  }
  return [...specs];
}

function buildImportClosure(root, roots) {
  const queue = roots.map(norm);
  const visited = new Set();
  const missing = [];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    if (!exists(root, current)) {
      missing.push(current);
      continue;
    }
    visited.add(current);
    if (!/\.(?:ts|tsx|js|cjs|mjs)$/.test(current)) continue;
    const text = fs.readFileSync(path.join(root, current), "utf8");
    for (const spec of localImportSpecifiers(text)) {
      if (!spec.startsWith(".")) continue;
      const resolved = resolveLocalImport(root, current, spec);
      if (!resolved) {
        missing.push(`${current} -> ${spec}`);
        continue;
      }
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  return { paths: [...visited].sort(), missing: [...new Set(missing)].sort() };
}

function materializeGeneratedGraph(root, resolverId, spec) {
  const outputPath = norm(spec.output_path || "");
  if (!spec.generator_command || !outputPath || !spec.output_field) throw new Error(`GENERATED_GRAPH_SPEC_INVALID:${resolverId}`);
  try { fs.rmSync(path.join(root, outputPath), { force: true }); } catch {}
  const result = cp.spawnSync(spec.generator_command, { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, MCFT_CAP09_APPLICABILITY_GRAPH_MATERIALIZATION: "1" } });
  if (!exists(root, outputPath)) throw new Error(`GENERATED_GRAPH_OUTPUT_MISSING:${resolverId}:${outputPath}:exit=${result.status}`);
  const output = readJson(root, outputPath);
  const value = output[spec.output_field];
  if (!Array.isArray(value) || value.some((p) => typeof p !== "string" || !p)) throw new Error(`GENERATED_GRAPH_OUTPUT_FIELD_INVALID:${resolverId}:${spec.output_field}`);
  const paths = [...new Set(value.map(norm))].sort();
  const missing = paths.filter((p) => !exists(root, p));
  return {
    resolver_id: resolverId,
    kind: spec.kind,
    paths,
    missing,
    generator_command: spec.generator_command,
    output_path: outputPath,
    output_field: spec.output_field,
    generator_exit_code: result.status,
    graph_conformance: spec.conformance_field ? output[spec.conformance_field] ?? null : null,
  };
}

function resolveDependencyResolvers(root, authority) {
  const resolved = {};
  const errors = [];
  for (const [resolverId, spec] of Object.entries(authority.dependency_resolvers || {})) {
    try {
      if (spec.kind === "EXACT_PATH_SET") {
        const paths = [...new Set((spec.paths || []).map(norm))].sort();
        const missing = paths.filter((p) => !exists(root, p));
        resolved[resolverId] = { resolver_id: resolverId, kind: spec.kind, paths, missing };
        if (missing.length) errors.push({ resolver_id: resolverId, code: "RESOLVER_PATH_MISSING", detail: missing });
      } else if (spec.kind === "IMPORT_CLOSURE") {
        const closure = buildImportClosure(root, spec.roots || []);
        const exact = [...new Set((spec.additional_exact_paths || []).map(norm))].sort();
        const missingExact = exact.filter((p) => !exists(root, p));
        const paths = [...new Set([...closure.paths, ...exact])].sort();
        const missing = [...new Set([...closure.missing, ...missingExact])].sort();
        resolved[resolverId] = { resolver_id: resolverId, kind: spec.kind, paths, missing };
        if (missing.length) errors.push({ resolver_id: resolverId, code: "RESOLVER_IMPORT_OR_PATH_MISSING", detail: missing });
      } else if (spec.kind === "GENERATED_GRAPH_OUTPUT") {
        const graph = materializeGeneratedGraph(root, resolverId, spec);
        resolved[resolverId] = graph;
        if (graph.missing.length) errors.push({ resolver_id: resolverId, code: "GENERATED_GRAPH_PATH_MISSING", detail: graph.missing });
      } else {
        errors.push({ resolver_id: resolverId, code: "UNKNOWN_RESOLVER_KIND", detail: spec.kind ?? null });
      }
    } catch (error) {
      errors.push({ resolver_id: resolverId, code: "RESOLVER_EXCEPTION", detail: error instanceof Error ? error.message : String(error) });
    }
  }
  return { resolved, errors };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function registryMap(registry) {
  return new Map((registry.entries || []).map((entry) => [entry.evidence_id, entry]));
}

function immutableEvidenceBindingSha256(entry) {
  const fields = [
    entry.evidence_id,
    entry.check_id,
    entry.generation,
    entry.subject_sha,
    entry.workflow_name,
    entry.run_id,
    entry.run_conclusion,
    entry.artifact_id,
    entry.artifact_digest,
  ];
  const material = fields.map((value) => value === null || value === undefined ? "" : String(value)).join("|");
  return crypto.createHash("sha256").update(material, "utf8").digest("hex");
}

function evidenceIsStructurallyValid(entry, authority) {
  if (!entry || entry.immutable !== true || entry.run_conclusion !== "success") return false;
  if (entry.subject_sha !== authority.frozen_successor_subject_sha) return false;
  if (!/^[0-9a-f]{64}$/.test(entry.immutable_binding_sha256 || "")) return false;
  if (immutableEvidenceBindingSha256(entry) !== entry.immutable_binding_sha256) return false;
  if (entry.evidence_class === "IMMUTABLE_WORKFLOW_ARTIFACT") return Number.isInteger(entry.run_id) && Number.isInteger(entry.artifact_id) && /^sha256:[0-9a-f]{64}$/.test(entry.artifact_digest || "");
  if (entry.evidence_class === "IMMUTABLE_WORKFLOW_RUN") return Number.isInteger(entry.run_id) && entry.artifact_id === null && entry.artifact_digest === null;
  return false;
}

function validateDefinitions(authority, registry) {
  const errors = [];
  const checks = authority.checks || [];
  const entries = registry.entries || [];
  for (const checkId of duplicateValues(checks.map((row) => row.check_id))) {
    errors.push({ code: "DUPLICATE_CHECK_ID", detail: checkId });
  }
  for (const evidenceId of duplicateValues(entries.map((row) => row.evidence_id))) {
    errors.push({ code: "DUPLICATE_EVIDENCE_ID", detail: evidenceId });
  }
  if (registry.frozen_subject_sha !== authority.frozen_successor_subject_sha) {
    errors.push({
      code: "EVIDENCE_REGISTRY_FROZEN_SUBJECT_MISMATCH",
      detail: { registry: registry.frozen_subject_sha ?? null, authority: authority.frozen_successor_subject_sha ?? null },
    });
  }

  const resolverIds = new Set(Object.keys(authority.dependency_resolvers || {}));
  const checkIds = new Set(checks.map((row) => row.check_id));
  const evidenceIds = new Set(entries.map((row) => row.evidence_id));
  for (const check of checks) {
    if (typeof check.check_id !== "string" || !check.check_id) {
      errors.push({ code: "CHECK_ID_REQUIRED", detail: check.check_id ?? null });
      continue;
    }
    for (const resolverId of check.resolver_ids || []) {
      if (!resolverIds.has(resolverId)) errors.push({ code: "CHECK_DEPENDENCY_AUTHORITY_REF_MISSING", detail: { check_id: check.check_id, resolver_id: resolverId } });
    }
    if (check.carry_forward_evidence_id && !evidenceIds.has(check.carry_forward_evidence_id)) {
      errors.push({ code: "CHECK_EVIDENCE_REF_MISSING", detail: { check_id: check.check_id, evidence_id: check.carry_forward_evidence_id } });
    }
  }
  for (const entry of entries) {
    if (!checkIds.has(entry.check_id)) errors.push({ code: "EVIDENCE_CHECK_REF_MISSING", detail: { evidence_id: entry.evidence_id, check_id: entry.check_id } });
    for (const trigger of entry.requalification_triggers || []) {
      if (!resolverIds.has(trigger)) errors.push({ code: "EVIDENCE_REQUALIFICATION_AUTHORITY_REF_MISSING", detail: { evidence_id: entry.evidence_id, resolver_id: trigger } });
    }
  }
  return errors;
}

function resolveFailedV4ForbiddenEvidencePolicy(root) {
  const errors = [];
  const subjects = new Map();
  if (!exists(root, ACTUAL_FORMAL_STORE_AUTHORITY_PATH)) {
    errors.push({ code: "FAILED_V4_AUTHORITY_REF_MISSING", detail: ACTUAL_FORMAL_STORE_AUTHORITY_PATH });
    return { subjects, errors };
  }
  try {
    const formal = readJson(root, ACTUAL_FORMAL_STORE_AUTHORITY_PATH);
    const incident = formal.failed_v4_incident || {};
    const database = formal.database_identity || {};
    const failedSubject = incident.failed_subject_sha;
    const failClosed =
      incident.formal_epoch_no_go === true &&
      incident.failed_epoch_continuation_forbidden === true &&
      incident.failed_epoch_repair_or_late_forcing_insertion_forbidden === true &&
      database.failed_predecessor_reuse_forbidden === true &&
      database.data_clone_from_failed_v4_forbidden === true;
    if (!/^[0-9a-f]{40}$/.test(failedSubject || "") || !failClosed) {
      errors.push({ code: "FAILED_V4_AUTHORITY_NOT_FAIL_CLOSED", detail: ACTUAL_FORMAL_STORE_AUTHORITY_PATH });
    } else {
      subjects.set(failedSubject, {
        reason_code: "FAILED_V4_EVIDENCE_REUSE_FORBIDDEN",
        authority_ref: ACTUAL_FORMAL_STORE_AUTHORITY_PATH,
      });
    }
  } catch (error) {
    errors.push({ code: "FAILED_V4_AUTHORITY_UNREADABLE", detail: error instanceof Error ? error.message : String(error) });
  }
  return { subjects, errors };
}

function planApplicability({ root = ROOT, authority, registry, changedPaths, stage, baseSha = null, headSha = null }) {
  if (!authority || authority.authority_id !== "MCFT_CAP09_CHECK_APPLICABILITY_V1") throw new Error("CONTROL_PLANE_AUTHORITY_REQUIRED");
  if (!registry || registry.registry_id !== "MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1") throw new Error("CONTROL_PLANE_EVIDENCE_REGISTRY_REQUIRED");
  if (!(authority.allowed_stages || []).includes(stage)) throw new Error(`CONTROL_PLANE_STAGE_INVALID:${stage}`);

  const changed = [...new Set((changedPaths || []).map(norm).filter(Boolean))].sort();
  const definitionErrors = validateDefinitions(authority, registry);
  const resolverResult = resolveDependencyResolvers(root, authority);
  const failedV4Policy = resolveFailedV4ForbiddenEvidencePolicy(root);
  const allOwned = new Set(Object.values(resolverResult.resolved).flatMap((resolver) => resolver.paths));
  const unknownChangedPaths = changed.filter((p) => !allOwned.has(p));
  const evidence = registryMap(registry);
  const decisions = [];

  for (const check of authority.checks || []) {
    const applicable = (check.applicable_stages || []).includes(stage);
    const resolverIds = check.resolver_ids || [];
    const missingResolvers = resolverIds.filter((id) => !resolverResult.resolved[id]);
    const resolverErrors = resolverResult.errors.filter((err) => resolverIds.includes(err.resolver_id));
    const dependencyPaths = [...new Set(resolverIds.flatMap((id) => resolverResult.resolved[id]?.paths || []))].sort();
    const changedDependencies = changed.filter((p) => dependencyPaths.includes(p));
    const evidenceEntry = check.carry_forward_evidence_id ? evidence.get(check.carry_forward_evidence_id) : null;
    const forbiddenEvidence = evidenceEntry ? failedV4Policy.subjects.get(evidenceEntry.subject_sha) : null;

    let status;
    let reason_code;
    let authority_ref = null;
    if (!applicable) {
      status = "NOT_APPLICABLE";
      reason_code = "STAGE_NOT_APPLICABLE";
    } else if (missingResolvers.length || resolverErrors.length) {
      status = "UNKNOWN";
      reason_code = "DEPENDENCY_RESOLVER_INVALID";
    } else if (forbiddenEvidence) {
      status = "FORBIDDEN";
      reason_code = forbiddenEvidence.reason_code;
      authority_ref = forbiddenEvidence.authority_ref;
    } else if (changedDependencies.length > 0) {
      status = "REQUALIFY";
      reason_code = "GOVERNED_DEPENDENCY_CHANGED";
    } else if (check.carry_forward_evidence_id) {
      if (evidenceIsStructurallyValid(evidenceEntry, authority) && evidenceEntry.check_id === check.check_id) {
        status = "CARRY_FORWARD";
        reason_code = "IMMUTABLE_EVIDENCE_AND_DEPENDENCIES_UNCHANGED";
      } else {
        status = "UNKNOWN";
        reason_code = "CARRY_FORWARD_EVIDENCE_INVALID_OR_MISSING";
      }
    } else {
      status = "REQUIRED";
      reason_code = "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE";
    }

    decisions.push({
      check_id: check.check_id,
      status,
      reason_code,
      authority_ref,
      resolver_ids: resolverIds,
      changed_dependencies: changedDependencies,
      carry_forward_evidence_id: check.carry_forward_evidence_id,
      historical_digest: evidenceEntry?.artifact_digest ?? null,
      subject_digest: evidenceEntry?.immutable_binding_sha256 ?? null,
      diagnostic_command: check.diagnostic_command ?? null,
    });
  }

  const counts = Object.fromEntries(authority.decision_states.map((state) => [state, decisions.filter((d) => d.status === state).length]));
  const blockers = decisions.filter((d) => d.status === "UNKNOWN" || d.status === "FORBIDDEN");
  const authorityErrors = [...definitionErrors, ...failedV4Policy.errors];
  const overallStatus =
    unknownChangedPaths.length === 0 &&
    resolverResult.errors.length === 0 &&
    authorityErrors.length === 0 &&
    blockers.length === 0
      ? "PASS"
      : "FAIL";
  return {
    planner_id: authority.authority_id,
    status: overallStatus,
    stage,
    base_sha: baseSha,
    head_sha: headSha,
    frozen_successor_subject_sha: authority.frozen_successor_subject_sha,
    changed_paths: changed,
    unknown_changed_paths: unknownChangedPaths,
    authority_errors: authorityErrors,
    resolver_errors: resolverResult.errors,
    resolver_summaries: Object.fromEntries(Object.entries(resolverResult.resolved).map(([id, value]) => [id, {
      kind: value.kind,
      path_count: value.paths.length,
      missing: value.missing,
      graph_conformance: value.graph_conformance ?? null,
      generator_exit_code: value.generator_exit_code ?? null,
    }])),
    counts,
    decisions,
    blockers,
    forbidden_evidence_subjects: [...failedV4Policy.subjects.keys()].sort(),
    non_effects: { ...authority.non_effects },
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i += 1; } else out[key] = true;
  }
  return out;
}

function changedPathsFromGit(root, base, head) {
  if (!base || !head) throw new Error("CONTROL_PLANE_BASE_AND_HEAD_REQUIRED");
  const text = cp.execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: root, encoding: "utf8" });
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const authority = readJson(ROOT, AUTHORITY_PATH);
  const registry = readJson(ROOT, REGISTRY_PATH);
  const stage = args.stage || authority.default_stage;
  let changedPaths;
  if (args["changed-paths-file"]) changedPaths = fs.readFileSync(path.resolve(ROOT, args["changed-paths-file"]), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  else changedPaths = changedPathsFromGit(ROOT, args.base, args.head);
  const plan = planApplicability({ root: ROOT, authority, registry, changedPaths, stage, baseSha: args.base || null, headSha: args.head || null });
  const output = JSON.stringify(plan, null, 2) + "\n";
  if (args.out) {
    const outPath = path.resolve(ROOT, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
  }
  process.stdout.write(output);
  if (plan.status !== "PASS") process.exitCode = 1;
}

module.exports = {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  ACTUAL_FORMAL_STORE_AUTHORITY_PATH,
  buildImportClosure,
  materializeGeneratedGraph,
  resolveDependencyResolvers,
  immutableEvidenceBindingSha256,
  evidenceIsStructurallyValid,
  validateDefinitions,
  resolveFailedV4ForbiddenEvidencePolicy,
  planApplicability,
};

if (require.main === module) main();
