// Purpose: expose corrected T16 as the T17 computation predecessor while preserving base T16 latest projections.
// Boundary: read-only handoff composition only; no persistence, CAS, lease, route, scheduler or authority mutation.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap08S4T17ResolvedPersistenceContextV1 } from "../../persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type Cap08S4T17PersistenceContextResolverPortV1 = {
  resolvePersistenceContext(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    expected_t17_logical_time: string;
  }): Promise<Cap08S4T17ResolvedPersistenceContextV1>;
};

export type Cap08S4T17BaseHandoffPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

function decimalTextV1(value: unknown, code: string): string {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? (value as { value?: unknown }).value
    : value;
  if (typeof raw !== "string" || !raw.trim()) throw new Error(code);
  return raw;
}

function correctedHandoffV1(
  base: PreparedNextTickInputV1,
  state: CanonicalObjectEnvelopeV1,
  context: Cap08S4T17ResolvedPersistenceContextV1,
): PreparedNextTickInputV1 {
  const payload = state.payload as Record<string, unknown>;
  const vwc = payload.root_zone_vwc_fraction as Record<string, unknown>;
  const computation = payload.computation_basis as Record<string, unknown>;
  if (!vwc || typeof vwc !== "object" || !computation || typeof computation !== "object") {
    throw new Error("CAP08_S4_T17_CORRECTED_STATE_COMPUTATION_REQUIRED");
  }
  const corrected = context.corrected_computation_predecessor;
  return {
    ...base,
    previous_posterior_ref: corrected.state.ref,
    previous_posterior_hash: corrected.state.hash,
    previous_checkpoint_ref: corrected.checkpoint.ref,
    previous_checkpoint_hash: corrected.checkpoint.hash,
    previous_forecast_result_ref: corrected.forecast_result.ref,
    previous_forecast_result_hash: corrected.forecast_result.hash,
    latest_successful_forecast_ref: corrected.successful_forecast.ref,
    lineage_id: state.lineage_id ?? base.lineage_id,
    revision_id: state.revision_id ?? base.revision_id,
    prior_mean: Number(vwc.mean),
    prior_variance: Number(vwc.variance),
    previous_storage_mm_decimal: decimalTextV1(
      computation.storage_mean_mm_decimal,
      "CAP08_S4_T17_CORRECTED_STORAGE_REQUIRED",
    ),
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: corrected.state.ref,
      previous_storage_variance_mm2_decimal: decimalTextV1(
        computation.storage_variance_mm2_decimal,
        "CAP08_S4_T17_CORRECTED_STORAGE_VARIANCE_REQUIRED",
      ),
    },
    previous_tick_sequence: corrected.previous_tick_sequence,
    previous_state_runtime_config_ref: String(state.runtime_config_ref),
    previous_state_runtime_config_hash: String(state.runtime_config_hash),
  };
}

export class Cap08S4T17CorrectedHandoffServiceV1 {
  constructor(
    private readonly formalRunId: string,
    private readonly t17LogicalTime: string,
    private readonly base: Cap08S4T17BaseHandoffPortV1,
    private readonly resolver: Cap08S4T17PersistenceContextResolverPortV1,
  ) {}

  async prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1> {
    const base = await this.base.prepareNextTickInput(scope);
    if (base.next_logical_tick_time !== this.t17LogicalTime) return base;
    const context = await this.resolver.resolvePersistenceContext({
      formal_run_id: this.formalRunId,
      scope,
      expected_t17_logical_time: this.t17LogicalTime,
    });
    return correctedHandoffV1(base, context.corrected_state, context);
  }
}
