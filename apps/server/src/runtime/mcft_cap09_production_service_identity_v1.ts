// MCFT-CAP-09 production service identity and per-instance lease-owner binding.
//
// The frozen non-GitHub host authority binds stable service identities. A live database
// lease must remain attributable to one of those services without collapsing overlapping
// container instances into the same fencing principal.

import hostBindingAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json" with { type: "json" };

export type McftCap09ProductionRuntimePlaneV1 =
  | "EVIDENCE_RUNTIME"
  | "TWIN_RUNTIME";

type JsonRecordV1 = Record<string, unknown>;

function recordV1(value: unknown, code: string): JsonRecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecordV1;
}

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

export type McftCap09ProductionServiceIdentityBindingV1 = {
  platform_provider: "LOCAL_OPERATOR_MANAGED_DOCKER";
  service_id: string;
  service_name: string;
  runtime_role: McftCap09ProductionRuntimePlaneV1;
};

export function readMcftCap09ProductionServiceIdentityBindingV1(
  plane: McftCap09ProductionRuntimePlaneV1,
): McftCap09ProductionServiceIdentityBindingV1 {
  const root = recordV1(
    hostBindingAuthorityJson,
    "MCFT_CAP09_PRODUCTION_HOST_BINDING_AUTHORITY_INVALID",
  );
  if (
    root.schema_version !== "geox_mcft_cap09_production_non_github_host_binding_authority_v1"
    || root.authority_id !== "GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1"
    || root.status !== "LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND"
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_HOST_BINDING_AUTHORITY_NOT_BOUND");
  }
  const state = recordV1(
    root.binding_state,
    "MCFT_CAP09_PRODUCTION_HOST_BINDING_STATE_INVALID",
  );
  if (
    state.platform_selected !== true
    || state.local_host_id_bound !== true
    || state.evidence_host_identity_bound !== true
    || state.twin_host_identity_bound !== true
    || state.exact_two_runtime_service_identities_bound !== true
    || state.binding_authorized !== true
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_HOST_BINDING_STATE_NOT_READY");
  }

  const contract = recordV1(
    root.host_identity_contract,
    "MCFT_CAP09_PRODUCTION_HOST_IDENTITY_CONTRACT_INVALID",
  );
  const node = recordV1(
    plane === "EVIDENCE_RUNTIME"
      ? contract.evidence_runtime
      : contract.twin_runtime,
    "MCFT_CAP09_PRODUCTION_SERVICE_IDENTITY_NODE_INVALID",
  );
  const identity = recordV1(
    node.service_identity,
    "MCFT_CAP09_PRODUCTION_SERVICE_IDENTITY_INVALID",
  );
  const runtimeRole = textV1(
    identity.runtime_role,
    "MCFT_CAP09_PRODUCTION_SERVICE_RUNTIME_ROLE_REQUIRED",
  );
  if (runtimeRole !== plane) {
    throw new Error("MCFT_CAP09_PRODUCTION_SERVICE_RUNTIME_ROLE_MISMATCH");
  }
  if (identity.platform_provider !== "LOCAL_OPERATOR_MANAGED_DOCKER") {
    throw new Error("MCFT_CAP09_PRODUCTION_SERVICE_PLATFORM_MISMATCH");
  }
  if (identity.execution_class !== "LONG_RUNNING_SERVICE") {
    throw new Error("MCFT_CAP09_PRODUCTION_SERVICE_EXECUTION_CLASS_INVALID");
  }

  return {
    platform_provider: "LOCAL_OPERATOR_MANAGED_DOCKER",
    service_id: textV1(
      identity.service_id,
      "MCFT_CAP09_PRODUCTION_SERVICE_ID_REQUIRED",
    ),
    service_name: textV1(
      identity.service_name,
      "MCFT_CAP09_PRODUCTION_SERVICE_NAME_REQUIRED",
    ),
    runtime_role: plane,
  };
}

export function buildMcftCap09ProductionLeaseOwnerV1(input: {
  plane: McftCap09ProductionRuntimePlaneV1;
  configured_service_id: string;
  instance_id: string;
}): string {
  const binding = readMcftCap09ProductionServiceIdentityBindingV1(input.plane);
  const configuredServiceId = textV1(
    input.configured_service_id,
    "MCFT_CAP09_PRODUCTION_CONFIGURED_SERVICE_ID_REQUIRED",
  );
  if (configuredServiceId !== binding.service_id) {
    throw new Error("MCFT_CAP09_PRODUCTION_CONFIGURED_SERVICE_ID_MISMATCH");
  }
  const instanceId = textV1(
    input.instance_id,
    "MCFT_CAP09_PRODUCTION_RUNTIME_INSTANCE_ID_REQUIRED",
  );
  if (/\s/.test(instanceId) || instanceId.includes("#instance:")) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_INSTANCE_ID_INVALID");
  }
  return `${binding.service_id}#instance:${instanceId}`;
}
