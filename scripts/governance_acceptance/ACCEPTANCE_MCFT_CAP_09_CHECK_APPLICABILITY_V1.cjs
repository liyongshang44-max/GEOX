#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AUTHORITY_PATH,
  REGISTRY_PATH,
  resolveDependencyResolvers,
  planApplicability,
} = require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function byId(plan, id) {
  const row = plan.decisions.find((item) => item.check_id === id);
  assert.ok(row, `CHECK_DECISION_REQUIRED:${id}`);
  return row;
}

function plan(authority, registry, changedPaths, stage = "SUCCESSOR_SUBJECT_PRE_MERGE") {
  return planApplicability({
    root: ROOT,
    authority,
    registry,
    changedPaths,
    stage,
    baseSha: authority.frozen_successor_subject_sha,
    headSha: "1".repeat(40),
  });
}

function main() {
  const authority = readJson(AUTHORITY_PATH);
  const registry = readJson(REGISTRY_PATH);
  assert.equal(authority.authority_id, "MCFT_CAP09_CHECK_APPLICABILITY_V1");
  assert.equal(registry.frozen_subject_sha, authority.frozen_successor_subject_sha);

  // Authority itself must resolve every exact path / import root / external graph now.
  const resolved = resolveDependencyResolvers(ROOT, authority);
  assert.deepEqual(resolved.errors, [], `CONTROL_PLANE_RESOLVER_ERRORS:${JSON.stringify(resolved.errors)}`);
  for (const [id, row] of Object.entries(resolved.resolved)) {
    assert.equal(row.missing.length, 0, `CONTROL_PLANE_RESOLVER_MISSING:${id}:${JSON.stringify(row.missing)}`);
    assert(row.paths.length > 0, `CONTROL_PLANE_RESOLVER_EMPTY:${id}`);
  }

  // 1) Control-plane-only maintenance must not invalidate frozen runtime evidence.
  const controlOnly = plan(authority, registry, [AUTHORITY_PATH]);
  assert.equal(controlOnly.status, "PASS");
  assert.equal(controlOnly.unknown_changed_paths.length, 0);
  assert.equal(byId(controlOnly, "CONTROL_PLANE_INTEGRITY").status, "REQUALIFY");
  for (const id of [
    "V13_AUTONOMOUS_FORCING_FOUNDATION",
    "V13_HOLISTIC_SCHEMA",
    "V13_NEXT_TICK_VIABILITY",
    "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
    "EA5E2_RUNTIME_DEPENDENCY_GRAPH",
    "LEGACY_AM19_PERSISTENT_24T",
  ]) assert.equal(byId(controlOnly, id).status, "CARRY_FORWARD", `CONTROL_ONLY_MUST_CARRY:${id}`);
  for (const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION", "END_TO_END_EVIDENCE_SUPPLY_DEADLINE", "EXACT_ONE_PRODUCTION_OWNER", "FORMAL_V5_ACTIVATION"]) {
    assert.equal(byId(controlOnly, id).status, "NOT_APPLICABLE", `PREMERGE_FUTURE_CHECK_MUST_BE_NA:${id}`);
  }

  // 2) An unowned changed path must fail closed. No regex fallback is allowed.
  const unknown = plan(authority, registry, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);
  assert.equal(unknown.status, "FAIL");
  assert.deepEqual(unknown.unknown_changed_paths, ["docs/__mcft_cap09_unowned_path_should_fail__.md"]);

  // 3) Shared ingress changes must requalify the formal EA5C1 check and any generated import closure that truly depends on it.
  const ingressPath = "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts";
  const ingress = plan(authority, registry, [ingressPath]);
  assert.equal(ingress.status, "PASS");
  assert.equal(byId(ingress, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").status, "REQUALIFY");
  assert(byId(ingress, "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS").changed_dependencies.includes(ingressPath));

  // 4) A frozen historical source change must explicitly requalify historical evidence.
  const legacyPath = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
  const legacy = plan(authority, registry, [legacyPath]);
  assert.equal(legacy.status, "PASS");
  assert.equal(byId(legacy, "LEGACY_AM19_PERSISTENT_24T").status, "REQUALIFY");
  assert(byId(legacy, "LEGACY_AM19_PERSISTENT_24T").changed_dependencies.includes(legacyPath));

  // 5) A v13 runtime root change invalidates carry-forward evidence by dependency closure, not by filename regex.
  const runtimePath = "apps/server/src/runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.ts";
  const runtime = plan(authority, registry, [runtimePath]);
  assert.equal(runtime.status, "PASS");
  for (const id of ["V13_AUTONOMOUS_FORCING_FOUNDATION", "V13_HOLISTIC_SCHEMA", "V13_NEXT_TICK_VIABILITY"]) {
    assert.equal(byId(runtime, id).status, "REQUALIFY", `V13_RUNTIME_CHANGE_MUST_REQUALIFY:${id}`);
  }

  // 6) Post-merge qualification must expose future obligations all at once, not hide them behind serial workflow prerequisites.
  const postMerge = plan(authority, registry, [], "POST_MERGE_V13_QUALIFICATION");
  assert.equal(postMerge.status, "PASS");
  assert.equal(byId(postMerge, "LEGACY_AM19_PERSISTENT_24T").status, "NOT_APPLICABLE");
  for (const id of ["V13_PRODUCER_DRIVEN_QUALIFICATION", "END_TO_END_EVIDENCE_SUPPLY_DEADLINE", "EXACT_ONE_PRODUCTION_OWNER"]) {
    assert.equal(byId(postMerge, id).status, "REQUIRED", `POSTMERGE_CHECK_MUST_BE_REQUIRED:${id}`);
  }
  assert.equal(byId(postMerge, "FORMAL_V5_ACTIVATION").status, "NOT_APPLICABLE");

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_CHECK_APPLICABILITY_V1",
    frozen_successor_subject_sha: authority.frozen_successor_subject_sha,
    resolver_count: Object.keys(resolved.resolved).length,
    all_resolvers_materialized_without_missing_paths: true,
    control_plane_only_change_does_not_invalidate_frozen_runtime_evidence: true,
    unknown_changed_path_fails_closed: true,
    shared_ingress_dependency_change_requalifies_ea5c1: true,
    historical_source_change_requalifies_historical_evidence: true,
    v13_runtime_change_uses_generated_dependency_closure: true,
    postmerge_obligations_enumerated_without_serial_short_circuit: true,
    regex_fallback_used: false,
    runtime_mutation: false,
    production_workflow_activation: false,
    formal_database_mutation: false,
    provider_request: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  throw error;
}
