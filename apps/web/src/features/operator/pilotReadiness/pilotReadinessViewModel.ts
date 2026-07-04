// apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts
// Purpose: build the H63 Pilot Readiness product ViewModel from frozen P53/P54 metadata.
// Boundary: local metadata only.

export type PilotReadinessProductViewModel = {
  source: "field_pilot_readiness_product_v1";
  mode: "controlled_pilot_readiness_review";
  route: "/operator/pilot";
};

export function buildPilotReadinessViewModel(): PilotReadinessProductViewModel {
  return {
    source: "field_pilot_readiness_product_v1",
    mode: "controlled_pilot_readiness_review",
    route: "/operator/pilot",
  };
}
