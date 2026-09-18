export const MCFT_CAP09_AM19_FORMAL_DATABASE_V5 =
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;

export const MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json" as const;

export const MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5 =
  "34fd3e92e0e628cf0db16e10df3633337fe81a1a" as const;

export type McftCap09FormalV5ArmV1 = {
  schema_version: "geox_mcft_cap09_formal_v5_arm_v1";
  status: "PASS";
  subject_sha: string;
  arm_identity_hash: string;
  epoch_id: string;
  formal_database_name: typeof MCFT_CAP09_AM19_FORMAL_DATABASE_V5;
  formal_store_authority_ref: typeof MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5;
  formal_store_authority_blob_sha: typeof MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5;
  a0: string;
  o00: string;
  o23: string;
  manifest_ref: string;
  arm_evaluated_at: string;
  timing_authority_ref: string;
  timing_authority_sha256: string;
  selected_budget_ms: number;
  current_crop_authority_ref: string;
  current_crop_authority_sha256: string;
  current_crop_authority_evidence_digest: string;
  crop_water_use_stage: "LATE";
  biological_stage: string;
  stage_authority_as_of: string;
  stage_authority_valid_until: string;
  zero_state_proof_sha256: string;
  live_zero_state: {
    database_name: typeof MCFT_CAP09_AM19_FORMAL_DATABASE_V5;
    public_base_table_count: 0;
    public_routine_count: 0;
    transaction_read_only: true;
  };
  h5_reverified: true;
  phase6_retired_triggers_zero: true;
  formal_v5_arm: true;
  formal_v5_epoch_selected: true;
  formal_database_mutation: false;
  a0_bootstrap: false;
  o00_started: false;
  provider_request_count: 0;
  mcft_cap09_completed: false;
};

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function sha256V1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

export function validateMcftCap09FormalV5ArmV1(
  arm: McftCap09FormalV5ArmV1,
  expectedSubject?: string,
): void {
  if (arm?.schema_version !== "geox_mcft_cap09_formal_v5_arm_v1" || arm.status !== "PASS") {
    throw new Error("FORMAL_V5_ARM_PASS_REQUIRED");
  }
  if (!/^[0-9a-f]{40}$/.test(textV1(arm.subject_sha, "FORMAL_V5_ARM_SUBJECT_REQUIRED"))) {
    throw new Error("FORMAL_V5_ARM_SUBJECT_INVALID");
  }
  if (expectedSubject !== undefined && arm.subject_sha !== expectedSubject) {
    throw new Error("FORMAL_V5_ARM_SUBJECT_MISMATCH");
  }
  if (arm.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V5) {
    throw new Error("FORMAL_V5_ARM_DATABASE_V5_REQUIRED");
  }
  if (
    arm.formal_store_authority_ref !== MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5
    || arm.formal_store_authority_blob_sha !== MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5
  ) {
    throw new Error("FORMAL_V5_ARM_STORE_AUTHORITY_V3_PIN_REQUIRED");
  }
  const a0 = isoV1(arm.a0, "FORMAL_V5_ARM_A0_INVALID");
  const o00 = isoV1(arm.o00, "FORMAL_V5_ARM_O00_INVALID");
  const o23 = isoV1(arm.o23, "FORMAL_V5_ARM_O23_INVALID");
  if (new Date(Date.parse(a0) + 3_600_000).toISOString() !== o00) {
    throw new Error("FORMAL_V5_ARM_O00_MUST_EQUAL_A0_PLUS_1H");
  }
  if (new Date(Date.parse(a0) + 24 * 3_600_000).toISOString() !== o23) {
    throw new Error("FORMAL_V5_ARM_O23_MUST_EQUAL_A0_PLUS_24H");
  }
  isoV1(arm.arm_evaluated_at, "FORMAL_V5_ARM_EVALUATED_AT_INVALID");
  isoV1(arm.stage_authority_as_of, "FORMAL_V5_ARM_STAGE_AS_OF_INVALID");
  const stageValidUntil = isoV1(arm.stage_authority_valid_until, "FORMAL_V5_ARM_STAGE_VALID_UNTIL_INVALID");
  if (Date.parse(o23) > Date.parse(stageValidUntil)) {
    throw new Error("FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23");
  }
  if (!Number.isSafeInteger(arm.selected_budget_ms) || arm.selected_budget_ms <= 0) {
    throw new Error("FORMAL_V5_ARM_SELECTED_BUDGET_REQUIRED");
  }
  sha256V1(arm.arm_identity_hash, "FORMAL_V5_ARM_IDENTITY_HASH_INVALID");
  sha256V1(arm.timing_authority_sha256, "FORMAL_V5_ARM_TIMING_AUTHORITY_DIGEST_INVALID");
  sha256V1(arm.current_crop_authority_sha256, "FORMAL_V5_ARM_CURRENT_CROP_DIGEST_INVALID");
  sha256V1(arm.current_crop_authority_evidence_digest, "FORMAL_V5_ARM_CURRENT_CROP_EVIDENCE_DIGEST_INVALID");
  sha256V1(arm.zero_state_proof_sha256, "FORMAL_V5_ARM_ZERO_STATE_PROOF_DIGEST_INVALID");
  if (arm.crop_water_use_stage !== "LATE") throw new Error("FORMAL_V5_ARM_LATE_STAGE_REQUIRED");
  if (
    arm.live_zero_state?.database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V5
    || arm.live_zero_state.public_base_table_count !== 0
    || arm.live_zero_state.public_routine_count !== 0
    || arm.live_zero_state.transaction_read_only !== true
  ) {
    throw new Error("FORMAL_V5_ARM_LIVE_ZERO_STATE_REQUIRED");
  }
  if (arm.h5_reverified !== true || arm.phase6_retired_triggers_zero !== true) {
    throw new Error("FORMAL_V5_ARM_GRADUATION_REVERIFICATION_REQUIRED");
  }
  if (arm.formal_v5_arm !== true || arm.formal_v5_epoch_selected !== true) {
    throw new Error("FORMAL_V5_ARM_EFFECT_REQUIRED");
  }
  if (
    arm.formal_database_mutation !== false
    || arm.a0_bootstrap !== false
    || arm.o00_started !== false
    || arm.provider_request_count !== 0
    || arm.mcft_cap09_completed !== false
  ) {
    throw new Error("FORMAL_V5_ARM_LATER_EFFECT_FORBIDDEN");
  }
}
