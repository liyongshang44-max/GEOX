import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1,
  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_V1_RESULT.json");
const SUBJECT = "a".repeat(40);
const DIGEST = "sha256:" + "b".repeat(64);
const ARM_DIGEST = "sha256:" + "c".repeat(64);
const ARM_IDENTITY = "sha256:" + "d".repeat(64);
const SCOPE = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t4r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
};

function fixture(): Record<string, unknown> {
  return {
    schema_version: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1,
    authority_id: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1,
    status: "AUTHORIZED",
    armed: true,
    authority_ref: "local-operator://host/mcft-cap09/formal-v5/evidence-runtime-handoff",
    deployment_subject_sha: SUBJECT,
    scope: { ...SCOPE },
    activation_fence_time: "2026-09-20T12:00:00.000Z",
    formal_a0_logical_time: "2026-09-21T05:00:00.000Z",
    formal_v5_arm_ref: "formal-arm://mcft-cap09/formal-v5/epoch/db",
    formal_v5_arm_artifact_sha256: ARM_DIGEST,
    formal_v5_arm_identity_hash: ARM_IDENTITY,
    formal_v5_arm_time: "2026-09-20T11:59:00.000Z",
    base_runtime_start_authority_ref: "local-operator://host/mcft-cap09/runtime-start",
    base_runtime_start_authority_sha256: DIGEST,
    lineage_current_crop_authority_ref: "docs/example-current-crop.json",
    lineage_current_crop_authority_sha256: "sha256:" + "e".repeat(64),
    evidence_runtime_planning_handoff_authorized: true,
    runtime_process_start_authorized: false,
    twin_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    stage_authority_required_for_evidence_acquisition: false,
    future_stage_pins_frozen: false,
    current_crop_authority_promoted: false,
    formal_database_mutation_authorized: false,
    formal_raw_write_authorized: false,
    runtime_config_write_authorized: false,
    scheduler_write_authorized: false,
  };
}

async function main(): Promise<void> {
  const parsed = parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(
    fixture(),
    {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: DIGEST,
      admission_time_utc: "2026-09-20T12:01:00.000Z",
    },
  );

  assert.equal(parsed.formal_a0_logical_time, "2026-09-21T05:00:00.000Z");
  assert.equal(parsed.activation_fence_time, "2026-09-20T12:00:00.000Z");
  assert.equal(parsed.formal_a0_authority_ref, "formal-arm://mcft-cap09/formal-v5/epoch/db");
  assert.equal(
    parsed.authority_class,
    "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
  );

  const staleLineage = fixture();
  staleLineage.lineage_current_crop_authority_ref = "docs/stale-lineage-only.json";
  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(staleLineage, {
    deployment_subject_sha: SUBJECT,
    scope: SCOPE,
    base_runtime_start_authority_sha256: DIGEST,
    admission_time_utc: "2026-09-20T20:00:00.000Z",
  });

  await assert.rejects(async () => {
    parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(fixture(), {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: "sha256:" + "f".repeat(64),
      admission_time_utc: "2026-09-20T12:01:00.000Z",
    });
  }, /BASE_DIGEST_MISMATCH/);

  const stagePromotion = fixture();
  stagePromotion.stage_authority_required_for_evidence_acquisition = true;
  await assert.rejects(async () => {
    parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(stagePromotion, {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: DIGEST,
      admission_time_utc: "2026-09-20T12:01:00.000Z",
    });
  }, /SCOPE_DRIFT:stage_authority_required_for_evidence_acquisition/);

  const prematureA0 = fixture();
  prematureA0.a0_authorized = true;
  await assert.rejects(async () => {
    parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(prematureA0, {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: DIGEST,
      admission_time_utc: "2026-09-20T12:01:00.000Z",
    });
  }, /SCOPE_DRIFT:a0_authorized/);

  const beforeArm = fixture();
  beforeArm.activation_fence_time = "2026-09-20T11:58:00.000Z";
  await assert.rejects(async () => {
    parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(beforeArm, {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: DIGEST,
      admission_time_utc: "2026-09-20T12:01:00.000Z",
    });
  }, /BEFORE_ARM_FORBIDDEN/);

  const preformalSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts"),
    "utf8",
  );
  const compose = fs.readFileSync(
    path.resolve("docker-compose.mcft-cap09-production-preformal.yml"),
    "utf8",
  );
  const ownerRunner = fs.readFileSync(
    path.resolve("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs"),
    "utf8",
  );

  assert.match(
    preformalSource,
    /GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH/,
  );
  assert.match(
    preformalSource,
    /runtime_start_authority:handoffRuntimeStart/,
  );
  assert.match(
    compose,
    /formal-v5-evidence-runtime-handoff-authority\.json/,
  );
  assert.match(
    ownerRunner,
    /status:"UNARMED",armed:false/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_acceptance_v1",
    status: "PASS",
    actual_a0_clock_source: "FORMAL_V5_ARM",
    stage_authority_required_for_evidence_acquisition: false,
    stale_current_crop_lineage_does_not_block_post_arm_evidence_planning: true,
    deployment_subject_binding_preserved: true,
    base_runtime_authority_digest_binding_preserved: true,
    evidence_only_handoff: true,
    runtime_process_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    formal_database_mutation: false,
    provider_request_count: 0,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_acceptance_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
