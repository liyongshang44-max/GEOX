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
const DEPENDENCY_DIGEST_STRATEGY = "GIT_OR_WORKTREE_FILE_SHA256_CATALOG_V1";
const EXACT_EXTERNAL_SEGMENT_ARTIFACT_PATH =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PROTECTED-MAIN-LINEAGE-ADVANCEMENT-E1F8-TO-F41D-V1.json";
const EXACT_EXTERNAL_SEGMENT_OLD_BASE = "e1f8b078bb8459ecb9a77d1fad0d95f4bf143221";
const EXACT_EXTERNAL_SEGMENT_NEW_BASE = "f41dde8d44de95e71748e756e048e0166c1916b7";
const EXACT_EXTERNAL_SEGMENT_ARTIFACT_BLOB = "a4cc74c9927896994d059b3b3716d5602b5bc58c";

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function norm(rel) {
  return String(rel).replace(/\\/g, "/").replace(/^\.\//, "");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function sha256(bufferOrString) {
  return `sha256:${crypto.createHash("sha256").update(bufferOrString).digest("hex")}`;
}

function uniqueSortedPaths(paths) {
  return [...new Set((paths || []).map(norm).filter(Boolean))].sort();
}

function sameStringArrays(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
  const result = cp.spawnSync(spec.generator_command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, MCFT_CAP09_APPLICABILITY_GRAPH_MATERIALIZATION: "1" },
  });
  if (!exists(root, outputPath)) throw new Error(`GENERATED_GRAPH_OUTPUT_MISSING:${resolverId}:${outputPath}:exit=${result.status}`);
  const output = readJson(root, outputPath);
  const value = output[spec.output_field];
  if (!Array.isArray(value) || value.some((p) => typeof p !== "string" || !p)) {
    throw new Error(`GENERATED_GRAPH_OUTPUT_FIELD_INVALID:${resolverId}:${spec.output_field}`);
  }
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
        let paths = [...new Set((spec.paths || []).map(norm))].sort();

        if (resolverId === "T4R1_CURRENT_CROP_ROLLING_REFRESH") {
          const registryPath =
            "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";

          if (!exists(root, registryPath)) {
            throw new Error("CURRENT_CROP_AUTHORITY_REGISTRY_MISSING");
          }

          const registry = readJson(root, registryPath);

          if (
            registry?.schema_version !==
              "geox_mcft_cap09_effective_current_crop_authority_registry_v1" ||
            registry?.registry_id !==
              "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1" ||
            registry?.status !== "ACTIVE" ||
            registry?.candidate_artifacts_admissible !== false ||
            !Array.isArray(registry?.entries) ||
            registry.entries.length === 0
          ) {
            throw new Error("CURRENT_CROP_AUTHORITY_REGISTRY_INVALID");
          }

          const authorityRefPattern =
            /^docs\/digital_twin\/mcft\/cap_09\/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY(?:-\d{4}-\d{2}-\d{2}T\d{2}Z)?-V1\.json$/;

          const seen = new Set();
          const registryAuthorityPaths = [];

          for (const entry of registry.entries) {
            const rel = norm(entry?.authority_ref || "");

            if (!authorityRefPattern.test(rel)) {
              throw new Error(
                `CURRENT_CROP_AUTHORITY_REF_OUTSIDE_EXACT_NAMESPACE:${rel}`
              );
            }

            if (seen.has(rel)) {
              throw new Error(`CURRENT_CROP_AUTHORITY_REF_DUPLICATE:${rel}`);
            }
            seen.add(rel);

            if (!exists(root, rel)) {
              throw new Error(`CURRENT_CROP_AUTHORITY_REF_MISSING:${rel}`);
            }

            if (!/^sha256:[0-9a-f]{64}$/.test(entry?.authority_sha256 || "")) {
              throw new Error(`CURRENT_CROP_AUTHORITY_DIGEST_INVALID:${rel}`);
            }

            const actualDigest = sha256(
              fs.readFileSync(path.join(root, rel))
            );

            if (actualDigest !== entry.authority_sha256) {
              throw new Error(
                `CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH:${rel}:${entry.authority_sha256}:${actualDigest}`
              );
            }

            registryAuthorityPaths.push(rel);
          }

          paths = uniqueSortedPaths([
            ...paths,
            registryPath,
            ...registryAuthorityPaths,
          ]);
        }

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

