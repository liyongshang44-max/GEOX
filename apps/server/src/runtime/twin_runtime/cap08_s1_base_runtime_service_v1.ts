// apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts
// Purpose: establish the MCFT-CAP-08 B00 bootstrap root, execute T00-T23, and use persisted completion authority for exact zero-write replay.
// Boundary: one explicit Replay invocation only; no final formal closure classification, restart fault injection, late correction, Decision, Action Feedback, Residual, Calibration, route, scheduler, or live ingestion.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../domain/twin_runtime/physical_bounds_v1.js";
import { CAP08_S1_RUNTIME_START_V1 } from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  type ExecuteA0BootstrapInputV1,
  type ExecuteA0BootstrapResultV1,
} from "./a0_bootstrap_runtime_service_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";
import {
  Cap08S1BaseRangeServiceV1,
  type RunCap08S1BaseRangeInputV1,
  type RunCap08S1BaseRangeResultV1,
} from "./cap08_s1_base_range_service_v1.js";

export type ExecuteCap08S1BaseRuntimeInputV1 = Omit<RunCap08S1BaseRangeInputV1, "scope"> & {
  scope: TwinScopeKeyV1;
  bootstrap_runtime_config: CanonicalObjectEnvelopeV1;
  bootstrap_hydraulic: SoilHydraulicBoundsV1;
  soil_hydraulic_config_ref: string;
};

export type ExecuteCap08S1BaseRuntimeResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  bootstrap_id: "B00";
  bootstrap_counted_as_successful_tick: false;
  bootstrap_logical_time: string;
  bootstrap: ExecuteA0BootstrapResultV1;
  range: RunCap08S1BaseRangeResultV1;
  slice_acceptance_only: true;
  final_formal_run_id: null;
  production_runtime_source_authorized: false;
};

export class Cap08S1BaseRuntimeServiceV1 {
  constructor(
    private readonly bootstrapService: A0BootstrapRuntimeServiceV1,
    private readonly rangeService: Cap08S1BaseRangeServiceV1,
  ) {}

  private bootstrapInputV1(
    input: ExecuteCap08S1BaseRuntimeInputV1,
    bootstrapLogicalTime: string,
  ): ExecuteA0BootstrapInputV1 {
    return {
      scope: input.scope,
      logical_time: bootstrapLogicalTime,
      created_at: input.created_at,
      runtime_config: input.bootstrap_runtime_config,
      hydraulic: input.bootstrap_hydraulic,
      soil_hydraulic_config_ref: input.soil_hydraulic_config_ref,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    };
  }

  async execute(input: ExecuteCap08S1BaseRuntimeInputV1): Promise<ExecuteCap08S1BaseRuntimeResultV1> {
    const bootstrapLogicalTime = new Date(Date.parse(CAP08_S1_RUNTIME_START_V1) - 3_600_000).toISOString();
    if (input.bootstrap_runtime_config.logical_time !== bootstrapLogicalTime) {
      throw new Error("CAP08_B00_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH");
    }

    const rangeInput: RunCap08S1BaseRangeInputV1 = {
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      created_at: input.created_at,
      runtime_config_refs_by_logical_time: input.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: input.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
      crop_stage_context: input.crop_stage_context,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    };

    const completion = await this.rangeService.inspectCompletion(rangeInput);
    const bootstrap = completion.disposition === "ALREADY_COMPLETE_EXACT"
      ? await this.bootstrapService.readExisting(this.bootstrapInputV1(input, bootstrapLogicalTime))
      : await this.bootstrapService.execute(this.bootstrapInputV1(input, bootstrapLogicalTime));
    if (bootstrap.next_tick_logical_time !== CAP08_S1_RUNTIME_START_V1) {
      throw new Error("CAP08_B00_HANDOFF_TO_T00_REQUIRED");
    }

    const range = await this.rangeService.runRange(rangeInput);
    return {
      status: range.status,
      bootstrap_id: "B00",
      bootstrap_counted_as_successful_tick: false,
      bootstrap_logical_time: bootstrapLogicalTime,
      bootstrap,
      range,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      production_runtime_source_authorized: false,
    };
  }
}
