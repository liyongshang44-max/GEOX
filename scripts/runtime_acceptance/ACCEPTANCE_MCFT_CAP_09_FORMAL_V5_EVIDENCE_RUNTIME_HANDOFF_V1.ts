import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  evaluateProductionGfsTargetDueV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_gfs_target_due_policy_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_EPOCH_SELECTION_MODE_V1,
  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_V1_RESULT.json");
const SUBJECT = "a".repeat(40);
const DIGEST = "sha256:" + "b".repeat(64);
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
    authority_ref: "local-operator://host/mcft-cap09/formal-v5/evidence-epoch-candidate",
    deployment_subject_sha: SUBJECT,
    scope: { ...SCOPE },
    activation_fence_time: "2026-09-19T12:56:00.000Z",
    formal_a0_logical_time: "2026-09-21T05:00:00.000Z",
    formal_o00_logical_time: "2026-09-21T06:00:00.000Z",
    formal_o23_logical_time: "2026-09-22T05:00:00.000Z",
    readiness_deadline: "2026-09-20T18:00:00.000Z",
    lifecycle_horizon_end_utc: "2026-11-24T03:59:59.999Z",
    minimum_governance_lead_hours: 36,
    epoch_selection_mode: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_EPOCH_SELECTION_MODE_V1,
    stage_authority_refresh_clock_eligibility: {
      eligible: true,
      time_zone: "America/Detroit",
      local_date: "2026-09-21",
      snapshot_boundary_utc: "2026-09-21T04:00:00.000Z",
      snapshot_valid_until_utc: "2026-09-22T10:00:00.000Z",
      snapshot_boundary_strictly_before_a0: true,
      snapshot_validity_covers_o23: true,
      stage_value_consulted: false,
      authority_identity_frozen: false,
    },
    base_runtime_start_authority_ref: "local-operator://host/mcft-cap09/runtime-start",
    base_runtime_start_authority_sha256: DIGEST,
    lineage_current_crop_authority_ref: "docs/example-current-crop.json",
    lineage_current_crop_authority_sha256: "sha256:" + "e".repeat(64),
    formal_v5_arm_match_required: true,
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

function parse(value: Record<string, unknown>, admission = "2026-09-20T20:00:00.000Z") {
  return parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(value, {
    deployment_subject_sha: SUBJECT,
    scope: SCOPE,
    base_runtime_start_authority_sha256: DIGEST,
    admission_time_utc: admission,
  });
}

