// Purpose: select the exact forecast used to build T17 formal evidence when base and corrected T16 forecasts coexist immutably.
// Boundary: authority-bound read selection only; no persistence, CAS, projection mutation, qualification seam, route or authority issuance.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type Cap08S4T17ForecastPersistenceContextV1 = {
  expected_latest_base: {
    forecast_result: { ref: string; hash: string };
  };
  corrected_computation_predecessor: {
    forecast_result: { ref: string; hash: string };
  };
};

export type Cap08S4T17ForecastContextResolverPortV1 = {
  resolvePersistenceContext(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    expected_t17_logical_time: string;
  }): Promise<Cap08S4T17ForecastPersistenceContextV1>;
};

export type ResolveCap08S4T17ExactForecastInputV1 = {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  issued_at: string;
  candidates: readonly CanonicalObjectEnvelopeV1[];
};

function addOneHourV1(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("CAP08_S4_T17_FORECAST_ISSUED_AT_INVALID");
  }
  return new Date(parsed + 3_600_000).toISOString();
}

function exactScopeV1(
  object: CanonicalObjectEnvelopeV1,
  scope: TwinScopeKeyV1,
): void {
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (object[field] !== scope[field]) {
      throw new Error(`CAP08_S4_T17_FORECAST_SCOPE_MISMATCH:${field}`);
    }
  }
}

function exactCandidateV1(
  object: CanonicalObjectEnvelopeV1,
  input: ResolveCap08S4T17ExactForecastInputV1,
): void {
  exactScopeV1(object, input.scope);
  if (object.object_type !== "twin_forecast_run_v1"
    || object.payload.status !== "COMPLETED"
    || object.payload.issued_at !== input.issued_at) {
    throw new Error("CAP08_S4_T17_FORECAST_CANDIDATE_INVALID");
  }
}

export class Cap08S4T17AuthorityBoundForecastResolverV1 {
  constructor(
    private readonly contextResolver: Cap08S4T17ForecastContextResolverPortV1,
  ) {}

  async resolveExactForecast(
    input: ResolveCap08S4T17ExactForecastInputV1,
  ): Promise<CanonicalObjectEnvelopeV1> {
    const candidates = input.candidates.map((candidate) => structuredClone(candidate));
    for (const candidate of candidates) exactCandidateV1(candidate, input);
    if (candidates.length === 1) return candidates[0];
    if (candidates.length !== 2) {
      throw new Error(`CAP08_S4_T17_FORECAST_CARDINALITY:${input.issued_at}`);
    }

    const context = await this.contextResolver.resolvePersistenceContext({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      expected_t17_logical_time: addOneHourV1(input.issued_at),
    });
    const base = context.expected_latest_base.forecast_result;
    const corrected = context.corrected_computation_predecessor.forecast_result;
    if (base.ref === corrected.ref || base.hash === corrected.hash) {
      throw new Error("CAP08_S4_T17_FORECAST_BINDINGS_MUST_ADVANCE");
    }
    const baseMatches = candidates.filter((candidate) =>
      candidate.object_id === base.ref && candidate.determinism_hash === base.hash);
    const correctedMatches = candidates.filter((candidate) =>
      candidate.object_id === corrected.ref
      && candidate.determinism_hash === corrected.hash);
    if (baseMatches.length !== 1) {
      throw new Error("CAP08_S4_T17_BASE_FORECAST_BINDING_MISMATCH");
    }
    if (correctedMatches.length !== 1) {
      throw new Error("CAP08_S4_T17_CORRECTED_FORECAST_BINDING_MISMATCH");
    }
    return correctedMatches[0];
  }
}
