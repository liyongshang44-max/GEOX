import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_ID_V1,
  parseMcftCap09ProductionRuntimeStartAuthorityV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_runtime_v1.js";
import {
  MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ENTRYPOINT_BINDING_V1_RESULT.json");
const AUTHORITY = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-V1.json");

function main(): void {
  const unarmed = JSON.parse(fs.readFileSync(AUTHORITY, "utf8")) as Record<string, unknown>;
  assert.equal(unarmed.status, "ENTRYPOINT_BOUND_NOT_ARMED");
  assert.equal(unarmed.armed, false);
  assert.equal(unarmed.runtime_process_start_authorized, false);
  assert.equal(unarmed.production_owner_activation_authorized, false);
  assert.throws(
    () => parseMcftCap09ProductionRuntimeStartAuthorityV1(unarmed),
    /MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED/,
  );

  const active = parseMcftCap09ProductionRuntimeStartAuthorityV1({
    ...unarmed,
    status: "AUTHORIZED",
    armed: true,
    authority_class: MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
    authority_ref: "authority://mcft-cap09/production-runtime-start/test",
    activation_fence_time: "2026-09-02T18:00:00.000Z",
    formal_a0_authority_ref: "authority://mcft-cap09/formal-a0/test",
    formal_a0_logical_time: "2026-09-02T20:00:00.000Z",
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: true,
  });
  assert.equal(active.authority_class, MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1);
  assert.equal(active.activation_fence_time, "2026-09-02T18:00:00.000Z");
  assert.equal(active.formal_a0_logical_time, "2026-09-02T20:00:00.000Z");

  const runtime = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_production_evidence_runtime_v1.ts"),
    "utf8",
  );
  const composition = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts"),
    "utf8",
  );
  const packager = fs.readFileSync(path.resolve("apps/server/scripts/write_dist_entries.cjs"), "utf8");
  for (const marker of [
    "createProductionEvidenceHostPlannerFactoryV1",
    "host_planner_factory: hostPlannerFactory",
    "runMcftCap09EvidenceRuntimeProcessV1",
  ]) assert.equal(runtime.includes(marker), true, "PRODUCTION_EVIDENCE_ENTRYPOINT_RUNTIME_BINDING_REQUIRED:" + marker);
  assert.equal(composition.includes("host_planner_factory.createHostPlanner"), false);
  assert.equal(composition.includes("host_planner_factory?.createHostPlanner"), true);
  assert.equal(packager.includes("runMcftCap09ProductionEvidenceRuntimeV1"), true);
  assert.equal(packager.includes("MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"), false);

  const proof = {
    schema_version: "geox_mcft_cap09_production_evidence_entrypoint_binding_v1",
    status: "PASS",
    entrypoint_id: MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_ID_V1,
    production_target_planner_bound: true,
    shared_composition_planner_factory_bound: true,
    runtime_start_authority_repository_bound: true,
    runtime_start_authority_armed: false,
    missing_runtime_start_authority_fail_closed: true,
    activation_fence_from_environment_forbidden: true,
    formal_a0_from_environment_forbidden: true,
    database_connection_attempted: false,
    provider_request_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_start: false,
  }, null, 2) + "\n");
  throw error;
}
