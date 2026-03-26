import { z } from "zod";

export const AgronomySignalSnapshotV1Schema = z.object({
  tenant_id: z.string().min(1),
  field_id: z.string().min(1),
  season_id: z.string().min(1).nullable(),
  device_id: z.string().min(1),
  observed_ts_ms: z.number().int().nullable(),
  soil_moisture_pct: z.number().finite().nullable(),
  canopy_temp_c: z.number().finite().nullable(),
  battery_percent: z.number().int().min(0).max(100).nullable(),
  updated_ts_ms: z.number().int()
});

export type AgronomySignalSnapshotV1 = z.infer<typeof AgronomySignalSnapshotV1Schema>;
