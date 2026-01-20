import { z } from "zod";
import { RawSampleV1Schema } from "./raw_sample_v1";
import { GapV1Schema } from "./gaps_v1";
import { OverlaySegmentSchema } from "./overlay_zod";

export const SeriesRangeV1Schema = z.object({
  startTs: z.number().finite(),
  endTs: z.number().finite(),
  maxPoints: z.number().int().positive().optional(),
});

export const SeriesResponseV1Schema = z.object({
  range: SeriesRangeV1Schema,
  samples: z.array(RawSampleV1Schema),
  gaps: z.array(GapV1Schema).default([]),
  overlays: z.array(OverlaySegmentSchema).default([]),
});

export type SeriesRangeV1 = z.infer<typeof SeriesRangeV1Schema>;
export type SeriesResponseV1 = z.infer<typeof SeriesResponseV1Schema>;
