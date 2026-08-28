import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  semanticMigrationInventoryV1Schema,
  semanticShadowComparisonV1Schema,
} from "./semantic_migration_v1.js";

const inventoryPath =
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json";
const registerPath =
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json";

const inventoryRaw = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const inventory = semanticMigrationInventoryV1Schema.parse(inventoryRaw);

test("B-09a inventory is planning-only and performs zero authority removal", () => {
  assert.equal(inventory.phase, "B-09a");
  assert.equal(inventory.migration_phase_state, "INVENTORY_AND_SHADOW_PLANNING_ONLY");
  assert.equal(inventory.authority_removal_performed, false);
});

test("B-09a inventory covers every grandfathered producer exactly once", () => {
  const registered = (register.semantics ?? []).flatMap((semantic: any) =>
    (semantic.registered_producers ?? [])
      .filter((producer: any) => producer.grandfathered_duplicate === true)
      .map((producer: any) => ({
        key: semantic.semantic_id + "::" + producer.producer_id,
        removal_target: producer.removal_target,
      })),
  );

  const inventoried = inventory.families.flatMap((family) =>
    family.producer_dispositions.map((producer) =>
      family.semantic_id + "::" + producer.producer_id,
    ),
  );

  assert.equal(new Set(inventoried).size, inventoried.length);
  assert.deepEqual(
    [...inventoried].sort(),
    registered.map((x: any) => x.key).sort(),
  );
  assert.equal(registered.every((x: any) => x.removal_target === "B-09"), true);
});

test("B-09a unreplaced Twin and Forecast families are explicitly removal-forbidden", () => {
  for (const semantic_id of ["twin.physical_state", "twin.forecast_scenario"]) {
    const family = inventory.families.find((x) => x.semantic_id === semantic_id);
    assert.ok(family);
    assert.equal(family?.replacement_state, "UNREPLACED_EXTERNAL_DEPENDENCY");
    assert.equal(family?.shadow_state, "NOT_READY");
    assert.equal(family?.authority_removal_state, "FORBIDDEN_UNREPLACED");
    assert.equal(
      family?.producer_dispositions.every(
        (x) => x.disposition === "FREEZE_NO_NEW_FEATURE",
      ),
      true,
    );
  }
});

test("B-09a calculation replacement is partial, so removal remains forbidden", () => {
  const family = inventory.families.find(
    (x) => x.semantic_id === "decision.calculation",
  );
  assert.ok(family);
  assert.equal(family?.replacement_state, "PARTIAL_REPLACEMENT");
  assert.equal(family?.authority_removal_state, "FORBIDDEN_PARTIAL_REPLACEMENT");
  assert.equal(
    family?.producer_dispositions.some(
      (x) => x.producer_id === "evaluate-irrigation-decision-v1"
        && x.disposition === "ORPHANED_FREEZE",
    ),
    true,
  );
});

test("B-09a replacement-backed families are queued for shadow before removal", () => {
  for (const semantic_id of [
    "context.declared_identity",
    "context.crop_stage",
    "decision.candidate",
    "decision.eligibility",
    "operation.plan",
  ]) {
    const family = inventory.families.find((x) => x.semantic_id === semantic_id);
    assert.ok(family);
    assert.equal(family?.replacement_state, "REPLACEMENT_ESTABLISHED");
    assert.equal(family?.shadow_state, "READY_FOR_SHADOW");
    assert.notEqual(family?.consumer_migration_state, "COMPLETE");
    assert.notEqual(family?.authority_removal_state, "REMOVED");
  }
});

test("B-09a evidence family recognizes existing partial shadow but not removal completion", () => {
  const family = inventory.families.find(
    (x) => x.semantic_id === "evidence.qualification",
  );
  assert.ok(family);
  assert.equal(family?.replacement_state, "REPLACEMENT_ESTABLISHED");
  assert.equal(family?.shadow_state, "EXISTING_PARTIAL_SHADOW");
  assert.equal(family?.consumer_migration_state, "PARTIAL");
  assert.equal(family?.authority_removal_state, "PENDING_CONSUMER_MIGRATION");
});

test("B-09a real MCFT ADR and LLM integrations remain disconnected", () => {
  assert.equal(inventory.real_mcft_adapter_state, "DISCONNECTED");
  assert.equal(inventory.real_adr_runtime_state, "DISCONNECTED");
  assert.equal(inventory.real_llm_provider_state, "DISCONNECTED");
});

test("B-09a shadow comparison is SHADOW_ONLY and cannot authorize removal", () => {
  const parsed = semanticShadowComparisonV1Schema.parse({
    schema_version: "semantic_shadow_comparison_v1",
    comparison_id: "cmp_001",
    semantic_id: "decision.candidate",
    legacy_producer_id: "decision-engine-recommendation",
    canonical_owner_ref: "candidate_decision_v1:candidate_001",
    scope_ref: "field:fieldA",
    decision_time: "2026-08-28T04:00:00+08:00",
    comparable_dimensions: ["IDENTITY", "SCOPE", "ACTION", "EVIDENCE_BASIS"],
    comparison_state: "DIVERGENT",
    divergences: [
      {
        dimension: "EVIDENCE_BASIS",
        code: "LEGACY_RAW_EVIDENCE_NOT_CANONICAL_QUALIFICATION",
        legacy_ref: "recommendation_v1:rec1",
        canonical_ref: "candidate_decision_v1:candidate_001",
      },
    ],
    comparison_basis_refs: ["recommendation_v1:rec1", "candidate_decision_v1:candidate_001"],
    limitations: ["SHADOW_ONLY_NO_RUNTIME_AUTHORITY"],
    authority_removal_permitted: false,
    authority_state: "SHADOW_ONLY",
  });

  assert.equal(parsed.authority_state, "SHADOW_ONLY");
  assert.equal(parsed.authority_removal_permitted, false);
});

test("B-09a shadow comparison rejects removal/approval/task shortcuts", () => {
  for (const extra of [
    { authority_removal_permitted: true },
    { removed: true },
    { approved: true },
    { task_id: "task1" },
    { device_command: "START" },
  ]) {
    assert.throws(() => semanticShadowComparisonV1Schema.parse({
      schema_version: "semantic_shadow_comparison_v1",
      comparison_id: "cmp_001",
      semantic_id: "decision.candidate",
      legacy_producer_id: "decision-engine-recommendation",
      canonical_owner_ref: "candidate_decision_v1:candidate_001",
      scope_ref: null,
      decision_time: null,
      comparable_dimensions: ["ACTION"],
      comparison_state: "MATCH",
      divergences: [],
      comparison_basis_refs: [],
      limitations: [],
      authority_removal_permitted: false,
      authority_state: "SHADOW_ONLY",
      ...extra,
    }));
  }
});
