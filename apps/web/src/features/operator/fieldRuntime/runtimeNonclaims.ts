// apps/web/src/features/operator/fieldRuntime/runtimeNonclaims.ts
// Purpose: centralize Field Runtime replay/live nonclaim copy for H60-C and later product surfaces.
// Boundary: these strings are product boundary labels only and do not represent live production connectivity.

export const FIELD_RUNTIME_NONCLAIMS = [
  "Runtime Mode: Replay-backed Demo",
  "Live Device: Not connected",
  "Production Gateway: Not online",
  "Field Pilot: Not started",
  "AO-ACT Dispatch: Disabled",
] as const;

export const FIELD_RUNTIME_READ_ONLY_BOUNDARY = "Read-only Field Runtime";

export const FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY = "Canonical route family: /operator/fields/*";

export const FIELD_RUNTIME_LEGACY_ROUTE_FAMILY = "Legacy route family preserved: /operator/twin/fields/*";
