import fs from "node:fs";

import type { TwinScopeKeyV1 } from "./twin_runtime/ports.js";

export const MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_V1" as const;

export type McftCap09FormalV5ActiveActivationAuthorityV1 = {
  schema_version: "geox_mcft_cap09_formal_v5_active_activation_authority_v1";
  authority_id: typeof MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1;
  status: "PASS";
  runtime_mode: "FORMAL_V5_ACTIVE";
  subject_sha: string;
  authority_continuity_head_sha: string;
  epoch_id: string;
  scope: TwinScopeKeyV1;
  a0: string;
  o00: string;
  o23: string;
  manifest_ref: string;
  manifest_hash: string;
  bootstrap_result_sha256: string;
  previous_twin_lease_owner: string;
  previous_twin_fencing_token: string;
  twin_activation_authorized: true;
  forcing_activation_authorized: true;
  provider_semantics_rewritten: false;
  scheduler_semantics_rewritten: false;
  persistent_tick_semantics_rewritten: false;
  crop_stage_semantics_rewritten: false;
  revision_semantics_rewritten: false;
  database_schema_changed: false;
};

function requiredText(value: unknown, code: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(code);
  return text;
}

function canonicalHour(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== text
    || !text.endsWith(":00:00.000Z")
  ) {
    throw new Error(code);
  }
  return text;
}

function sha(value: unknown, code: string): string {
  const text = requiredText(value, code);
  if (!/^[0-9a-f]{40}$/.test(text)) throw new Error(code);
  return text;
}

function digest(value: unknown, code: string): string {
  const text = requiredText(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

export function validateMcftCap09FormalV5ActiveActivationAuthorityV1(
  value: unknown,
): McftCap09FormalV5ActiveActivationAuthorityV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_OBJECT_REQUIRED");
  }
  const row = value as Record<string, unknown>;
  if (
    row.schema_version !== "geox_mcft_cap09_formal_v5_active_activation_authority_v1"
    || row.authority_id !== MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1
    || row.status !== "PASS"
    || row.runtime_mode !== "FORMAL_V5_ACTIVE"
  ) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_HEADER_INVALID");
  }

  const subject = sha(row.subject_sha, "FORMAL_V5_ACTIVE_AUTHORITY_SUBJECT_INVALID");
  const continuityHead = sha(
    row.authority_continuity_head_sha,
    "FORMAL_V5_ACTIVE_AUTHORITY_CONTINUITY_HEAD_INVALID",
  );
  const epoch = requiredText(row.epoch_id, "FORMAL_V5_ACTIVE_AUTHORITY_EPOCH_REQUIRED");
  const a0 = canonicalHour(row.a0, "FORMAL_V5_ACTIVE_AUTHORITY_A0_INVALID");
  const o00 = canonicalHour(row.o00, "FORMAL_V5_ACTIVE_AUTHORITY_O00_INVALID");
  const o23 = canonicalHour(row.o23, "FORMAL_V5_ACTIVE_AUTHORITY_O23_INVALID");
  if (Date.parse(o00) - Date.parse(a0) !== 3_600_000) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_A0_O00_OFFSET_INVALID");
  }
  if (Date.parse(o23) - Date.parse(o00) !== 23 * 3_600_000) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_O00_O23_RANGE_INVALID");
  }

  const scope = row.scope as TwinScopeKeyV1;
  for (const key of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    requiredText(scope?.[key], "FORMAL_V5_ACTIVE_AUTHORITY_SCOPE_" + key.toUpperCase() + "_REQUIRED");
  }

  if (
    row.twin_activation_authorized !== true
    || row.forcing_activation_authorized !== true
  ) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_ACTIVATION_FLAGS_REQUIRED");
  }
  for (const key of [
    "provider_semantics_rewritten",
    "scheduler_semantics_rewritten",
    "persistent_tick_semantics_rewritten",
    "crop_stage_semantics_rewritten",
    "revision_semantics_rewritten",
    "database_schema_changed",
  ] as const) {
    if (row[key] !== false) {
      throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_SEMANTIC_CHANGE_FORBIDDEN:" + key);
    }
  }

  const previousFence = requiredText(
    row.previous_twin_fencing_token,
    "FORMAL_V5_ACTIVE_AUTHORITY_PREVIOUS_FENCE_REQUIRED",
  );
  if (!/^\d+$/.test(previousFence) || BigInt(previousFence) <= 0n) {
    throw new Error("FORMAL_V5_ACTIVE_AUTHORITY_PREVIOUS_FENCE_INVALID");
  }

  return {
    schema_version: "geox_mcft_cap09_formal_v5_active_activation_authority_v1",
    authority_id: MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1,
    status: "PASS",
    runtime_mode: "FORMAL_V5_ACTIVE",
    subject_sha: subject,
    authority_continuity_head_sha: continuityHead,
    epoch_id: epoch,
    scope: { ...scope },
    a0,
    o00,
    o23,
    manifest_ref: requiredText(row.manifest_ref, "FORMAL_V5_ACTIVE_AUTHORITY_MANIFEST_REF_REQUIRED"),
    manifest_hash: digest(row.manifest_hash, "FORMAL_V5_ACTIVE_AUTHORITY_MANIFEST_HASH_INVALID"),
    bootstrap_result_sha256: digest(
      row.bootstrap_result_sha256,
      "FORMAL_V5_ACTIVE_AUTHORITY_BOOTSTRAP_DIGEST_INVALID",
    ),
    previous_twin_lease_owner: requiredText(
      row.previous_twin_lease_owner,
      "FORMAL_V5_ACTIVE_AUTHORITY_PREVIOUS_OWNER_REQUIRED",
    ),
    previous_twin_fencing_token: previousFence,
    twin_activation_authorized: true,
    forcing_activation_authorized: true,
    provider_semantics_rewritten: false,
    scheduler_semantics_rewritten: false,
    persistent_tick_semantics_rewritten: false,
    crop_stage_semantics_rewritten: false,
    revision_semantics_rewritten: false,
    database_schema_changed: false,
  };
}

export function readMcftCap09FormalV5ActiveActivationAuthorityV1(
  filePath: string,
): McftCap09FormalV5ActiveActivationAuthorityV1 {
  return validateMcftCap09FormalV5ActiveActivationAuthorityV1(
    JSON.parse(fs.readFileSync(filePath, "utf8")),
  );
}
