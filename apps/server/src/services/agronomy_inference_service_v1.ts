import crypto from "node:crypto";

export type InferenceTaskTypeV1 = "detection" | "classification" | "segmentation";

export type InferenceInputV1 = {
  observation_id: string;
  media_key: string;
  observation_type: string;
  mime: string;
  note: string | null;
  model_name: string;
  model_version: string;
  task_type: InferenceTaskTypeV1;
  inference_ts_ms: number;
};

export type InferenceLabelV1 = {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  mask_ref?: string | null;
};

export type InferenceOutputV1 = {
  labels: InferenceLabelV1[];
  confidence: number;
  health_score: number | null;
  pest_detected: boolean;
  disease_detected: boolean;
  raw_output_summary: Record<string, unknown>;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Number(v.toFixed(4));
}

function hashToUnitInterval(seed: string): number {
  const h = crypto.createHash("sha256").update(seed, "utf8").digest("hex");
  const n = parseInt(h.slice(0, 12), 16);
  return n / 0xffffffffffff;
}

function defaultLabelByObservation(observationType: string): string {
  const v = String(observationType || "").toUpperCase();
  if (v === "DISEASE_SPOT") return "disease_spot";
  if (v === "PEST") return "pest";
  if (v === "LODGING") return "lodging";
  if (v === "MISSING_SEEDLINGS") return "missing_seedlings";
  if (v === "CROP_VIGOR") return "crop_vigor";
  return "agronomy_signal";
}

export function runAgronomyInferenceV1(input: InferenceInputV1): InferenceOutputV1 {
  const seed = `${input.observation_id}|${input.media_key}|${input.model_name}|${input.model_version}|${input.inference_ts_ms}`;
  const base = hashToUnitInterval(seed);
  const confidence = clamp01(0.55 + base * 0.4);
  const label = defaultLabelByObservation(input.observation_type);
  const pest_detected = label.includes("pest") || base > 0.82;
  const disease_detected = label.includes("disease") || (label === "crop_vigor" && base < 0.23);

  const bbox = input.task_type === "detection"
    ? {
      x: Number((0.05 + (base * 0.2)).toFixed(4)),
      y: Number((0.08 + (base * 0.15)).toFixed(4)),
      w: Number((0.2 + (base * 0.3)).toFixed(4)),
      h: Number((0.2 + (base * 0.25)).toFixed(4)),
    }
    : null;

  const mask_ref = input.task_type === "segmentation" ? `mask://${input.observation_id}/${Math.round(base * 10000)}` : null;

  const health_score = label === "crop_vigor"
    ? clamp01(0.5 + (1 - base) * 0.45)
    : clamp01(0.25 + (1 - confidence) * 0.5);

  return {
    labels: [{ label, confidence, bbox, mask_ref }],
    confidence,
    health_score,
    pest_detected,
    disease_detected,
    raw_output_summary: {
      engine: "agronomy_inference_stub_v1",
      digest: crypto.createHash("sha1").update(seed).digest("hex"),
      mime: input.mime,
      note_present: Boolean(input.note && input.note.trim()),
      task_type: input.task_type,
      top_label: label,
      top_confidence: confidence,
    },
  };
}
