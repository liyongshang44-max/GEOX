import type { FieldProgramV1 } from "@geox/contracts";

import {
  contextAssertionV1Schema,
  contextSnapshotV1Schema,
  type ContextAssertionV1,
  type ContextSnapshotV1,
} from "../contracts/canonical_context_v1.js";

function isoFromProgramTimestamp(value: number, fallback: number): string {
  const primary = Number(value);
  const secondary = Number(fallback);
  const ms = Number.isFinite(primary) && primary > 0
    ? primary
    : Number.isFinite(secondary) && secondary > 0
      ? secondary
      : Number.NaN;

  if (!Number.isFinite(ms)) {
    throw new Error("B05B_FIELD_PROGRAM_TIMESTAMP_INVALID");
  }

  return new Date(ms).toISOString();
}

function assertionId(programId: string, kind: string): string {
  return `context_assertion:field_program:${programId}:${kind.toLowerCase()}`;
}

export function projectFieldProgramDeclaredContextV1(input: {
  field_program: FieldProgramV1;
  decision_time?: string | null;
  source_ref?: string | null;
  snapshot_id?: string | null;
}): {
  assertions: ContextAssertionV1[];
  snapshot: ContextSnapshotV1;
} {
  const program = input.field_program;
  const payload = program.payload;
  const explicitSourceRef = String(input.source_ref ?? "").trim();
  const sourceRef = explicitSourceRef || `field_program_v1:${payload.program_id}`;
  const assertedAt = isoFromProgramTimestamp(payload.updated_ts, payload.created_ts);

  const scope = {
    tenant_id: payload.tenant_id,
    project_id: payload.project_id,
    group_id: payload.group_id,
    field_id: payload.field_id,
    season_id: payload.season_id,
    zone_id: null,
  };

  const assertions: ContextAssertionV1[] = [];

  assertions.push(contextAssertionV1Schema.parse({
    schema_version: "context_assertion_v1",
    assertion_id: assertionId(payload.program_id, "CROP_IDENTITY"),
    scope,
    kind: "CROP_IDENTITY",
    value: payload.crop_code,
    source_ref: sourceRef,
    source_class: "COMPATIBILITY_LEGACY",
    asserted_at: assertedAt,
    effective_at: null,
    limitations: ["FIELD_PROGRAM_COMPATIBILITY_SOURCE"],
    reason_codes: [],
  }));

  const varietyCode = String(payload.variety_code ?? "").trim();
  if (varietyCode) {
    assertions.push(contextAssertionV1Schema.parse({
      schema_version: "context_assertion_v1",
      assertion_id: assertionId(payload.program_id, "CULTIVAR"),
      scope,
      kind: "CULTIVAR",
      value: varietyCode,
      source_ref: sourceRef,
      source_class: "COMPATIBILITY_LEGACY",
      asserted_at: assertedAt,
      effective_at: null,
      limitations: ["FIELD_PROGRAM_COMPATIBILITY_SOURCE"],
      reason_codes: [],
    }));
  }

  assertions.push(contextAssertionV1Schema.parse({
    schema_version: "context_assertion_v1",
    assertion_id: assertionId(payload.program_id, "DECLARED_FIELD_PROGRAM"),
    scope,
    kind: "DECLARED_FIELD_PROGRAM",
    value: {
      program_id: payload.program_id,
      status: payload.status,
      constraints: payload.constraints,
      budget: payload.budget ?? null,
      execution_policy: payload.execution_policy,
      acceptance_policy_ref: payload.acceptance_policy_ref ?? null,
      evidence_policy_ref: payload.evidence_policy_ref ?? null,
      created_ts: payload.created_ts,
      updated_ts: payload.updated_ts,
    },
    source_ref: sourceRef,
    source_class: "COMPATIBILITY_LEGACY",
    asserted_at: assertedAt,
    effective_at: null,
    limitations: ["FIELD_PROGRAM_COMPATIBILITY_SOURCE"],
    reason_codes: [],
  }));

  assertions.push(contextAssertionV1Schema.parse({
    schema_version: "context_assertion_v1",
    assertion_id: assertionId(payload.program_id, "CUSTOMER_GOAL"),
    scope,
    kind: "CUSTOMER_GOAL",
    value: payload.goal_profile,
    source_ref: sourceRef,
    source_class: "COMPATIBILITY_LEGACY",
    asserted_at: assertedAt,
    effective_at: null,
    limitations: ["FIELD_PROGRAM_COMPATIBILITY_SOURCE"],
    reason_codes: [],
  }));

  const snapshot = contextSnapshotV1Schema.parse({
    schema_version: "context_snapshot_v1",
    snapshot_id: String(input.snapshot_id ?? "").trim()
      || `context_snapshot:field_program:${payload.program_id}:${payload.updated_ts}`,
    scope,
    decision_time: input.decision_time ?? null,
    assertions,
    limitations: ["B05B_FIELD_PROGRAM_COMPATIBILITY_PROJECTION"],
    reason_codes: [],
  });

  return { assertions, snapshot };
}
