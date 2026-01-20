import type { JudgeConfigV1 } from "../config";
import type { Marker } from "../evidence";

export type MarkerResult =
  | { ok: true }
  | { ok: false; flag: "EXCLUSION_WINDOW_ACTIVE" | "MARKER_PRESENT"; markerFacts: string[]; markerKinds: string[] };

export function checkMarkers(cfg: JudgeConfigV1, markers: Marker[]): MarkerResult {
  if (!markers.length) return { ok: true };
  const markerFacts = Array.from(new Set(markers.map((m) => m.fact_id))).sort();
  const markerKinds = Array.from(new Set(markers.map((m) => m.kind))).sort();

  const exclusion = new Set(cfg.marker.exclusion_kinds || []);
  const hasExcl = markers.some((m) => exclusion.has(m.kind));
  if (hasExcl) {
    return { ok: false, flag: "EXCLUSION_WINDOW_ACTIVE", markerFacts, markerKinds };
  }

  return { ok: false, flag: "MARKER_PRESENT", markerFacts, markerKinds };
}
