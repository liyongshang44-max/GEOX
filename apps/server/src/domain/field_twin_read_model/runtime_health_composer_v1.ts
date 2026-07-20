// Purpose: compose terminal record-set health and latest operational Runtime Health as independent exact views.
// Boundary: pure composition over S2 exact role resolutions; no latest-row query, role inference from time, database access, or write authority.

import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinRuntimeHealthRoleResolutionV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationResultV1,
} from "./contracts_v1.js";
import { RuntimeHealthDualResolverV1 } from "./exact_resolvers_v1.js";
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

function assertObjectResolutionPairV1(
  object: FieldTwinComposerObjectV1 | null,
  resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null,
  expectedRole: "TERMINAL_RECORD_SET_MEMBER" | "OPERATIONAL_ATTEMPT_AUDIT",
  scope: FieldTwinScopeV1,
): void {
  if ((object === null) !== (resolution === null)) composerFailV1("MCFT_RUNTIME_HEALTH_OBJECT_ROLE_PAIR_INVALID", expectedRole);
  if (!object || !resolution) return;
  assertComposerObjectV1(object, scope, "MCFT_RUNTIME_HEALTH_OBJECT_INVALID");
  if (resolution.health_object_ref !== object.object_ref || resolution.health_role !== expectedRole) {
    composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", expectedRole);
  }
  if (expectedRole === "TERMINAL_RECORD_SET_MEMBER" && resolution.transaction_family !== "A_STATE_TICK_COMMIT") {
    composerFailV1("MCFT_RUNTIME_HEALTH_TRANSACTION_FAMILY_INVALID", expectedRole);
  }
  if (expectedRole === "OPERATIONAL_ATTEMPT_AUDIT" && resolution.transaction_family !== "F_OPERATIONAL_ATTEMPT_HEALTH") {
    composerFailV1("MCFT_RUNTIME_HEALTH_TRANSACTION_FAMILY_INVALID", expectedRole);
  }
}

export class RuntimeHealthComposerV1 {
  private readonly dualResolver = new RuntimeHealthDualResolverV1();

  compose(input: RuntimeHealthComposerInputV1): FieldTwinRuntimeHealthReadModelV1 {
    assertObjectResolutionPairV1(input.terminal_record_set_health, input.terminal_role_resolution, "TERMINAL_RECORD_SET_MEMBER", input.request_scope);
    assertObjectResolutionPairV1(input.latest_operational_runtime_health, input.operational_role_resolution, "OPERATIONAL_ATTEMPT_AUDIT", input.request_scope);
    for (const validation of input.health_pointer_validation_summary) {
      if (validation.validation_status !== "PASS") composerFailV1("MCFT_RUNTIME_HEALTH_POINTER_INVALID", validation.source_name);
    }
    const dual = this.dualResolver.resolve({
      terminal_record_set_health: input.terminal_role_resolution,
      latest_operational_runtime_health: input.operational_role_resolution,
    });
    const terminalRef: FieldTwinCanonicalObjectRefV1 | null = input.terminal_record_set_health ? canonicalObjectRefV1(input.terminal_record_set_health) : null;
    const operationalRef: FieldTwinCanonicalObjectRefV1 | null = input.latest_operational_runtime_health ? canonicalObjectRefV1(input.latest_operational_runtime_health) : null;
    const resolutions = [input.terminal_role_resolution, input.operational_role_resolution]
      .filter((value): value is FieldTwinRuntimeHealthRoleResolutionV1 => value !== null)
      .sort((left, right) => left.health_object_ref.localeCompare(right.health_object_ref));
    const healthHash = buildHealthContentHashV1({
      terminal_record_set_health: terminalRef,
      latest_operational_runtime_health: operationalRef,
      health_relationship: dual.relationship,
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
      health_relationship: dual.relationship,
      health_role_resolutions: Object.freeze(resolutions),
      health_pointer_validation_summary: Object.freeze([...input.health_pointer_validation_summary]),
      health_content_hash: healthHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}
