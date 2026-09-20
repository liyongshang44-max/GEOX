import fs from "node:fs";
import { createHash } from "node:crypto";

import {
  MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
  type McftCap09ProductionRuntimeScopeV1,
} from "./mcft_cap09_production_runtime_start_authority_v1.js";
import type {
  ProductionEvidenceRuntimeStartAuthorityInstanceV1,
} from "../external_evidence/mcft_cap09_production_evidence_host_planner_v1.js";

export const MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1 =
  "GEOX-MCFT-CAP-09-FORMAL-V5-EVIDENCE-RUNTIME-HANDOFF-AUTHORITY-V1" as const;

export const MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1 =
  "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1" as const;

type ExpectedV1 = {
  deployment_subject_sha: string;
  scope: McftCap09ProductionRuntimeScopeV1;
  base_runtime_start_authority_sha256: string;
  admission_time_utc?: string;
};

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
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
function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function shaV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^[0-9a-f]{40}$/.test(text)) throw new Error(code);
  return text;
}
function digestV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}
function scopeV1(value: unknown, code: string): McftCap09ProductionRuntimeScopeV1 {
  const scope = recordV1(value, code);
  return {
    tenant_id: textV1(scope.tenant_id, code + ":tenant_id"),
    project_id: textV1(scope.project_id, code + ":project_id"),
    group_id: textV1(scope.group_id, code + ":group_id"),
    field_id: textV1(scope.field_id, code + ":field_id"),
    season_id: textV1(scope.season_id, code + ":season_id"),
    zone_id: textV1(scope.zone_id, code + ":zone_id"),
  };
}
function sameScopeV1(left: McftCap09ProductionRuntimeScopeV1, right: McftCap09ProductionRuntimeScopeV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

export function sha256FileV1(path: string): string {
  return "sha256:" + createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

export function parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(
  value: unknown,
  expected: ExpectedV1,
): ProductionEvidenceRuntimeStartAuthorityInstanceV1 {
  const authority = recordV1(
    value,
    "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_AUTHORITY_INVALID",
  );
  if (
    authority.schema_version !== MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1
    || authority.authority_id !== MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1
    || authority.status !== "AUTHORIZED"
    || authority.armed !== true
    || authority.evidence_runtime_planning_handoff_authorized !== true
  ) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_NOT_AUTHORIZED");
  }
  for (const [key, required] of Object.entries({
    runtime_process_start_authorized: false,
    twin_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    stage_authority_required_for_evidence_acquisition: false,
    future_stage_pins_frozen: false,
    current_crop_authority_promoted: false,
  })) {
    if (authority[key] !== required) {
      throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_SCOPE_DRIFT:" + key);
    }
  }

  const subject = shaV1(
    authority.deployment_subject_sha,
    "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_SUBJECT_INVALID",
  );
  if (subject !== shaV1(expected.deployment_subject_sha, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_EXPECTED_SUBJECT_INVALID")) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_SUBJECT_MISMATCH");
  }

  const scope = scopeV1(authority.scope, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_SCOPE_INVALID");
  const expectedScope = scopeV1(expected.scope, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_EXPECTED_SCOPE_INVALID");
  if (!sameScopeV1(scope, expectedScope)) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_SCOPE_MISMATCH");
  }

  const baseDigest = digestV1(
    authority.base_runtime_start_authority_sha256,
    "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_BASE_DIGEST_INVALID",
  );
  if (baseDigest !== digestV1(
    expected.base_runtime_start_authority_sha256,
    "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_EXPECTED_BASE_DIGEST_INVALID",
  )) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_BASE_DIGEST_MISMATCH");
  }

  digestV1(authority.formal_v5_arm_artifact_sha256, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ARM_DIGEST_INVALID");
  digestV1(authority.formal_v5_arm_identity_hash, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ARM_IDENTITY_INVALID");
  const armTime = isoV1(authority.formal_v5_arm_time, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ARM_TIME_INVALID");
  const activationFence = isoV1(
    authority.activation_fence_time,
    "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ACTIVATION_FENCE_INVALID",
  );
  const a0 = hourV1(authority.formal_a0_logical_time, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_A0_INVALID");
  if (Date.parse(activationFence) < Date.parse(armTime)) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_BEFORE_ARM_FORBIDDEN");
  }
  if (Date.parse(activationFence) >= Date.parse(a0)) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_FENCE_MUST_PRECEDE_A0");
  }

  const admission = expected.admission_time_utc === undefined
    ? new Date().toISOString()
    : isoV1(expected.admission_time_utc, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ADMISSION_TIME_INVALID");
  if (Date.parse(admission) < Date.parse(activationFence)) {
    throw new Error("MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_FUTURE_AT_PROCESS_ADMISSION");
  }

  return {
    authority_class: MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
    authority_ref: textV1(authority.authority_ref, "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_AUTHORITY_REF_REQUIRED"),
    activation_fence_time: activationFence,
    formal_a0_authority_ref: textV1(
      authority.formal_v5_arm_ref,
      "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_ARM_REF_REQUIRED",
    ),
    formal_a0_logical_time: a0,
  };
}

export function loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(input: {
  authority_path: string;
  expected: ExpectedV1;
}): ProductionEvidenceRuntimeStartAuthorityInstanceV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(input.authority_path, "utf8"));
  } catch (error) {
    throw new Error(
      "MCFT_CAP09_FORMAL_V5_EVIDENCE_HANDOFF_FILE_INVALID:"
      + (error instanceof Error ? error.message : String(error)),
    );
  }
  return parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(parsed, input.expected);
}
