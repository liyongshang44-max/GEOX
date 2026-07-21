// Purpose: resolve the two independent MCFT-CAP-07 Runtime Health authorities inside one caller-owned read-only snapshot.
// Boundary: S4 SELECT-only adapter over the S2 snapshot context; no transaction ownership, DDL/DML, write authority, or role inference without exact evidence.

import {
  RuntimeHealthRoleResolverV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinSourceValidationResultV1,
} from "../../domain/field_twin_read_model/index.js";
import type { FieldTwinComposerObjectV1 } from "../../domain/field_twin_read_model/composer_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresFieldTwinReadRepositoryV1 } from "./postgres_field_twin_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";

export type OptionalTerminalHealthContextV1 = {
  object: FieldTwinComposerObjectV1;
  resolution: FieldTwinRuntimeHealthRoleResolutionV1;
};

export type OptionalOperationalHealthContextV1 = {
  object: FieldTwinComposerObjectV1 | null;
  resolution: FieldTwinRuntimeHealthRoleResolutionV1 | null;
  pointer_validation: FieldTwinSourceValidationResultV1 | null;
};

function errorMessageV1(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function exactTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${code}:MISSING`);
  return value;
}

function optionalTextV1(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function domainPayloadV1(object: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  if (!object.payload || typeof object.payload !== "object" || Array.isArray(object.payload)) throw new Error(code);
  return object.payload as Record<string, unknown>;
}

export class PostgresFieldTwinS4HealthRepositoryV1 {
  private readonly base = new PostgresFieldTwinReadRepositoryV1();
  private readonly roleResolver = new RuntimeHealthRoleResolverV1();

  async readOptionalTerminalHealthContext(
    context: PostgresFieldTwinSnapshotContextV1,
  ): Promise<OptionalTerminalHealthContextV1 | null> {
    try {
      const root = await this.base.resolveCurrentRuntimeRoot(context);
      return {
        object: root.terminal_record_set_health,
        resolution: root.terminal_health_role_resolution,
      };
    } catch (error) {
      const message = errorMessageV1(error);
      if (message === "MCFT_RUNTIME_NOT_ESTABLISHED"
        || message === "MCFT_RUNTIME_GRAPH_INCOMPLETE:CHECKPOINT_POINTER_MISSING") {
        return null;
      }
      throw error;
    }
  }

  async readLatestOperationalHealth(
    context: PostgresFieldTwinSnapshotContextV1,
    terminal: OptionalTerminalHealthContextV1 | null,
  ): Promise<OptionalOperationalHealthContextV1> {
    const latest = await this.base.readOptionalScopePointerObject(context, {
      relation: "public.twin_runtime_health_latest_index_v1",
      ref_column: "health_object_id",
      hash_column: "determinism_hash",
      expected_type: "twin_runtime_health_v1",
    });
    if (!latest) return { object: null, resolution: null, pointer_validation: null };

    if (terminal && latest.object.object_ref === terminal.object.object_ref) {
      if (latest.object.object_hash !== terminal.object.object_hash) {
        throw new Error("MCFT_RUNTIME_HEALTH_POINTER_HASH_DIVERGENCE");
      }
      return {
        object: terminal.object,
        resolution: terminal.resolution,
        pointer_validation: latest.validation,
      };
    }

    const healthPayload = domainPayloadV1(latest.payload, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:PAYLOAD");
    const attemptRef = exactTextV1(healthPayload.attempt_ref, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF");
    const attempt = await this.base.readExactObjectByRef(context, attemptRef, "twin_runtime_attempt_v1");
    const failureRef = optionalTextV1(healthPayload.forecast_failure_ref);
    if (failureRef) {
      const failure = await this.base.readExactObjectByRef(context, failureRef, "twin_forecast_failure_v1");
      const failurePayload = domainPayloadV1(failure.payload, "MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:FORECAST_FAILURE_PAYLOAD");
      if (failurePayload.attempt_ref !== attemptRef) {
        throw new Error("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:FORECAST_FAILURE_ATTEMPT");
      }
    }

    const resolution = this.roleResolver.resolve({
      health_object_ref: latest.object.object_ref,
      record_set_membership: null,
      operational_attempt_relation: {
        attempt_ref: attempt.object.object_ref,
        health_ref: latest.object.object_ref,
        forecast_failure_ref: failureRef,
      },
    });
    return {
      object: latest.object,
      resolution,
      pointer_validation: latest.validation,
    };
  }
}
