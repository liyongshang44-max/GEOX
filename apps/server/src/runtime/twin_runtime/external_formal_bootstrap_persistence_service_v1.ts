// Purpose: persist one honest External Formal bootstrap package using already-qualified canonical builders
// and existing Runtime persistence ports: Reality Binding snapshot, A0 Runtime Config, nine-member A0 graph,
// then the exact 24 parent-linked hourly Runtime Config pins.
// Boundary: no provider fetch, scheduler slot claim, CAP04 tick execution, recommendation, action,
// model activation, Formal-window start, or implicit wall clock.

import {
  MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
} from "../../domain/twin_runtime/runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type {
  ExternalFormalBootstrapAuthorityBundleV1,
} from "../../domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import type { BootstrapWaterModelConfigV1 } from "../../domain/soil_water/root_zone_water_posterior_v1.js";
import {
  buildExternalFormalA0RecordSetV1,
} from "./external_formal_a0_record_set_builder_v1.js";
import {
  ExternalFormalA0EvidenceWindowServiceV1,
} from "./external_formal_a0_evidence_window_service_v1.js";
import type {
  BootstrapPersistencePortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeAuthoritySnapshotRepositoryPortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type ExternalFormalBootstrapPersistencePortsV1 = {
  runtime_config_repository: RuntimeConfigRepositoryPortV1;
  bootstrap_persistence: BootstrapPersistencePortV1;
  authority_snapshot_repository: RuntimeAuthoritySnapshotRepositoryPortV1;
  evidence_source: ReplayEvidenceSourcePortV1;
};

export type ExecuteExternalFormalBootstrapPersistenceInputV1 = {
  bundle: ExternalFormalBootstrapAuthorityBundleV1;
  created_at: string;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type ExternalFormalBootstrapPersistenceResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  scope: TwinScopeKeyV1;
  bootstrap_logical_time: string;
  window_start_utc: string;
  reality_binding_ref: string;
  reality_binding_hash: string;
  bootstrap_runtime_config_ref: string;
  bootstrap_runtime_config_hash: string;
  a0_record_set_ref: string;
  a0_record_set_hash: string;
  a0_member_count: 9;
  hourly_runtime_config_refs: readonly string[];
  hourly_runtime_config_hashes: readonly string[];
  hourly_runtime_config_count: 24;
  runtime_config_write_count: number;
  a0_member_write_count: number;
  provider_request_count: 0;
  scheduler_slot_write_count: 0;
  formal_window_started: false;
};

function exactExternalScopeV1(scope: TwinScopeKeyV1): void {
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    if (scope[key as keyof TwinScopeKeyV1] !== expected) {
      throw new Error(`EXTERNAL_FORMAL_BOOTSTRAP_PERSISTENCE_SCOPE_MISMATCH:${key}`);
    }
  }
}

function validateConfigChainV1(bundle: ExternalFormalBootstrapAuthorityBundleV1): void {
  if (bundle.runtime_configs.length !== 24) throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_EXACT_24_CONFIGS_REQUIRED");
  validateExternalFormalRuntimeConfigPayloadV1(bundle.bootstrap_runtime_config.payload);
  if (bundle.bootstrap_runtime_config.payload.config_role !== "A0_BOOTSTRAP") {
    throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_A0_CONFIG_REQUIRED");
  }
  let parent = bundle.bootstrap_runtime_config;
  for (let index = 0; index < bundle.runtime_configs.length; index += 1) {
    const config = bundle.runtime_configs[index];
    validateExternalFormalRuntimeConfigPayloadV1(config.payload);
    if (config.payload.config_role !== "HOURLY_CAP04") throw new Error(`EXTERNAL_FORMAL_BOOTSTRAP_HOURLY_CONFIG_REQUIRED:${index}`);
    if (config.payload.parent_runtime_config_ref !== parent.object_id
      || config.payload.parent_runtime_config_hash !== parent.determinism_hash) {
      throw new Error(`EXTERNAL_FORMAL_BOOTSTRAP_PARENT_CHAIN_MISMATCH:${index}`);
    }
    const expectedTime = new Date(Date.parse(bundle.bootstrap_logical_time) + (index + 1) * 3_600_000).toISOString();
    if (config.logical_time !== expectedTime || config.payload.effective_logical_time !== expectedTime) {
      throw new Error(`EXTERNAL_FORMAL_BOOTSTRAP_CONFIG_TIME_MISMATCH:${index}`);
    }
    parent = config;
  }
}