function readDurableAnchorEntry(root, entry, registry = null) {
  let source = registry;
  if (!source) {
    try { source = readJson(root, REGISTRY_PATH); } catch { return null; }
  }
  const anchor = source?.durable_anchors;
  if (!anchor || anchor.anchor_id !== "MCFT_CAP09_QUALIFICATION_EVIDENCE_DURABLE_ANCHORS_V1") return null;
  if (anchor.frozen_subject_sha !== entry.subject_sha) return null;
  const row = (anchor.entries || []).find((candidate) => candidate.evidence_id === entry.evidence_id);
  if (!row) return null;
  if (row.run_id !== entry.run_id) return null;
  if ((row.artifact_id ?? null) !== (entry.artifact_id ?? null)) return null;
  if ((row.artifact_digest ?? null) !== (entry.artifact_digest ?? null)) return null;
  return row;
}

function evidenceIsStructurallyValid(entry, authority, root = ROOT, registry = null) {
  if (!entry || entry.immutable !== true || entry.run_conclusion !== "success") return false;
  if (entry.subject_sha !== authority.frozen_successor_subject_sha) return false;
  if (entry.dependency_subject_sha !== entry.subject_sha) return false;
  if (entry.dependency_digest_strategy !== DEPENDENCY_DIGEST_STRATEGY) return false;
  if (!/^[0-9a-f]{64}$/.test(entry.immutable_binding_sha256 || "")) return false;
  if (immutableEvidenceBindingSha256(entry) !== entry.immutable_binding_sha256) return false;
  if (!readDurableAnchorEntry(root, entry, registry)) return false;
  if (entry.evidence_class === "IMMUTABLE_WORKFLOW_ARTIFACT") {
    return Number.isInteger(entry.run_id) && Number.isInteger(entry.artifact_id) && /^sha256:[0-9a-f]{64}$/.test(entry.artifact_digest || "");
  }
  if (entry.evidence_class === "IMMUTABLE_WORKFLOW_RUN") {
    return Number.isInteger(entry.run_id) && entry.artifact_id === null && entry.artifact_digest === null;
  }
  return false;
}

function readJsonPointer(value, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  return pointer.slice(1).split("/").reduce((current, token) => {
    if (current === null || current === undefined) return undefined;
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    return current[key];
  }, value);
}

function resolveGenerationContext(root, authority, requestedGeneration = null) {
  const errors = [];
  if (!exists(root, ACTUAL_FORMAL_STORE_AUTHORITY_PATH)) {
    errors.push({ code: "GENERATION_AUTHORITY_REF_MISSING", detail: ACTUAL_FORMAL_STORE_AUTHORITY_PATH });
    return { requested_generation: requestedGeneration ?? null, errors };
  }
  let formal;
  try { formal = readJson(root, ACTUAL_FORMAL_STORE_AUTHORITY_PATH); }
  catch (error) {
    errors.push({ code: "GENERATION_AUTHORITY_UNREADABLE", detail: error instanceof Error ? error.message : String(error) });
    return { requested_generation: requestedGeneration ?? null, errors };
  }
  const authoritativeGeneration = formal?.qualification_generation?.generation ?? null;
  const requested = requestedGeneration || authoritativeGeneration;
  if (typeof authoritativeGeneration !== "string" || !authoritativeGeneration) errors.push({ code: "AUTHORITATIVE_GENERATION_MISSING", detail: "qualification_generation.generation" });
  if (typeof requested !== "string" || !requested) errors.push({ code: "REQUESTED_GENERATION_REQUIRED", detail: requested ?? null });
  return {
    requested_generation: requested,
    authoritative_generation: authoritativeGeneration,
    authority_generation: formal?.schema_version ?? null,
    store_generation: {
      qualification_database: formal?.qualification_generation?.qualification_database ?? null,
      blocked_database: formal?.qualification_generation?.blocked_database ?? null,
      formal_database: formal?.database_identity?.database_name ?? null,
    },
    workflow_generation: "MCFT_CAP09_QUALIFICATION_CONTROL_PLANE_V1",
    authority_ref: ACTUAL_FORMAL_STORE_AUTHORITY_PATH,
    errors,
  };
}