async function main(): Promise<void> {
  const parsed = parse(fixture());
  assert.equal(parsed.formal_a0_logical_time, "2026-09-21T05:00:00.000Z");
  assert.equal(parsed.activation_fence_time, "2026-09-19T12:56:00.000Z");
  assert.equal(
    parsed.formal_a0_authority_ref,
    "local-operator://host/mcft-cap09/formal-v5/evidence-epoch-candidate",
  );
  assert.equal(
    parsed.authority_class,
    "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
  );

  const warmStart = evaluateProductionGfsTargetDueV1({
    planning_time: "2026-09-19T12:56:00.000Z",
    activation_fence_time: parsed.activation_fence_time,
    formal_a0_logical_time: parsed.formal_a0_logical_time,
    durable_paired_targets: [],
  });
  assert.equal(warmStart.status, "DUE");
  assert.equal(warmStart.target_logical_time, "2026-09-21T05:00:00.000Z");
  assert.equal(warmStart.due_window_start, "2026-09-19T12:56:00.000Z");
  assert.equal(warmStart.due_window_end_exclusive, "2026-09-21T05:00:00.000Z");

  const afterA0Pair = evaluateProductionGfsTargetDueV1({
    planning_time: "2026-09-20T20:00:00.000Z",
    activation_fence_time: parsed.activation_fence_time,
    formal_a0_logical_time: parsed.formal_a0_logical_time,
    durable_paired_targets: [{ paired_valid_from: "2026-09-21T05:00:00.000Z" }],
  });
  assert.equal(afterA0Pair.status, "NOT_DUE");
  assert.equal(afterA0Pair.target_logical_time, "2026-09-21T06:00:00.000Z");
  assert.equal(afterA0Pair.due_window_start, "2026-09-21T04:50:00.000Z");
  assert.equal(afterA0Pair.due_window_end_exclusive, "2026-09-21T05:30:00.000Z");

  const o00Due = evaluateProductionGfsTargetDueV1({
    planning_time: "2026-09-21T04:50:00.000Z",
    activation_fence_time: parsed.activation_fence_time,
    formal_a0_logical_time: parsed.formal_a0_logical_time,
    durable_paired_targets: [{ paired_valid_from: "2026-09-21T05:00:00.000Z" }],
  });
  assert.equal(o00Due.status, "DUE");
  assert.equal(o00Due.target_logical_time, "2026-09-21T06:00:00.000Z");

  // Current-crop is lineage only after this planning candidate is created.
  const staleLineage = fixture();
  staleLineage.lineage_current_crop_authority_ref = "docs/stale-lineage-only.json";
  parse(staleLineage);

  await assert.rejects(async () => {
    parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(fixture(), {
      deployment_subject_sha: SUBJECT,
      scope: SCOPE,
      base_runtime_start_authority_sha256: "sha256:" + "f".repeat(64),
      admission_time_utc: "2026-09-20T20:00:00.000Z",
    });
  }, /BASE_DIGEST_MISMATCH/);

  const stagePromotion = fixture();
  stagePromotion.stage_authority_required_for_evidence_acquisition = true;
  await assert.rejects(async () => parse(stagePromotion), /SCOPE_DRIFT:stage_authority_required_for_evidence_acquisition/);

  const prematureA0 = fixture();
  prematureA0.a0_authorized = true;
  await assert.rejects(async () => parse(prematureA0), /SCOPE_DRIFT:a0_authorized/);

  const missingArmMatch = fixture();
  missingArmMatch.formal_v5_arm_match_required = false;
  await assert.rejects(async () => parse(missingArmMatch), /NOT_AUTHORIZED/);

  const tooLate = fixture();
  tooLate.activation_fence_time = "2026-09-20T20:00:01.000Z";
  await assert.rejects(async () => parse(tooLate, "2026-09-20T20:01:00.000Z"), /36H_GOVERNANCE_LEAD_REQUIRED/);

  const postA0Admission = fixture();
  parse(postA0Admission, "2026-09-21T05:00:00.000Z");
  parse(postA0Admission, "2026-09-22T05:00:00.000Z");
  await assert.rejects(
    async () => parse(postA0Admission, "2026-09-22T05:00:00.001Z"),
    /STALE_AT_PROCESS_ADMISSION/,
  );

  const preformalSource = fs.readFileSync(
    path.resolve("apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts"),
    "utf8",
  );
  const ownerRunner = fs.readFileSync(
    path.resolve("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs"),
    "utf8",
  );
  const armAssembler = fs.readFileSync(
    path.resolve("scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs"),
    "utf8",
  );
  const compose = fs.readFileSync(
    path.resolve("docker-compose.mcft-cap09-production-preformal.yml"),
    "utf8",
  );

  assert.match(preformalSource, /GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH/);
  assert.match(preformalSource, /runtime_start_authority:handoffRuntimeStart/);
  assert.match(ownerRunner, /selectFormalV5EpochClockV1/);
  assert.match(ownerRunner, /formal_v5_arm_match_required:true/);
  assert.match(ownerRunner, /stage_authority_required_for_evidence_acquisition:false/);
  assert.match(ownerRunner, /status:"AUTHORIZED",armed:true/);
  assert.match(armAssembler, /loadEvidenceEpochCandidate/);
  assert.match(armAssembler, /FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_MISMATCH/);
  assert.match(armAssembler, /evidence_epoch_candidate_matched_at_arm:true/);
  assert.match(compose, /formal-v5-evidence-runtime-handoff-authority\.json/);

  const proof = {
    schema_version: "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_acceptance_v2",
    status: "PASS",
    evidence_epoch_candidate_created_pre_arm: true,
    a0_gfs_warm_start_due_from_owner_cutover_activation_fence: true,
    a0_pair_completion_does_not_pull_o00_before_t_minus_70m: true,
    o00_gfs_due_window_start: "2026-09-21T04:50:00.000Z",
    candidate_uses_same_formal_v5_epoch_clock_selector: true,
    actual_arm_exact_candidate_match_required: true,
    stage_authority_required_for_evidence_acquisition: false,
    current_crop_lineage_not_promoted_to_future_stage_truth: true,
    deployment_subject_binding_preserved: true,
    base_runtime_authority_digest_binding_preserved: true,
    minimum_governance_lead_hours: 36,
    evidence_owner_restart_valid_through_o23: true,
    evidence_owner_restart_after_o23_rejected: true,
    runtime_process_start_authorized_by_candidate: false,
    production_owner_activation_authorized_by_candidate: false,
    formal_v5_arm_authorized_by_candidate: false,
    a0_authorized_by_candidate: false,
    o00_authorized_by_candidate: false,
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
    schema_version: "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_acceptance_v2",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
