// GEOX/apps/web/src/lib/contracts.ts
// Frontend types are sourced from @geox/contracts (shared with server).
export type {
  SensorGroupV1,
  SensorGroupSubjectRef,
  SeriesQueryV1,
  SeriesResponseV1,
  SeriesSampleV1,
  SeriesGapV1,
  OverlaySegment,
  OverlayKind,
  MarkerKind,
  CandidateKind,
} from "@geox/contracts";

export {
  MARKER_KIND_ALLOWLIST,
  CANDIDATE_KIND_ALLOWLIST,
  isMarkerKind,
  isCandidateKind,
} from "@geox/contracts";
