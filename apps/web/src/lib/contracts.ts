// GEOX/apps/web/src/lib/contracts.ts
import type { SeriesResponseV1 as ContractSeriesResponseV1 } from "@geox/contracts";

export type SensorGroupSubjectRef = {
  projectId: string;
  plotId?: string;
  blockId?: string;
};

export type SensorGroupV1 = {
  groupId: string;
  subjectRef: SensorGroupSubjectRef;
  displayName: string;
  sensors: string[];
  createdAt: number;
};

export type SeriesQueryV1 = {
  groupId?: string;
  sensorId?: string;
  spatialUnitId?: string;
  metrics?: string;
  metric?: string;
  startTs: number;
  endTs: number;
  maxPoints?: number;
};

export type SeriesSampleV1 = {
  ts: number;
  sensorId: string;
  metric: string;
  value: number;
  quality: "unknown" | "ok" | "suspect" | "bad";
  source: "device" | "gateway" | "system" | "human" | "import" | "sim";
  groupId?: string;
  unit?: string;
};

export type SeriesGapV1 = {
  startTs: number;
  endTs: number;
  reason: "unknown" | "no_data" | "device_offline";
};

export type OverlayKind = string;

export type OverlaySegment = {
  sensorId: string;
  source: "device" | "gateway" | "system" | "human";
  startTs: number;
  endTs: number;
  kind: string;
  metric?: string | null;
  confidence?: "low" | "med" | "high" | null;
  note?: string | null;
};

export type ExplainOverlayV1 = {
  overlay: {
    id: string;
    sensor_id: string;
    metric: string | null;
    start_ts: number;
    end_ts: number;
    kind: string | null;
    severity: string | null;
    params: Record<string, unknown>;
    algo_version: string;
    created_at: string;
  };
  rule_id: string;
  rule_version: string;
  emitted_at: string;
  evidence: {
    sensor_id: string;
    group_id?: string;
    metric: string;
    start_ts: number;
    end_ts: number;
    sample_count: number;
    suspect_count: number;
    bad_count: number;
    gap_count: number;
  };
  notes: string[];
};

export type MetricIdV1 = string;
export type RawSampleV1 = SeriesSampleV1;

export type CanopyFrameV1 = {
  frameId?: string | number;
  ts: number;
  project_id: string;
  plot_id: string | null;
  block_id: string | null;
  camera_id: string;
  cameraId?: string;
  storage_key: string;
  storageKey?: string;
  mime: string;
  note: string | null;
  source: "device" | "gateway" | "system" | "human" | "import" | "sim";
  url: string;
};

export type SeriesResponseV1 =
  | ContractSeriesResponseV1
  | {
      range: { startTs: number; endTs: number; maxPoints?: number };
      samples: SeriesSampleV1[];
      gaps: SeriesGapV1[];
      overlays: OverlaySegment[];
    };

export const MARKER_KIND_ALLOWLIST = ["device_fault", "local_anomaly"] as const;
export type MarkerKind = (typeof MARKER_KIND_ALLOWLIST)[number];
export function isMarkerKind(x: unknown): x is MarkerKind {
  return typeof x === "string" && (MARKER_KIND_ALLOWLIST as readonly string[]).includes(x);
}