function validateDefinitions(authority, registry, root = ROOT) {
  const errors = [];
  const checks = authority.checks || [];
  const entries = registry.entries || [];
  for (const checkId of duplicateValues(checks.map((row) => row.check_id))) errors.push({ code: "DUPLICATE_CHECK_ID", detail: checkId });
  for (const evidenceId of duplicateValues(entries.map((row) => row.evidence_id))) errors.push({ code: "DUPLICATE_EVIDENCE_ID", detail: evidenceId });
  if (registry.frozen_subject_sha !== authority.frozen_successor_subject_sha) {
    errors.push({ code: "EVIDENCE_REGISTRY_FROZEN_SUBJECT_MISMATCH", detail: { registry: registry.frozen_subject_sha ?? null, authority: authority.frozen_successor_subject_sha ?? null } });
  }
  if (registry.dependency_digest_strategy !== DEPENDENCY_DIGEST_STRATEGY) errors.push({ code: "DEPENDENCY_DIGEST_STRATEGY_MISMATCH", detail: registry.dependency_digest_strategy ?? null });
  if (registry.durable_anchors?.anchor_id !== "MCFT_CAP09_QUALIFICATION_EVIDENCE_DURABLE_ANCHORS_V1") errors.push({ code: "DURABLE_EVIDENCE_ANCHOR_MISSING", detail: null });
  if (registry.durable_anchors?.frozen_subject_sha !== authority.frozen_successor_subject_sha) errors.push({ code: "DURABLE_EVIDENCE_ANCHOR_SUBJECT_MISMATCH", detail: registry.durable_anchors?.frozen_subject_sha ?? null });

  const resolverIds = new Set(Object.keys(authority.dependency_resolvers || {}));
  const checkIds = new Set(checks.map((row) => row.check_id));
  const evidenceIds = new Set(entries.map((row) => row.evidence_id));
  for (const check of checks) {
    if (typeof check.check_id !== "string" || !check.check_id) { errors.push({ code: "CHECK_ID_REQUIRED", detail: check.check_id ?? null }); continue; }
    for (const ref of check.authority_refs || []) if (!exists(root, ref)) errors.push({ code: "CHECK_AUTHORITY_REF_MISSING", detail: { check_id: check.check_id, authority_ref: ref } });
    for (const resolverId of check.resolver_ids || []) if (!resolverIds.has(resolverId)) errors.push({ code: "CHECK_DEPENDENCY_AUTHORITY_REF_MISSING", detail: { check_id: check.check_id, resolver_id: resolverId } });
    if (check.carry_forward_evidence_id && !evidenceIds.has(check.carry_forward_evidence_id)) errors.push({ code: "CHECK_EVIDENCE_REF_MISSING", detail: { check_id: check.check_id, evidence_id: check.carry_forward_evidence_id } });
  }
  for (const entry of entries) {
    if (!checkIds.has(entry.check_id)) errors.push({ code: "EVIDENCE_CHECK_REF_MISSING", detail: { evidence_id: entry.evidence_id, check_id: entry.check_id } });
    if (!readDurableAnchorEntry(root, entry, registry)) errors.push({ code: "EVIDENCE_DURABLE_ANCHOR_INVALID", detail: entry.evidence_id });
    for (const trigger of entry.requalification_triggers || []) if (!resolverIds.has(trigger)) errors.push({ code: "EVIDENCE_REQUALIFICATION_AUTHORITY_REF_MISSING", detail: { evidence_id: entry.evidence_id, resolver_id: trigger } });
  }
  return errors;
}

function gitCommitExists(root, sha) {
  if (!/^[0-9a-f]{40}$/.test(String(sha || ""))) return false;
  const result = cp.spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, stdio: "ignore" });
  return result.status === 0;
}

function gitChangedPathsBetween(root, base, head) {
  if (!gitCommitExists(root, base) || !gitCommitExists(root, head)) throw new Error(`CONTROL_PLANE_EXACT_SEGMENT_COMMIT_UNAVAILABLE:${base}:${head}`);
  const result = cp.execFileSync("git", ["diff", "--name-only", `${base}..${head}`], { cwd: root, encoding: "utf8" });
  return uniqueSortedPaths(result.split(/\r?\n/));
}

