import crypto from "node:crypto";

export type InferenceTaskTypeV1 = "detection" | "classification" | "segmentation";

type InferenceLabelV1 = {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  mask_ref?: string | null;
};

export type InferenceRequestV1 = {
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

export type InferenceResultPayloadV1 = {
  model_name: string;
  model_version: string;
  task_type: InferenceTaskTypeV1;
  labels: InferenceLabelV1[];
  confidence: number;
  health_score: number | null; // 0-100
  pest_detected: boolean;
  disease_detected: boolean;
  inference_ts: string;
  raw_output_summary: Record<string, unknown>;
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
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

function runStubInference(req: InferenceRequestV1): InferenceResultPayloadV1 {
  const seed = `${req.observation_id}|${req.media_key}|${req.model_name}|${req.model_version}|${req.inference_ts_ms}`;
  const base = hashToUnitInterval(seed);
  const label = defaultLabelByObservation(req.observation_type);
  const confidence = Number(clamp(0.55 + base * 0.4, 0, 1).toFixed(4));

  const bbox = req.task_type === "detection"
    ? {
      x: Number((0.05 + (base * 0.2)).toFixed(4)),
      y: Number((0.08 + (base * 0.15)).toFixed(4)),
      w: Number((0.2 + (base * 0.3)).toFixed(4)),
      h: Number((0.2 + (base * 0.25)).toFixed(4)),
    }
    : null;
  const mask_ref = req.task_type === "segmentation" ? `mask://${req.observation_id}/${Math.round(base * 10000)}` : null;

  const pest_detected = label.includes("pest") || base > 0.82;
  const disease_detected = label.includes("disease") || (label === "crop_vigor" && base < 0.23);
  const health_score = Number(clamp(label === "crop_vigor" ? (50 + (1 - base) * 45) : (25 + (1 - confidence) * 50), 0, 100).toFixed(2));

  return {
    model_name: req.model_name,
    model_version: req.model_version,
    task_type: req.task_type,
    labels: [{ label, confidence, bbox, mask_ref }],
    confidence,
    health_score,
    pest_detected,
    disease_detected,
    inference_ts: new Date(req.inference_ts_ms).toISOString(),
    raw_output_summary: {
      provider: "stub",
      engine: "agronomy_inference_stub_v2",
      digest: crypto.createHash("sha1").update(seed).digest("hex"),
      mime: req.mime,
      note_present: Boolean(req.note && req.note.trim()),
      top_label: label,
      top_confidence: confidence,
    },
  };
}

export async function runAgronomyInferenceV1(req: InferenceRequestV1): Promise<InferenceResultPayloadV1> {
  // In future this can route to external model providers (YOLO/ResNet endpoints) without local file dependency.
  // Example switch point:
  // const backend = (process.env.GEOX_AGRONOMY_INFERENCE_BACKEND ?? "stub").toLowerCase();
  // if (backend === "http") { ...call external model service with media_key... }
  return runStubInference(req);
}
