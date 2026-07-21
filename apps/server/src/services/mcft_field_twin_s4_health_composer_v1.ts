// Purpose: compose S4 dual Runtime Health while allowing the latest operational pointer to equal the terminal record-set member.
// Boundary: pure composition over exact S2 resolutions; no query, latest-by-time inference, persistence, or write authority.

import type { FieldTwinRuntimeHealthRoleResolutionV1, FieldTwinScopeV1, FieldTwinSourceValidationResultV1 } from "../domain/field_twin_read_model/contracts_v1.js";
import { buildHealthContentHashV1, buildResponseInstanceHashV1 } from "../domain/field_twin_read_model/hash_contracts_v1.js";
import { assertComposerObjectV1, canonicalObjectRefV1, composerFailV1, type FieldTwinComposerObjectV1, type FieldTwinRuntimeHealthReadModelV1 } from "../domain/field_twin_read_model/composer_contracts_v1.js";

export type S4RuntimeHealthComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("../domain/field_twin_read_model/contracts_v1.js").CanonicalUtcInstantV1;
  terminal_record_set_health: FieldTwinComposerObjectV1;
  terminal_role_resolution: FieldTwinRuntimeHealthRoleResolutionV1;
  latest_operational_runtime_health: FieldTwinComposerObjectV1 | null;
  operational_role_resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null;
  health_pointer_validation_summary: readonly FieldTwinSourceValidationResultV1[];
};

export class S4RuntimeHealthComposerV1 {
  compose(input: S4RuntimeHealthComposerInputV1): FieldTwinRuntimeHealthReadModelV1 {
    assertComposerObjectV1(input.terminal_record_set_health, input.request_scope, "MCFT_RUNTIME_HEALTH_OBJECT_INVALID");
    if (input.terminal_role_resolution.health_object_ref !== input.terminal_record_set_health.object_ref
      || input.terminal_role_resolution.health_role !== "TERMINAL_RECORD_SET_MEMBER"
      || input.terminal_role_resolution.transaction_family !== "A_STATE_TICK_COMMIT") {
      composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "TERMINAL");
    }
    if ((input.latest_operational_runtime_health === null) !== (input.operational_role_resolution === null)) composerFailV1("MCFT_RUNTIME_HEALTH_OBJECT_ROLE_PAIR_INVALID", "LATEST_OPERATIONAL_POINTER");
    if (input.latest_operational_runtime_health && input.operational_role_resolution) {
      assertComposerObjectV1(input.latest_operational_runtime_health, input.request_scope, "MCFT_RUNTIME_HEALTH_OBJECT_INVALID");
      if (input.operational_role_resolution.health_object_ref !== input.latest_operational_runtime_health.object_ref) composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "LATEST_POINTER_REF");
      const sameTerminal = input.latest_operational_runtime_health.object_ref === input.terminal_record_set_health.object_ref;
      if (sameTerminal) {
        if (input.operational_role_resolution.health_role !== "TERMINAL_RECORD_SET_MEMBER" || input.operational_role_resolution.transaction_family !== "A_STATE_TICK_COMMIT") composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "LATEST_SAME_TERMINAL");
      } else if (input.operational_role_resolution.health_role !== "OPERATIONAL_ATTEMPT_AUDIT" || input.operational_role_resolution.transaction_family !== "F_OPERATIONAL_ATTEMPT_HEALTH") {
        composerFailV1("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "LATEST_DISTINCT_OPERATIONAL");
      }
    }
    for (const validation of input.health_pointer_validation_summary) if (validation.validation_status !== "PASS") composerFailV1("MCFT_RUNTIME_HEALTH_POINTER_INVALID", validation.source_name);
    const terminalRef = canonicalObjectRefV1(input.terminal_record_set_health);
    const operationalRef = input.latest_operational_runtime_health ? canonicalObjectRefV1(input.latest_operational_runtime_health) : null;
    const relationship = operationalRef ? operationalRef.object_ref === terminalRef.object_ref ? "SAME_OBJECT" as const : "DISTINCT_OBJECTS" as const : "ONE_OR_BOTH_ABSENT" as const;
    const resolutions = [input.terminal_role_resolution, input.operational_role_resolution]
      .filter((value): value is FieldTwinRuntimeHealthRoleResolutionV1 => value !== null)
      .filter((value, index, values) => values.findIndex((item) => item.health_object_ref === value.health_object_ref) === index)
      .sort((left, right) => left.health_object_ref.localeCompare(right.health_object_ref));
    const healthHash = buildHealthContentHashV1({ terminal_record_set_health: terminalRef, latest_operational_runtime_health: operationalRef, health_relationship: relationship, health_role_resolutions: resolutions, health_pointer_validation_summary: input.health_pointer_validation_summary });
    const responseHash = buildResponseInstanceHashV1({ endpoint_id: "health", endpoint_version: "v1", scope: input.request_scope, response_started_at: input.response_started_at, request_filter_hash: null, request_cursor_boundary: null, canonical_visibility_snapshot_hash: null, endpoint_content_hashes: { health_content_hash: healthHash }, next_cursor_envelope_digest: null });
    return Object.freeze({ schema_version: "field_twin_runtime_health_read_model_v1", request_scope: Object.freeze({ ...input.request_scope }), terminal_record_set_health: terminalRef, latest_operational_runtime_health: operationalRef, health_relationship: relationship, health_role_resolutions: Object.freeze(resolutions), health_pointer_validation_summary: Object.freeze([...input.health_pointer_validation_summary]), health_content_hash: healthHash, response_started_at: input.response_started_at, response_instance_hash: responseHash });
  }
}
