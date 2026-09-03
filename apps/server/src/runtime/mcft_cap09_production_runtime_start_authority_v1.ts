import fs from "node:fs";

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

export type McftCap09ProductionRuntimeScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type McftCap09ProductionRuntimeStartAuthorityInstanceV1 = {
  authority_class: typeof MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1;
  authority_ref: string;
  deployment_subject_sha: string;
  scope: McftCap09ProductionRuntimeScopeV1;
  activation_fence_time: string;
  formal_a0_authority_ref: string;
  formal_a0_authority_sha256: string;
  live_activation_authority_ref: string;
  live_activation_authority_sha256: string;
  formal_a0_logical_time: string;
};

export type McftCap09ProductionRuntimeStartExpectedBindingV1 = {
  deployment_subject_sha: string;
  scope: McftCap09ProductionRuntimeScopeV1;
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

function scopeV1(
  value: unknown,
  code: string,
): McftCap09ProductionRuntimeScopeV1 {
  const scope = recordV1(value);
  return {
    tenant_id: textV1(scope.tenant_id, code + ":tenant_id"),
    project_id: textV1(scope.project_id, code + ":project_id"),
    group_id: textV1(scope.group_id, code + ":group_id"),
    field_id: textV1(scope.field_id, code + ":field_id"),
    season_id: textV1(scope.season_id, code + ":season_id"),
    zone_id: textV1(scope.zone_id, code + ":zone_id"),
  };
}

function sameScopeV1(
  left: McftCap09ProductionRuntimeScopeV1,
  right: McftCap09ProductionRuntimeScopeV1,
): boolean {
  return (
    left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id
  );
}

export function parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
  value: unknown,
  plane: McftCap09ProductionRuntimePlaneV1,
  expected: McftCap09ProductionRuntimeStartExpectedBindingV1,
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

  const deploymentSubject = shaV1(
    authority.deployment_subject_sha,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_DEPLOYMENT_SUBJECT_INVALID",
  );
  const expectedSubject = shaV1(
    expected.deployment_subject_sha,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_EXPECTED_DEPLOYMENT_SUBJECT_INVALID",
  );
  if (deploymentSubject !== expectedSubject) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_DEPLOYMENT_SUBJECT_MISMATCH");
  }

  const scope = scopeV1(
    authority.scope,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_SCOPE_INVALID",
  );
  const expectedScope = scopeV1(
    expected.scope,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_EXPECTED_SCOPE_INVALID",
  );
  if (!sameScopeV1(scope, expectedScope)) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_SCOPE_MISMATCH");
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
    deployment_subject_sha: deploymentSubject,
    scope,
    activation_fence_time: activationFence,
    formal_a0_authority_ref: textV1(
      authority.formal_a0_authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_AUTHORITY_REF_REQUIRED",
    ),
    formal_a0_authority_sha256: digestV1(
      authority.formal_a0_authority_sha256,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_AUTHORITY_DIGEST_REQUIRED",
    ),
    live_activation_authority_ref: textV1(
      authority.live_activation_authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_LIVE_ACTIVATION_AUTHORITY_REF_REQUIRED",
    ),
    live_activation_authority_sha256: digestV1(
      authority.live_activation_authority_sha256,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_LIVE_ACTIVATION_AUTHORITY_DIGEST_REQUIRED",
    ),
    formal_a0_logical_time: formalA0,
  };
}


export function loadMcftCap09ProductionRuntimeStartAuthorityV1(input: {
  plane: McftCap09ProductionRuntimePlaneV1;
  expected: McftCap09ProductionRuntimeStartExpectedBindingV1;
  authority_path?: string | null;
  explicit_authority?: unknown;
  embedded_authority?: unknown;
}): McftCap09ProductionRuntimeStartAuthorityInstanceV1 {
  if (input.explicit_authority !== undefined) {
    return parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      input.explicit_authority,
      input.plane,
      input.expected,
    );
  }

  const pathValue = String(input.authority_path ?? "").trim();
  if (pathValue) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(pathValue, "utf8"));
    } catch (error) {
      throw new Error(
        `MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_FILE_INVALID:${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
      parsed,
      input.plane,
      input.expected,
    );
  }

  return parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
    input.embedded_authority,
    input.plane,
    input.expected,
  );
}
