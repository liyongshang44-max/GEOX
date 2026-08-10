// Purpose: persist the already-qualified Amendment-06/A06A rebased 24-config chain through the
// existing Runtime Config repository with strict prefix-only crash recovery and immediate idempotent re-verification.
// Boundary: Runtime Config persistence only; no Evidence/provider/raw-object/scheduler/A0/State/lineage/checkpoint/
// forecast/recommendation/action/model-activation write and no Formal-slot execution.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

export type ExternalFormalWindowEpochRebasePersistenceInputV1 = {
  runtime_configs: readonly CanonicalObjectEnvelopeV1[];
};

export type ExternalFormalWindowEpochRebasePersistenceResultV1 = {
  execution_mode: "FIRST_APPEND_ONLY_REBASE_PERSISTENCE" | "CRASH_SAFE_PREFIX_RECOVERY" | "EXISTING_REBASE_REVERIFIED";
  preexisting_prefix_count: number;
  first_pass_runtime_config_write_count: number;
  second_pass_runtime_config_write_count: 0;
  final_runtime_config_count: 24;
  runtime_config_refs: readonly string[];
  runtime_config_hashes: readonly string[];
  evidence_write_count: 0;
  a0_member_write_count: 0;
  scheduler_slot_write_count: 0;
  scheduler_cursor_write_count: 0;
  provider_request_count: 0;
  raw_object_write_count: 0;
  formal_window_started: false;
};

export class ExternalFormalWindowEpochRebasePersistenceServiceV1 {
  public constructor(private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1) {}

  public async execute(
    input: ExternalFormalWindowEpochRebasePersistenceInputV1,
  ): Promise<ExternalFormalWindowEpochRebasePersistenceResultV1> {
    if (input.runtime_configs.length !== 24) throw new Error("A06C_EXACT_24_RUNTIME_CONFIGS_REQUIRED");

    let prefix = 0;
    let missingSeen = false;
    for (let index = 0; index < input.runtime_configs.length; index += 1) {
      const expected = input.runtime_configs[index]!;
      const existing = await this.runtimeConfigRepository.readRuntimeConfig(expected.object_id);
      if (!existing) {
        missingSeen = true;
        continue;
      }
      if (missingSeen) throw new Error("A06C_CRASH_RECOVERY_MUST_BE_CONTIGUOUS_PREFIX");
      if (existing.determinism_hash !== expected.determinism_hash
        || existing.logical_time !== expected.logical_time
        || JSON.stringify(existing.payload) !== JSON.stringify(expected.payload)) {
        throw new Error(`A06C_EXISTING_REBASED_CONFIG_MISMATCH:${index}`);
      }
      prefix += 1;
    }

    const executionMode = prefix === 0
      ? "FIRST_APPEND_ONLY_REBASE_PERSISTENCE"
      : prefix === 24
        ? "EXISTING_REBASE_REVERIFIED"
        : "CRASH_SAFE_PREFIX_RECOVERY";

    const firstStatuses: ("INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS")[] = [];
    for (const config of input.runtime_configs) {
      const committed = await this.runtimeConfigRepository.commitRuntimeConfig(config);
      firstStatuses.push(committed.status);
    }
    const firstPassWriteCount = firstStatuses.filter((status) => status === "INSERTED").length;
    if (firstPassWriteCount !== 24 - prefix) throw new Error("A06C_FIRST_PASS_WRITE_COUNT_MISMATCH");

    for (const config of input.runtime_configs) {
      const committed = await this.runtimeConfigRepository.commitRuntimeConfig(config);
      if (committed.status !== "EXISTING_IDEMPOTENT_SUCCESS") {
        throw new Error("A06C_SECOND_PASS_MUST_BE_ZERO_WRITE_IDEMPOTENT");
      }
    }

    return {
      execution_mode: executionMode,
      preexisting_prefix_count: prefix,
      first_pass_runtime_config_write_count: firstPassWriteCount,
      second_pass_runtime_config_write_count: 0,
      final_runtime_config_count: 24,
      runtime_config_refs: input.runtime_configs.map((config) => config.object_id),
      runtime_config_hashes: input.runtime_configs.map((config) => config.determinism_hash),
      evidence_write_count: 0,
      a0_member_write_count: 0,
      scheduler_slot_write_count: 0,
      scheduler_cursor_write_count: 0,
      provider_request_count: 0,
      raw_object_write_count: 0,
      formal_window_started: false,
    };
  }
}
