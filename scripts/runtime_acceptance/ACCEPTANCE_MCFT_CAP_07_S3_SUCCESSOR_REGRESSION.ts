// Purpose: validate immutable S3 composer contracts and authority continuity from S4 or later delivery contexts.
// Boundary: successor regression only; no S3 seed-state assertion, changed-file boundary assertion, database, route, persistence, or mutation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionLifecycleComposerV1,
  BoundedCollectionPageComposerV1,
  CurrentRuntimeComposerV1,
  FieldTwinTimelineComposerV1,
  FieldTwinTraceGraphComposerV1,
  ModelGovernanceComposerV1,
  RuntimeHealthComposerV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAP = "docs/digital_twin/mcft/cap_07";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S3_COMPOSERS_RESULT.json");
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, action: () => void): void => { action(); checks.push({ name, status: "PASS" }); };
const load = (relative: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

try {
  check("S3_COMPOSER_EXPORT_INVENTORY_PRESERVED", () => {
    const constructors = [
      CurrentRuntimeComposerV1,
      FieldTwinTimelineComposerV1,
      FieldTwinTraceGraphComposerV1,
      ActionLifecycleComposerV1,
      ModelGovernanceComposerV1,
      BoundedCollectionPageComposerV1,
      RuntimeHealthComposerV1,
    ];
    assert.equal(constructors.length, 7);
    for (const constructor of constructors) assert.equal(typeof constructor, "function");
  });

  check("S2_ATTESTATION_CONSUMPTION_PRESERVED", () => {
    const predecessor = load(`${CAP}/GEOX-MCFT-CAP-07-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`);
    assert.equal(predecessor.status, "PASS");
    assert.equal(predecessor.merge_commit, "27fcba8cf39cd62b7c9e71ee20577feced182ab0");
    assert.equal(predecessor.candidate_to_merge_tree_delta, 0);
    assert.equal(predecessor.attestation_workflow_run_id, 29765257247);
    assert.equal(predecessor.artifact_id, 8470534831);
    assert.equal(predecessor.effective_frontier, "S3");
  });

  check("S3_AUTHORITY_NOT_REGRESSED", () => {
    const s3 = load(`${CAP}/GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json`);
    assert.equal(s3.s3_candidate_implemented, true);
    assert.equal(s3.implementation_authorized, true);
    assert.equal(s3.runtime_authority_delta, "READ_ONLY_COMPOSERS_ONLY");
    assert.equal(s3.canonical_write_authority_delta, "ZERO");
    assert.equal(s3.migration_authority_delta, "ZERO");
    assert.equal(s3.route_authority_delta, "ZERO");
    assert.equal(s3.frontend_authority_delta, "ZERO");
  });

  check("SUCCESSOR_STATE_COHERENT_WITHOUT_STALE_S4_SEED_ASSERTION", () => {
    const s4 = load(`${CAP}/GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json`);
    if (s4.s4_candidate_implemented === true) {
      assert.equal(s4.implementation_authorized, true);
      assert.equal(s4.canonical_write_authorized, false);
      assert.equal(s4.runtime_source_authorized, false);
    } else {
      assert.equal(s4.s4_candidate_implemented, false);
      assert.equal(s4.implementation_authorized, false);
    }
  });

  check("CAPABILITY_AUTHORITY_NO_FORBIDDEN_ESCALATION", () => {
    const manifest = load(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`);
    assert.equal(manifest.document_status, "FROZEN");
    assert.equal(manifest.canonical_write_authorized, false);
    assert.equal(manifest.runtime_source_authorized, false);
    assert.equal(manifest.mcft_cap_08_authorized, false);
    assert.ok(["S3", "S4", "S5", "S6"].includes(manifest.current_slice));
  });

  check("REGISTRY_S3_AND_SUCCESSOR_TRANSITIONS_PRESERVED", () => {
    const registry = load("docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json");
    assert.equal(registry.registry_revision, "1.1");
    const cap = registry.capabilities.find((entry: any) => entry.capability_line === "MCFT-CAP-07");
    assert.ok(cap);
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S3-DELIVERY-STATUS-V1.json") && entry.field_path === "s3_candidate_implemented"));
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S4-DELIVERY-STATUS-V1.json") && entry.field_path === "s4_candidate_implemented"));
  });

  check("S3_STATIC_NO_DATABASE_ROUTE_OR_WRITE_REGRESSION", () => {
    const files = [
      "composer_contracts_v1.ts",
      "current_runtime_composer_v1.ts",
      "bounded_page_composers_v1.ts",
      "trace_graph_composer_v1.ts",
      "runtime_health_composer_v1.ts",
      "action_and_governance_composers_v1.ts",
    ].map((file) => path.join(ROOT, "apps/server/src/domain/field_twin_read_model", file));
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(source, /from\s+["']pg["']/);
      assert.doesNotMatch(source, /\/repositories\//);
      assert.doesNotMatch(source, /\/infra\//);
      assert.doesNotMatch(source, /\/routes\//);
      assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
    }
  });

  const result = {
    schema_version: "geox_mcft_cap_07_s3_composers_result_v1",
    status: "PASS",
    execution_mode: "SUCCESSOR_REGRESSION_MODE",
    check_count: checks.length,
    checks,
    composer_count: 7,
    composer_names: ["CurrentRuntimeComposerV1", "FieldTwinTimelineComposerV1", "FieldTwinTraceGraphComposerV1", "ActionLifecycleComposerV1", "ModelGovernanceComposerV1", "BoundedCollectionPageComposerV1", "RuntimeHealthComposerV1"],
    default_page_limit: 50,
    maximum_page_limit: 200,
    runtime_authority_delta: "READ_ONLY_COMPOSERS_ONLY",
    canonical_write_authority_delta: "ZERO",
    direct_database_access_performed: false,
    route_implementation_performed: false,
    frontend_implementation_performed: false,
    migration_performed: false,
    persistence_performed: false,
    cap_08_authorized: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`MCFT-CAP-07 S3 successor regression: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ schema_version: "geox_mcft_cap_07_s3_composers_result_v1", status: "FAIL", execution_mode: "SUCCESSOR_REGRESSION_MODE", error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
}
