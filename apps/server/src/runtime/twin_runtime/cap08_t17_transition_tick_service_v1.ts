// Purpose: execute exactly the frozen MCFT-CAP-08 S4/T17 A1 transition through the dedicated persistence bridge.
// Boundary: explicit T17 application service and routing only; ordinary CAP-04 ticks remain delegated unchanged.

import { cap08TickLogicalTimeV1 } from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type { Cap08S4T17FormalA1ProofV1, Cap08S4T17TransitionWitnessV1 } from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import type { PostgresCap08S4T17TransitionRepositoryV1 } from "../../persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.js";
import type {
  Cap08S4T17ActiveTransitionContextV1,
  Cap08S4T17TransitionPersistenceAdapterV1,
} from "./cap08_t17_transition_persistence_adapter_v1.js";
import { buildCap08S4T17FormalA1ProofV1 } from "./cap08_t17_formal_a1_preflight_v1.js";
import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import type {
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type Cap08S4T17TickDelegatePortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1>;
};

export type ExecuteCap08S4T17TransitionTickInputV1 = ExecuteCap04SingleTickInputV1 & {
  formal_run_id: string;
  transition_context: Cap08S4T17ActiveTransitionContextV1;
};

export type ExecuteCap08S4T17TransitionTickResultV1 = ExecuteCap04SingleTickResultV1 & {
  formal_a1_proof: Cap08S4T17FormalA1ProofV1;
  transition_status: "INSERTED_ATOMIC_TRANSITION" | "EXISTING_IDEMPOTENT_SUCCESS";
  transition_write_delta: number;
  transition_witness: Cap08S4T17TransitionWitnessV1;
};

export class Cap08S4T17TransitionTickServiceV1 {
  constructor(
    private readonly delegate: Cap08S4T17TickDelegatePortV1,
    private readonly adapter: Cap08S4T17TransitionPersistenceAdapterV1,
    private readonly evidence: ReplayEvidenceSourcePortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly transitionRepository: PostgresCap08S4T17TransitionRepositoryV1,
  ) {}

  async executeOneTick(
    input: ExecuteCap08S4T17TransitionTickInputV1,
  ): Promise<ExecuteCap08S4T17TransitionTickResultV1> {
    const t17 = cap08TickLogicalTimeV1(17);
    const context = input.transition_context;
    if (input.logical_time !== t17
      || context.t17_logical_time !== t17
      || input.formal_run_id !== context.formal_run_id) {
      throw new Error("CAP08_S4_T17_EXPLICIT_ROUTE_REQUIRED");
    }

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(input.runtime_config_ref);
    if (!runtimeConfig || runtimeConfig.determinism_hash !== input.runtime_config_hash) {
      throw new Error("CAP08_S4_T17_RUNTIME_CONFIG_BINDING_MISMATCH");
    }
    const candidateRecords = await this.evidence.loadCandidateRecords({
      scope: input.scope,
      logical_time: input.logical_time,
    });
    const proof = buildCap08S4T17FormalA1ProofV1({
      scope: input.scope,
      logical_time: input.logical_time,
      candidate_records: candidateRecords,
      authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
      runtime_config: runtimeConfig,
      crop_stage_context: input.crop_stage_context,
    });

    this.adapter.activate(context);
    try {
      const result = await this.delegate.executeOneTick(input);
      if (result.status === "BLOCKED_INSERTED"
        || result.status === "EXISTING_BLOCKED_IDEMPOTENT_SUCCESS"
        || result.b_record === null) {
        throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
      }
      const transition = this.adapter.consumeLastTransitionResult(result.a_record_set.record_set_id);
      const witness = transition.transition_witness;
      await this.transitionRepository.assertExactTransition({
        scope: input.scope,
        lease: {
          ...input.scope,
          lease_owner: input.lease_owner,
          lease_duration_seconds: input.lease_duration_seconds,
          fencing_token: 0n,
        },
        formal_run_id: input.formal_run_id,
        expected_latest_base: context.expected_latest_base,
        corrected_computation_predecessor: context.corrected_computation_predecessor,
        correction_authority: context.correction_authority,
        record_set: result.a_record_set,
        transition_witness: witness,
      });
      return {
        ...result,
        formal_a1_proof: proof,
        transition_status: transition.status,
        transition_write_delta: transition.write_delta,
        transition_witness: transition.transition_witness,
      };
    } finally {
      this.adapter.deactivate();
    }
  }
}

export type Cap08S4T17TransitionContextResolverV1 = {
  resolve(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    t17_logical_time: string;
  }): Promise<Cap08S4T17ActiveTransitionContextV1>;
};

export class Cap08S4T17ExplicitRoutingTickServiceV1 {
  constructor(
    private readonly ordinary: Cap08S4T17TickDelegatePortV1,
    private readonly t17: Cap08S4T17TransitionTickServiceV1,
    private readonly contextResolver: Cap08S4T17TransitionContextResolverV1,
  ) {}

  async executeOneTick(
    input: ExecuteCap04SingleTickInputV1 & { formal_run_id: string },
  ): Promise<ExecuteCap04SingleTickResultV1> {
    const t17 = cap08TickLogicalTimeV1(17);
    if (input.logical_time !== t17) return this.ordinary.executeOneTick(input);
    const context = await this.contextResolver.resolve({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      t17_logical_time: t17,
    });
    return this.t17.executeOneTick({
      ...input,
      transition_context: context,
    });
  }
}