function exactExternalSegmentAdjudication(root, headSha) {
  const requestedNewBase = String(process.env.CURRENT_PROTECTED_MAIN_REFRESH_PREDECESSOR_SHA || "");
  if (!requestedNewBase) return null;
  if (requestedNewBase !== EXACT_EXTERNAL_SEGMENT_NEW_BASE) {
    throw new Error(`CONTROL_PLANE_EXTERNAL_SEGMENT_NEW_BASE_NOT_AUTHORIZED:${requestedNewBase}`);
  }
  if (!gitCommitExists(root, EXACT_EXTERNAL_SEGMENT_OLD_BASE) || !gitCommitExists(root, EXACT_EXTERNAL_SEGMENT_NEW_BASE) || !gitCommitExists(root, headSha)) {
    throw new Error("CONTROL_PLANE_EXTERNAL_SEGMENT_COMMIT_UNAVAILABLE");
  }
  if (cp.spawnSync("git", ["merge-base", "--is-ancestor", EXACT_EXTERNAL_SEGMENT_OLD_BASE, EXACT_EXTERNAL_SEGMENT_NEW_BASE], { cwd: root }).status !== 0) {
    throw new Error("CONTROL_PLANE_EXTERNAL_SEGMENT_LINEAGE_INVALID");
  }
  if (cp.spawnSync("git", ["merge-base", "--is-ancestor", EXACT_EXTERNAL_SEGMENT_NEW_BASE, headSha], { cwd: root }).status !== 0) {
    throw new Error("CONTROL_PLANE_EXTERNAL_SEGMENT_NEW_BASE_NOT_ANCESTOR_OF_HEAD");
  }

  const artifactBlob = cp.execFileSync("git", ["rev-parse", `${headSha}:${EXACT_EXTERNAL_SEGMENT_ARTIFACT_PATH}`], { cwd: root, encoding: "utf8" }).trim();
  if (artifactBlob !== EXACT_EXTERNAL_SEGMENT_ARTIFACT_BLOB) {
    throw new Error(`CONTROL_PLANE_EXTERNAL_SEGMENT_ARTIFACT_BLOB_DRIFT:${artifactBlob}`);
  }
  const artifactText = cp.execFileSync("git", ["show", `${headSha}:${EXACT_EXTERNAL_SEGMENT_ARTIFACT_PATH}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const artifact = JSON.parse(artifactText);
  const planeAChangedPaths = gitChangedPathsBetween(root, EXACT_EXTERNAL_SEGMENT_OLD_BASE, EXACT_EXTERNAL_SEGMENT_NEW_BASE);
  const artifactChangedPaths = uniqueSortedPaths(artifact.changed_paths || []);
  if (
    artifact.schema_version !== "geox_mcft_cap09_protected_main_lineage_advancement_adjudication_v1" ||
    artifact.status !== "PASS" ||
    artifact.previous_mcft_base !== EXACT_EXTERNAL_SEGMENT_OLD_BASE ||
    artifact.current_protected_main !== EXACT_EXTERNAL_SEGMENT_NEW_BASE ||
    artifact.adjudication !== "EXTERNALLY_OWNED_NON_MCFT_APPLICABLE" ||
    artifact.fail_closed_on_dependency_impact !== true ||
    artifact.adr_paths_added_to_mcft_resolvers !== false ||
    artifact.unknown_changed_path_semantics_relaxed !== false ||
    artifact.changed_path_count !== planeAChangedPaths.length ||
    !sameStringArrays(artifactChangedPaths, planeAChangedPaths) ||
    !Array.isArray(artifact.mcft_control_plane_path_intersection) || artifact.mcft_control_plane_path_intersection.length !== 0 ||
    !Array.isArray(artifact.mcft_authority_artifact_path_intersection) || artifact.mcft_authority_artifact_path_intersection.length !== 0 ||
    !Array.isArray(artifact.mcft_runtime_dependency_closure_intersection) || artifact.mcft_runtime_dependency_closure_intersection.length !== 0 ||
    !Array.isArray(artifact.mcft_dependency_resolver_digest_changes) || artifact.mcft_dependency_resolver_digest_changes.length !== 0
  ) {
    throw new Error("CONTROL_PLANE_EXTERNAL_SEGMENT_ADJUDICATION_INVALID");
  }

  const planeBChangedPaths = gitChangedPathsBetween(root, EXACT_EXTERNAL_SEGMENT_NEW_BASE, headSha);
  const planeASet = new Set(planeAChangedPaths);
  const remodified = planeBChangedPaths.filter((rel) => planeASet.has(rel));
  return Object.freeze({
    contract: "EXACT_SEGMENT_EXTERNALLY_ADJUDICATED_NON_MCFT_V1",
    old_base_sha: EXACT_EXTERNAL_SEGMENT_OLD_BASE,
    new_base_sha: EXACT_EXTERNAL_SEGMENT_NEW_BASE,
    head_sha: headSha,
    artifact_path: EXACT_EXTERNAL_SEGMENT_ARTIFACT_PATH,
    artifact_blob_sha: artifactBlob,
    artifact_status: artifact.status,
    adjudication: artifact.adjudication,
    plane_a_changed_paths: planeAChangedPaths,
    plane_b_changed_paths: planeBChangedPaths,
    plane_a_path_count: planeAChangedPaths.length,
    plane_b_path_count: planeBChangedPaths.length,
    plane_a_mcft_dependency_impact_zero: true,
    adr_paths_added_to_mcft_resolvers: false,
    unknown_changed_path_fail_closed_preserved: true,
    candidate_remodified_adjudicated_paths: remodified,
  });
}

function fileShaAtSubject(root, subjectSha, rel, allowWorkingTreeFallback) {
  if (gitCommitExists(root, subjectSha)) {
    const result = cp.spawnSync("git", ["show", `${subjectSha}:${rel}`], { cwd: root, encoding: null, maxBuffer: 64 * 1024 * 1024 });
    if (result.status === 0) return sha256(result.stdout);
    if (!allowWorkingTreeFallback) return null;
  }
  if (!allowWorkingTreeFallback || !exists(root, rel)) return null;
  return sha256(fs.readFileSync(path.join(root, rel)));
}

function dependencyDigestForPaths(root, subjectSha, paths, allowWorkingTreeFallback = false) {
  const rows = [];
  const missing = [];
  for (const rel of [...new Set(paths.map(norm))].sort()) {
    const fileSha = fileShaAtSubject(root, subjectSha, rel, allowWorkingTreeFallback);
    if (!fileSha) {
      missing.push(rel);
      continue;
    }
    rows.push(`${rel}\u0000${fileSha}`);
  }
  return {
    strategy: DEPENDENCY_DIGEST_STRATEGY,
    subject_sha: subjectSha ?? null,
    path_count: rows.length,
    missing,
    digest: missing.length === 0 ? sha256(rows.join("\n")) : null,
  };
}

function resolveDependencyDigestCatalog(root, resolved, currentSubjectSha, historicalSubjectSha) {
  const catalog = {};
  for (const [resolverId, row] of Object.entries(resolved)) {
    catalog[resolverId] = {
      current: dependencyDigestForPaths(root, currentSubjectSha, row.paths, true),
      historical: dependencyDigestForPaths(root, historicalSubjectSha, row.paths, false),
    };
  }
  return catalog;
}

function aggregateCheckDependencyDigest(resolverIds, catalog, side) {
  const parts = [];
  const missing = [];
  for (const resolverId of [...new Set(resolverIds)].sort()) {
    const row = catalog[resolverId]?.[side];
    if (!row || !row.digest || row.missing.length > 0) {
      missing.push({ resolver_id: resolverId, missing: row?.missing ?? ["RESOLVER_DIGEST_MISSING"] });
      continue;
    }
    parts.push(`${resolverId}\u0000${row.digest}`);
  }
  return {
    strategy: DEPENDENCY_DIGEST_STRATEGY,
    digest: missing.length === 0 ? sha256(parts.join("\n")) : null,
    missing,
  };
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
      subjects.set(failedSubject, { reason_code: "FAILED_V4_EVIDENCE_REUSE_FORBIDDEN", authority_ref: ACTUAL_FORMAL_STORE_AUTHORITY_PATH });
    }
  } catch (error) {
    errors.push({ code: "FAILED_V4_AUTHORITY_UNREADABLE", detail: error instanceof Error ? error.message : String(error) });
  }
  return { subjects, errors };
}

function prepareApplicabilityContext({ root = ROOT, authority, registry, generation = null, headSha = null }) {
  if (!authority || authority.authority_id !== "MCFT_CAP09_CHECK_APPLICABILITY_V1") throw new Error("CONTROL_PLANE_AUTHORITY_REQUIRED");
  if (!registry || registry.registry_id !== "MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1") throw new Error("CONTROL_PLANE_EVIDENCE_REGISTRY_REQUIRED");
  const definitionErrors = validateDefinitions(authority, registry, root);
  const generationContext = resolveGenerationContext(root, authority, generation);
  const resolverResult = resolveDependencyResolvers(root, authority);
  const failedV4Policy = resolveFailedV4ForbiddenEvidencePolicy(root);
  const allOwned = new Set(Object.values(resolverResult.resolved).flatMap((resolver) => resolver.paths));
  const evidence = registryMap(registry);
  const digestCatalog = resolveDependencyDigestCatalog(root, resolverResult.resolved, headSha, authority.frozen_successor_subject_sha);
  const externalSegmentAdjudication = headSha ? exactExternalSegmentAdjudication(root, headSha) : null;

  return Object.freeze({
    root,
    authority,
    registry,
    generation: generation ?? null,
    headSha: headSha ?? null,
    definitionErrors,
    generationContext,
    resolverResult,
    failedV4Policy,
    allOwned,
    evidence,
    digestCatalog,
    externalSegmentAdjudication,
  });
}

function planApplicability({
  root = ROOT,
  authority,
  registry,
  changedPaths,
  stage,
  generation = null,
  baseSha = null,
  headSha = null,
  preparedContext = null,
}) {
  if (!authority || authority.authority_id !== "MCFT_CAP09_CHECK_APPLICABILITY_V1") throw new Error("CONTROL_PLANE_AUTHORITY_REQUIRED");
  if (!registry || registry.registry_id !== "MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1") throw new Error("CONTROL_PLANE_EVIDENCE_REGISTRY_REQUIRED");
  if (!(authority.allowed_stages || []).includes(stage)) throw new Error(`CONTROL_PLANE_STAGE_INVALID:${stage}`);

  const context = preparedContext || prepareApplicabilityContext({ root, authority, registry, generation, headSha });
  if (
    context.root !== root ||
    context.authority !== authority ||
    context.registry !== registry ||
    context.generation !== (generation ?? null) ||
    context.headSha !== (headSha ?? null)
  ) {
    throw new Error("CONTROL_PLANE_PREPARED_CONTEXT_SUBJECT_MISMATCH");
  }
  const {
    definitionErrors,
    generationContext,
    resolverResult,
    failedV4Policy,
    allOwned,
    evidence,
    digestCatalog,
    externalSegmentAdjudication,
  } = context;

  const accumulatedChanged = uniqueSortedPaths(changedPaths || []);
  let changed = accumulatedChanged;
  let externalSegmentComposition = null;
  if (externalSegmentAdjudication && baseSha === authority.frozen_successor_subject_sha && headSha) {
    const actualAccumulatedChanged = gitChangedPathsBetween(root, authority.frozen_successor_subject_sha, headSha);
    const accumulatedInputExactMatch = sameStringArrays(accumulatedChanged, actualAccumulatedChanged);
    const planeASet = new Set(externalSegmentAdjudication.plane_a_changed_paths);
    const planeBSet = new Set(externalSegmentAdjudication.plane_b_changed_paths);
    if (accumulatedInputExactMatch) {
      changed = accumulatedChanged.filter((rel) => !planeASet.has(rel) || planeBSet.has(rel));
    }
    externalSegmentComposition = {
      ...externalSegmentAdjudication,
      accumulated_input_exact_match: accumulatedInputExactMatch,
      composition_applied: accumulatedInputExactMatch,
      effective_changed_path_count: changed.length,
      accumulated_changed_path_count: accumulatedChanged.length,
    };
  } else if (externalSegmentAdjudication) {
    externalSegmentComposition = {
      ...externalSegmentAdjudication,
      accumulated_input_exact_match: false,
      composition_applied: false,
      effective_changed_path_count: changed.length,
      accumulated_changed_path_count: accumulatedChanged.length,
    };
  }

  const unknownChangedPaths = changed.filter((p) => !allOwned.has(p));
  const decisions = [];

  for (const check of authority.checks || []) {
    const stageApplicable = (check.applicable_stages || []).includes(stage);
    const generationApplicable = check.check_id === "CONTROL_PLANE_INTEGRITY" || generationContext.requested_generation === generationContext.authoritative_generation;
    const resolverIds = check.resolver_ids || [];
    const missingResolvers = resolverIds.filter((id) => !resolverResult.resolved[id]);
    const resolverErrors = resolverResult.errors.filter((err) => resolverIds.includes(err.resolver_id));
    const dependencyPaths = [...new Set(resolverIds.flatMap((id) => resolverResult.resolved[id]?.paths || []))].sort();
    const changedDependencies = changed.filter((p) => dependencyPaths.includes(p));
    const currentDependency = aggregateCheckDependencyDigest(resolverIds, digestCatalog, "current");
    const historicalDependency = aggregateCheckDependencyDigest(resolverIds, digestCatalog, "historical");
    const dependencyDigestMatch = Boolean(currentDependency.digest && historicalDependency.digest && currentDependency.digest === historicalDependency.digest);
    const evidenceEntry = check.carry_forward_evidence_id ? evidence.get(check.carry_forward_evidence_id) : null;
    const forbiddenEvidence = evidenceEntry ? failedV4Policy.subjects.get(evidenceEntry.subject_sha) : null;

    let status;
    let reason_code;
    let authority_ref = (check.authority_refs || [])[0] ?? null;
    if (!stageApplicable) {
      status = "NOT_APPLICABLE";
      reason_code = "STAGE_NOT_APPLICABLE";
    } else if (!generationApplicable) {
      status = "NOT_APPLICABLE";
      reason_code = "GENERATION_NOT_APPLICABLE";
    } else if (generationContext.errors.length > 0 || missingResolvers.length || resolverErrors.length) {
      status = "UNKNOWN";
      reason_code = generationContext.errors.length > 0 ? "GENERATION_CONTEXT_INVALID" : "DEPENDENCY_RESOLVER_INVALID";
    } else if (forbiddenEvidence) {
      status = "FORBIDDEN";
      reason_code = forbiddenEvidence.reason_code;
      authority_ref = forbiddenEvidence.authority_ref;
    } else if (changedDependencies.length > 0) {
      status = "REQUALIFY";
      reason_code = "GOVERNED_DEPENDENCY_CHANGED";
    } else if (check.carry_forward_evidence_id) {
      if (!evidenceIsStructurallyValid(evidenceEntry, authority, root, registry) || evidenceEntry.check_id !== check.check_id) {
        status = "UNKNOWN";
        reason_code = "CARRY_FORWARD_EVIDENCE_INVALID_OR_MISSING";
      } else if (!currentDependency.digest) {
        status = "UNKNOWN";
        reason_code = "DEPENDENCY_DIGEST_UNRESOLVABLE";
      } else if (!historicalDependency.digest && historicalDependency.missing.length > 0) {
        status = "REQUALIFY";
        reason_code = "DEPENDENCY_SET_EXPANDED_SINCE_FROZEN_SUBJECT";
      } else if (!historicalDependency.digest) {
        status = "UNKNOWN";
        reason_code = "DEPENDENCY_DIGEST_UNRESOLVABLE";
      } else if (!dependencyDigestMatch) {
        status = "REQUALIFY";
        reason_code = "DEPENDENCY_DIGEST_CHANGED";
      } else {
        status = "CARRY_FORWARD";
        reason_code = "IMMUTABLE_EVIDENCE_AND_DEPENDENCY_DIGEST_UNCHANGED";
      }
    } else {
      status = "REQUIRED";
      reason_code = "APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE";
    }

    decisions.push({
      check_id: check.check_id,
      status,
      reason_code,
      generation: generationContext.requested_generation,
      authority_ref,
      dependency_refs: resolverIds,
      resolver_ids: resolverIds,
      changed_dependencies: changedDependencies,
      dependency_digest_strategy: DEPENDENCY_DIGEST_STRATEGY,
      dependency_digest: currentDependency.digest,
      historical_dependency_digest: historicalDependency.digest,
      dependency_digest_match: dependencyDigestMatch,
      dependency_digest_missing: { current: currentDependency.missing, historical: historicalDependency.missing },
      historical_evidence_ref: check.carry_forward_evidence_id,
      carry_forward_evidence_id: check.carry_forward_evidence_id,
      historical_digest: evidenceEntry?.artifact_digest ?? null,
      subject_digest: currentDependency.digest,
      immutable_evidence_binding: evidenceEntry?.immutable_binding_sha256 ?? null,
      diagnostic_command: check.diagnostic_command ?? null,
      execution_workflow:
        check.execution_workflows_by_stage && Object.prototype.hasOwnProperty.call(check.execution_workflows_by_stage, stage)
          ? check.execution_workflows_by_stage[stage]
          : check.execution_workflow ?? null,
      execution_workflow_status:
        check.execution_workflow_status_by_stage && Object.prototype.hasOwnProperty.call(check.execution_workflow_status_by_stage, stage)
          ? check.execution_workflow_status_by_stage[stage]
          : check.execution_workflow_status ?? null,
    });
  }

  const counts = Object.fromEntries(authority.decision_states.map((state) => [state, decisions.filter((d) => d.status === state).length]));
  const blockers = decisions.filter((d) => d.status === "UNKNOWN" || d.status === "FORBIDDEN");
  const authorityErrors = [...definitionErrors, ...generationContext.errors, ...failedV4Policy.errors];
  const overallStatus = unknownChangedPaths.length === 0 && resolverResult.errors.length === 0 && authorityErrors.length === 0 && blockers.length === 0 ? "PASS" : "FAIL";
  return {
    planner_id: authority.authority_id,
    status: overallStatus,
    stage,
    generation: generationContext.requested_generation,
    generation_context: generationContext,
    base_sha: baseSha,
    head_sha: headSha,
    frozen_successor_subject_sha: authority.frozen_successor_subject_sha,
    accumulated_changed_paths: accumulatedChanged,
    changed_paths: changed,
    external_segment_adjudication: externalSegmentComposition,
    unknown_changed_paths: unknownChangedPaths,
    authority_errors: authorityErrors,
    resolver_errors: resolverResult.errors,
    resolver_summaries: Object.fromEntries(Object.entries(resolverResult.resolved).map(([id, value]) => [id, {
      kind: value.kind,
      path_count: value.paths.length,
      missing: value.missing,
      graph_conformance: value.graph_conformance ?? null,
      generator_exit_code: value.generator_exit_code ?? null,
      dependency_digest_current: digestCatalog[id]?.current?.digest ?? null,
      dependency_digest_historical: digestCatalog[id]?.historical?.digest ?? null,
      dependency_digest_match: Boolean(digestCatalog[id]?.current?.digest && digestCatalog[id]?.historical?.digest && digestCatalog[id].current.digest === digestCatalog[id].historical.digest),
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
  const plan = planApplicability({
    root: ROOT,
    authority,
    registry,
    changedPaths,
    stage,
    generation: args.generation || null,
    baseSha: args.base || null,
    headSha: args.head || null,
  });
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
  DEPENDENCY_DIGEST_STRATEGY,
  EXACT_EXTERNAL_SEGMENT_ARTIFACT_PATH,
  EXACT_EXTERNAL_SEGMENT_OLD_BASE,
  EXACT_EXTERNAL_SEGMENT_NEW_BASE,
  EXACT_EXTERNAL_SEGMENT_ARTIFACT_BLOB,
  buildImportClosure,
  materializeGeneratedGraph,
  resolveDependencyResolvers,
  immutableEvidenceBindingSha256,
  readDurableAnchorEntry,
  evidenceIsStructurallyValid,
  resolveGenerationContext,
  validateDefinitions,
  dependencyDigestForPaths,
  resolveDependencyDigestCatalog,
  aggregateCheckDependencyDigest,
  resolveFailedV4ForbiddenEvidencePolicy,
  exactExternalSegmentAdjudication,
  prepareApplicabilityContext,
  planApplicability,
};

if (require.main === module) main();
