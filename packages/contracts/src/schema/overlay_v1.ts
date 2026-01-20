import { z } from "zod";
import { isMarkerKind, type MarkerKind } from "./marker_v1";
import { isCandidateKind, type CandidateKind } from "./candidate_overlay_v1";

export type OverlayKind = MarkerKind | CandidateKind;

export function isOverlayKind(x: unknown): x is OverlayKind {
  return isMarkerKind(x) || isCandidateKind(x);
}

export type OverlaySegment = {
  startTs: number; // unix ms
  endTs: number; // unix ms (can equal startTs)
  sensorId: string;
  metric?: string | null; // marker can be null/undefined; derived should set
  kind: OverlayKind;
  confidence?: "low" | "med" | "high" | null; // marker can be null/undefined; derived should set
  note?: string | null; // neutral description only
  source: "device" | "gateway" | "system";
};

// ✅ VALUE schema (so other files can use it as a value)
export const OverlaySegmentV1 = z
  .object({
    startTs: z.number(),
    endTs: z.number(),
    sensorId: z.string(),
    metric: z.string().nullable().optional(),
    kind: z.string().refine((v: string) => isOverlayKind(v), { message: "invalid overlay kind" }),
    confidence: z.enum(["low", "med", "high"]).nullable().optional(),
    note: z.string().nullable().optional(),
    source: z.enum(["device", "gateway", "system"]),
  })
  .strict();

// ✅ TYPE alias (so other files can use it as a type too)
export type OverlaySegmentV1 = OverlaySegment;