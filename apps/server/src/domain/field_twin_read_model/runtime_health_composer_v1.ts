// Purpose: compose terminal record-set health and latest operational Runtime Health as independent exact views.
// Boundary: pure composition over S2 exact role resolutions; no latest-row query, database access, or write authority.

import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinRuntimeHealthRoleResolutionV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationResultV1,
} from "./contracts_v1.js";
import { buildHealthContentHashV1, buildResponseInstanceHashV1 } from "./hash_contracts_v1.js";
import {
  assertComposerObjectV1,
  canonicalObjectRefV1,
  composerFailV1,
  type FieldTwinComposerObjectV1,
  type FieldTwinRuntimeHealthReadModelV1,
} from "./composer_contracts_v1.js";

export type RuntimeHealthComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  terminal_record_set_health: FieldTwinComposerObjectV1 | null;
  terminal_role_resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null;
  latest_operational_runtime_health: FieldTwinComposerObjectV1 | null;
  operational_role_resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null;
  health_pointer_validation_summary: readonly FieldTwinSourceValidationResultV1[];
};

function assertPairV1(
  object: FieldTwinComposerObjectV1 | null,
  resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null,
  scope: FieldTwinScopeV1,
  label: string,
): void {
  if ((object === null) !== (resolution === null)) composerFailV1("MCFT_RUNTIME_HEALTH_OBJECT_ROLE_PAIR_INVALID", label);
  if (!object || !resolution) return;
  assertComposerObjectV1(object, scope, "MCFT_RUNTIME_HEALTH_OBJECT_INVALID");
  if (resolution.health_object_ref !== object.object_ref) composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", label);
}

function assertTerminalResolutionV1(resolution: FieldTwinRuntimeHealthRoleResolutionV1): void {
  if (resolution.health_role !== "TERMINAL_RECORD_SET_MEMBER" || resolution.transaction_family !== "A_STATE_TICK_COMMIT") {
    composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "TERMINAL");
  }
}

function assertOperationalResolutionV1(resolution: FieldTwinRuntimeHealthRoleResolutionV1): void {
  if (resolution.health_role !== "OPERATIONAL_ATTEMPT_AUDIT" || resolution.transaction_family !== "F_OPERATIONAL_ATTEMPT_HEALTH") {
    composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "LATEST_OPERATIONAL");
  }
}

function relationshipV1(input: RuntimeHealthComposerInputV1): FieldTwinRuntimeHealthReadModelV1["health_relationship"] {
  const terminal = input.terminal_record_set_health;
  const operational = input.latest_operational_runtime_health;
  const terminalResolution = input.terminal_role_resolution;
  const operationalResolution = input.operational_role_resolution;

  if (!terminal && !operational) return "BOTH_ABSENT";
  if (terminal && !operational) {
    assertTerminalResolutionV1(terminalResolution!);
    return "TERMINAL_ONLY";
  }
  if (!terminal && operational) {
    assertOperationalResolutionV1(operationalResolution!);
    return "OPERATIONAL_ONLY";
  }

  assertTerminalResolutionV1(terminalResolution!);
  if (terminal!.object_ref === operational!.object_ref) {
    if (operationalResolution!.health_role !== "TERMINAL_RECORD_SET_MEMBER" || operationalResolution!.transaction_family !== "A_STATE_TICK_COMMIT") {
      composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "SAME_OBJECT");
    }
    return "SAME_OBJECT";
  }

  assertOperationalResolutionV1(operationalResolution!);
  if (!terminal!.logical_time || !operational!.logical_time || operational!.logical_time <= terminal!.logical_time) {
    composerFailV1("MCFT_RUNTIME_HEALTH_RELATIONSHIP_INVALID", "LATEST_OPERATIONAL_NOT_LATER");
  }
  return "LATEST_OPERATIONAL_IS_LATER";
}

export class RuntimeHealthComposerV1 {
  compose(input: RuntimeHealthComposerInputV1): FieldTwinRuntimeHealthReadModelV1 {
    assertPairV1(input.terminal_record_set_health, input.terminal_role_resolution, input.request_scope, "TERMINAL");
    assertPairV1(input.latest_operational_runtime_health, input.operational_role_resolution, input.request_scope, "LATEST_OPERATIONAL");
    for (const validation of input.health_pointer_validation_summary) {
      if (validation.validation_status !== "PASS") composerFailV1("MCFT_RUNTIME_HEALTH_POINTER_INVALID", validation.source_name);
    }

    const terminalRef: FieldTwinCanonicalObjectRefV1 | null = input.terminal_record_set_health ? canonicalObjectRefV1(input.terminal_record_set_health) : null;
    const operationalRef: FieldTwinCanonicalObjectRefV1 | null = input.latest_operational_runtime_health ? canonicalObjectRefV1(input.latest_operational_runtime_health) : null;
    const relationship = relationshipV1(input);
    const resolutions = [input.terminal_role_resolution, input.operational_role_resolution]
      .filter((value): value is FieldTwinRuntimeHealthRoleResolutionV1 => value !== null)
      .filter((value, index, values) => values.findIndex((item) => item.health_object_ref === value.health_object_ref) === index)
      .sort((left, right) => left.health_object_ref.localeCompare(right.health_object_ref));
    const healthHash = buildHealthContentHashV1({
      terminal_record_set_health: terminalRef,
      latest_operational_runtime_health: operationalRef,
      health_relationship: relationship,
      health_role_resolutions: resolutions,
      health_pointer_validation_summary: input.health_pointer_validation_summary,
    });
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: "health",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: null,
      request_cursor_boundary: null,
      canonical_visibility_snapshot_hash: null,
      endpoint_content_hashes: { health_content_hash: healthHash },
      next_cursor_envelope_digest: null,
    });
    return Object.freeze({
      schema_version: "field_twin_runtime_health_read_model_v1",
      request_scope: Object.freeze({ ...input.request_scope }),
      terminal_record_set_health: terminalRef,
      latest_operational_runtime_health: operationalRef,
      health_relationship: relationship,
      health_role_resolutions: Object.freeze(resolutions),
      health_pointer_validation_summary: Object.freeze([...input.health_pointer_validation_summary]),
      health_content_hash: healthHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}
