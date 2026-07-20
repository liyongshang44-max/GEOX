// apps/server/src/domain/field_twin_read_model/source_validation_registry_v1.ts
// Purpose: validate and materialize the frozen MCFT-CAP-07 source-validation obligation matrix as a pure registry.
// Boundary: pure object validation only; no filesystem, database, network, or mutable global state.

import {
  FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  SOURCE_VALIDATION_PROFILE_FAMILIES_V1,
  type FieldTwinSourceValidationObligationRowV1,
  type SourceValidationObligationMatrixV1,
  type SourceValidationProfileFamilyV1,
  type SourceValidationProfileRegistryV1,
} from "./contracts_v1.js";

const REQUIRED_ROW_FIELDS = [
  "source_name",
  "profile_family",
  "envelope_family",
  "identity_field",
  "scope_path",
  "payload_path",
  "logical_time_path",
  "as_of_path",
  "available_to_runtime_at_path",
  "available_projection_columns",
  "required_column_comparisons",
  "source_fact_envelope_profile",
  "parent_lookup_path",
  "child_lookup_path",
  "cardinality",
  "canonical_hash_function",
  "fact_visibility_metadata_source",
  "visibility_anchor_xid8_path",
  "visibility_anchor_kind_path",
  "visibility_epoch_source",
  "snapshot_visibility_predicate",
  "visibility_snapshot_eligible",
  "health_attempt_ref_path",
  "health_operation_discriminator_path",
  "forecast_failure_ref_path",
  "health_transaction_family_resolution_rule",
  "health_role_resolution_rule",
  "failure_code",
] as const;

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function asString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function assertNullableString(value: unknown, code: string): void {
  if (value !== null && typeof value !== "string") throw new Error(code);
}

function assertStringArray(value: unknown, code: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(code);
}

function isProfileFamily(value: unknown): value is SourceValidationProfileFamilyV1 {
  return typeof value === "string" && SOURCE_VALIDATION_PROFILE_FAMILIES_V1.includes(value as SourceValidationProfileFamilyV1);
}

function validateRow(value: unknown, index: number): FieldTwinSourceValidationObligationRowV1 {
  const row = asRecord(value, `MCFT_SOURCE_VALIDATION_MATRIX_ROW_INVALID:${index}`);
  for (const field of REQUIRED_ROW_FIELDS) {
    if (!Object.hasOwn(row, field)) throw new Error(`MCFT_SOURCE_VALIDATION_MATRIX_FIELD_MISSING:${index}:${field}`);
  }
  const sourceName = asString(row.source_name, `MCFT_SOURCE_VALIDATION_SOURCE_NAME_INVALID:${index}`);
  if (!isProfileFamily(row.profile_family)) throw new Error(`MCFT_SOURCE_VALIDATION_PROFILE_INVALID:${sourceName}`);
  assertNullableString(row.envelope_family, `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:envelope_family`);
  assertNullableString(row.identity_field, `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:identity_field`);
  if (row.scope_path !== null) asRecord(row.scope_path, `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:scope_path`);
  for (const field of [
    "payload_path",
    "logical_time_path",
    "as_of_path",
    "available_to_runtime_at_path",
    "source_fact_envelope_profile",
    "parent_lookup_path",
    "child_lookup_path",
    "cardinality",
    "canonical_hash_function",
    "fact_visibility_metadata_source",
    "visibility_anchor_xid8_path",
    "visibility_anchor_kind_path",
    "visibility_epoch_source",
    "snapshot_visibility_predicate",
    "health_attempt_ref_path",
    "health_operation_discriminator_path",
    "forecast_failure_ref_path",
    "health_transaction_family_resolution_rule",
    "health_role_resolution_rule",
  ] as const) assertNullableString(row[field], `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:${field}`);
  assertStringArray(row.available_projection_columns, `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:available_projection_columns`);
  if (!Array.isArray(row.required_column_comparisons)) throw new Error(`MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:required_column_comparisons`);
  if (typeof row.visibility_snapshot_eligible !== "boolean") throw new Error(`MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:visibility_snapshot_eligible`);
  asString(row.failure_code, `MCFT_SOURCE_VALIDATION_FIELD_INVALID:${sourceName}:failure_code`);
  return row as unknown as FieldTwinSourceValidationObligationRowV1;
}

