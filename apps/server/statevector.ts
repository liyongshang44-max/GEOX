/**
 * P3 StateVector (Apple I)
 * Pure state expression layer.
 * No recommendation, no causality, no actions.
 */

export type Direction = "rising" | "falling" | "flat" | "unknown";
export type MagnitudeBand = "slight" | "moderate" | "strong" | "unknown";
export type Stability = "stable" | "noisy" | "broken";
export type Confidence = "low" | "medium" | "high";

export interface EvidenceRef {
  sample_count: number;
  time_span_sec: number;
  gap_present: boolean;
  anomaly_flag: boolean;
}

export interface StateVector {
  sensor_group_id: string;
  metric: string;
  depth?: string;
  window_sec: number;

  direction: Direction;
  magnitude_band: MagnitudeBand;
  stability: Stability;
  confidence: Confidence;

  evidence_ref: EvidenceRef;
}
