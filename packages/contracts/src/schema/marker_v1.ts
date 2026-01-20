// GEOX/packages/contracts/src/schema/marker_v1.ts

export const MARKER_KIND_ALLOWLIST = ["device_fault", "local_anomaly"] as const;

export type MarkerKind = (typeof MARKER_KIND_ALLOWLIST)[number];

export function isMarkerKind(x: unknown): x is MarkerKind {
  return (
    typeof x === "string" &&
    (MARKER_KIND_ALLOWLIST as readonly string[]).includes(x)
  );
}