export function validateSourceValidationObligationMatrixV1(value: unknown): SourceValidationObligationMatrixV1 {
  const matrix = asRecord(value, "MCFT_SOURCE_VALIDATION_MATRIX_INVALID");
  if (matrix.source_profile_version !== FIELD_TWIN_SOURCE_PROFILE_VERSION_V1) throw new Error("MCFT_SOURCE_VALIDATION_PROFILE_VERSION_INVALID");
  assertStringArray(matrix.profile_families, "MCFT_SOURCE_VALIDATION_PROFILE_FAMILIES_INVALID");
  const profileFamilies = matrix.profile_families;
  if (profileFamilies.length !== SOURCE_VALIDATION_PROFILE_FAMILIES_V1.length
    || new Set(profileFamilies).size !== SOURCE_VALIDATION_PROFILE_FAMILIES_V1.length
    || SOURCE_VALIDATION_PROFILE_FAMILIES_V1.some((profile) => !profileFamilies.includes(profile))) {
    throw new Error("MCFT_SOURCE_VALIDATION_PROFILE_FAMILIES_INVALID");
  }
  assertStringArray(matrix.row_schema_fields, "MCFT_SOURCE_VALIDATION_ROW_SCHEMA_FIELDS_INVALID");
  const rowSchemaFields = matrix.row_schema_fields;
  if (REQUIRED_ROW_FIELDS.some((field) => !rowSchemaFields.includes(field))) throw new Error("MCFT_SOURCE_VALIDATION_ROW_SCHEMA_FIELDS_INCOMPLETE");
  if (!Array.isArray(matrix.rows) || matrix.rows.length === 0) throw new Error("MCFT_SOURCE_VALIDATION_ROWS_INVALID");
  const rows = matrix.rows.map(validateRow);
  const keys = rows.map((row) => `${row.source_name}|${row.profile_family}`);
  if (new Set(keys).size !== keys.length) throw new Error("MCFT_SOURCE_VALIDATION_DUPLICATE_ROW");
  return {
    schema_version: asString(matrix.schema_version, "MCFT_SOURCE_VALIDATION_SCHEMA_VERSION_INVALID"),
    matrix_id: asString(matrix.matrix_id, "MCFT_SOURCE_VALIDATION_MATRIX_ID_INVALID"),
    taskbook_version: asString(matrix.taskbook_version, "MCFT_SOURCE_VALIDATION_TASKBOOK_VERSION_INVALID"),
    source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
    profile_families: [...SOURCE_VALIDATION_PROFILE_FAMILIES_V1],
    row_schema_fields: [...rowSchemaFields],
    rows,
  };
}

export function buildSourceValidationProfileRegistryV1(matrix: SourceValidationObligationMatrixV1): SourceValidationProfileRegistryV1 {
  const entries = [...matrix.rows]
    .sort((left, right) => left.source_name < right.source_name ? -1 : left.source_name > right.source_name ? 1 : left.profile_family < right.profile_family ? -1 : 1)
    .map((row) => ({
      source_name: row.source_name,
      profile_family: row.profile_family,
      failure_code: row.failure_code,
      visibility_snapshot_eligible: row.visibility_snapshot_eligible,
      obligation_row: row,
    }));
  return Object.freeze({
    registry_schema_version: "source_validation_profile_registry_v1",
    source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
    entries,
  });
}

export function resolveSourceValidationProfileV1(
  registry: SourceValidationProfileRegistryV1,
  sourceName: string,
  profileFamily: SourceValidationProfileFamilyV1,
) {
  const matches = registry.entries.filter((entry) => entry.source_name === sourceName && entry.profile_family === profileFamily);
  if (matches.length !== 1) throw new Error("MCFT_SOURCE_VALIDATION_PROFILE_RESOLUTION_INVALID");
  return matches[0];
}