export class ExternalFormalBootstrapPersistenceServiceV1 {
  public constructor(private readonly ports: ExternalFormalBootstrapPersistencePortsV1) {}

  public async execute(
    input: ExecuteExternalFormalBootstrapPersistenceInputV1,
  ): Promise<ExternalFormalBootstrapPersistenceResultV1> {
    exactExternalScopeV1(input.bundle.scope as TwinScopeKeyV1);
    validateConfigChainV1(input.bundle);
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_LEASE_DURATION_INVALID");
    }
    if (!input.lease_owner.trim()) throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_LEASE_OWNER_REQUIRED");

    const reality = await this.ports.authority_snapshot_repository.commitRealityBindingSnapshot(
      input.bundle.reality_binding_snapshot,
    );
    const bootstrapConfig = await this.ports.runtime_config_repository.commitRuntimeConfig(
      input.bundle.bootstrap_runtime_config,
    );

    const evidence = await new ExternalFormalA0EvidenceWindowServiceV1(this.ports.evidence_source).prepare({
      scope: input.bundle.scope as TwinScopeKeyV1,
      logical_time: input.bundle.bootstrap_logical_time,
    });
    const recordSet = buildExternalFormalA0RecordSetV1({
      scope: input.bundle.scope as TwinScopeKeyV1,
      logical_time: input.bundle.bootstrap_logical_time,
      created_at: input.created_at,
      runtime_config: input.bundle.bootstrap_runtime_config,
      evidence_window: evidence.evidence_window,
      hydraulic: input.bundle.hydraulic,
      soil_hydraulic_model_prior_ref: input.bundle.model_prior_ref,
      compatibility_bootstrap_model_config: structuredClone(
        MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
      ) as unknown as BootstrapWaterModelConfigV1,
    });

    const lease = await this.ports.bootstrap_persistence.acquireLease({
      ...input.bundle.scope,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const bootstrap = await this.ports.bootstrap_persistence.commitBootstrapState({
      scope: input.bundle.scope as TwinScopeKeyV1,
      lease,
      expected: {
        active_lineage_ref: null,
        checkpoint_ref: null,
        state_ref: null,
        forecast_result_ref: null,
        successful_forecast_ref: null,
      },
      record_set: recordSet,
    });

    const hourlyStatuses: ("INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS")[] = [];
    for (const config of input.bundle.runtime_configs) {
      const committed = await this.ports.runtime_config_repository.commitRuntimeConfig(config);
      hourlyStatuses.push(committed.status);
    }

    const allStatuses = [reality.status, bootstrapConfig.status, bootstrap.status, ...hourlyStatuses];
    const status = allStatuses.every((value) => value === "EXISTING_IDEMPOTENT_SUCCESS")
      ? "EXISTING_IDEMPOTENT_SUCCESS"
      : "INSERTED";

    return {
      status,
      scope: { ...input.bundle.scope },
      bootstrap_logical_time: input.bundle.bootstrap_logical_time,
      window_start_utc: input.bundle.window_start_utc,
      reality_binding_ref: input.bundle.reality_binding_snapshot.binding_id,
      reality_binding_hash: input.bundle.reality_binding_snapshot.determinism_hash,
      bootstrap_runtime_config_ref: input.bundle.bootstrap_runtime_config.object_id,
      bootstrap_runtime_config_hash: input.bundle.bootstrap_runtime_config.determinism_hash,
      a0_record_set_ref: bootstrap.record_set.a0_record_set_id,
      a0_record_set_hash: bootstrap.record_set.a0_record_set_determinism_hash,
      a0_member_count: 9,
      hourly_runtime_config_refs: input.bundle.runtime_configs.map((config) => config.object_id),
      hourly_runtime_config_hashes: input.bundle.runtime_configs.map((config) => config.determinism_hash),
      hourly_runtime_config_count: 24,
      runtime_config_write_count: (bootstrapConfig.status === "INSERTED" ? 1 : 0)
        + hourlyStatuses.filter((value) => value === "INSERTED").length,
      a0_member_write_count: bootstrap.status === "INSERTED" ? 9 : 0,
      provider_request_count: 0,
      scheduler_slot_write_count: 0,
      formal_window_started: false,
    };
  }
}
