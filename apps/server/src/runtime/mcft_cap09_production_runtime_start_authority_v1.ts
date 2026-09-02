// MCFT-CAP-09 shared production runtime-start authority parser.
//
// Boundary: validation only. This module performs no database, provider, filesystem,
// owner-activation, Formal, A0, or O00 effects. Evidence Runtime and Twin Runtime must
// pass the same governed runtime-start envelope before either production process can start.

export const MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1 =
  "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY" as const;

export type McftCap09ProductionRuntimePlaneV1 =
  | "EVIDENCE_RUNTIME"
  | "TWIN_RUNTIME";

export type McftCap09ProductionRuntimeStartAuthorityInstanceV1 = {
  authority_class: typeof MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1;
  authority_ref: string;
  activation_fence_time: string;
  formal_a0_authority_ref: string;
  formal_a0_logical_time: string;
};

function recordV1(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_INVALID");
  }
  return value as Record<string, unknown>;
}

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

export function parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
  value: unknown,
  plane: McftCap09ProductionRuntimePlaneV1,
): McftCap09ProductionRuntimeStartAuthorityInstanceV1 {
  const authority = recordV1(value);
  if (
    authority.schema_version
      !== "geox_mcft_cap09_production_runtime_start_authority_instance_v1"
    || authority.authority_id
      !== "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1"
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_IDENTITY_INVALID");
  }

  const planeAuthorized = plane === "EVIDENCE_RUNTIME"
    ? authority.evidence_runtime_start_authorized === true
    : authority.twin_runtime_start_authorized === true;
  if (
    authority.armed !== true
    || authority.status !== "AUTHORIZED"
    || authority.runtime_process_start_authorized !== true
    || !planeAuthorized
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED");
  }

  if (
    authority.production_owner_activation_authorized !== false
    || authority.formal_v5_arm_authorized !== false
    || authority.a0_authorized !== false
    || authority.o00_authorized !== false
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_SCOPE_INVALID");
  }
  if (
    authority.authority_class
      !== MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_INVALID");
  }

  const activationFence = isoV1(
    authority.activation_fence_time,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_ACTIVATION_FENCE_INVALID",
  );
  const formalA0 = hourV1(
    authority.formal_a0_logical_time,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_INVALID",
  );
  if (Date.parse(activationFence) >= Date.parse(formalA0)) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_FENCE_MUST_PRECEDE_A0");
  }

  return {
    authority_class: MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
    authority_ref: textV1(
      authority.authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_REF_REQUIRED",
    ),
    activation_fence_time: activationFence,
    formal_a0_authority_ref: textV1(
      authority.formal_a0_authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_AUTHORITY_REF_REQUIRED",
    ),
    formal_a0_logical_time: formalA0,
  };
}
