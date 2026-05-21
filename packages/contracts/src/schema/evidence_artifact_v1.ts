import { z } from "zod";

export const EvidenceArtifactSourceLaneV1Schema = z.enum([
  "FORMAL_OPERATION",
  "SIMULATED_DEV_ONLY",
  "DEBUG_ONLY",
  "MANUAL_IMPORT",
  "UNKNOWN",
]);
export type EvidenceArtifactSourceLaneV1 = z.infer<typeof EvidenceArtifactSourceLaneV1Schema>;

export const EvidenceArtifactLevelV1Schema = z.enum(["DEBUG", "FORMAL", "STRONG"]);
export type EvidenceArtifactLevelV1 = z.infer<typeof EvidenceArtifactLevelV1Schema>;

export const EvidenceArtifactKindV1Schema = z.enum([
  "image",
  "note",
  "metric",
  "trajectory",
  "water_delivery_receipt",
  "media",
  "log",
  "artifact",
]);
export type EvidenceArtifactKnownKindV1 = z.infer<typeof EvidenceArtifactKindV1Schema>;
export type EvidenceArtifactKindV1 = EvidenceArtifactKnownKindV1 | string;

export const EvidenceArtifactV1PayloadSchema = z.object({
  artifact_id: z.string().min(1),
  act_task_id: z.string().min(1).optional(),
  operation_id: z.string().min(1).optional(),
  operation_plan_id: z.string().min(1).optional(),
  receipt_id: z.string().min(1).optional(),
  receipt_fact_id: z.string().min(1).optional(),
  evidence_id: z.string().min(1).optional(),
  field_id: z.string().min(1).optional(),
  kind: z.union([EvidenceArtifactKindV1Schema, z.string().min(1)]),
  url: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  artifact_ref: z.string().min(1).optional(),
  sha256: z.string().min(1).optional(),
  summary: z.record(z.string(), z.unknown()).optional(),
  source: z.string().min(1).optional(),

  /** Base-contract trust lane. Dev/flight-table evidence must remain SIMULATED_DEV_ONLY. */
  source_lane: EvidenceArtifactSourceLaneV1Schema.optional(),
  is_simulated: z.boolean().optional(),
  formal_eligible: z.boolean().optional(),
  evidence_level: EvidenceArtifactLevelV1Schema.optional(),
  level: EvidenceArtifactLevelV1Schema.optional(),
  run_id: z.string().min(1).optional(),
  dev_source: z.string().min(1).optional(),

  created_at: z.string().min(1),
  created_by: z.string().min(1).optional(),
  execution_time: z.object({
    start_ts: z.number().finite().nullable().optional(),
    end_ts: z.number().finite().nullable().optional(),
  }).optional(),
  location: z.record(z.string(), z.unknown()).nullable().optional(),
  tenant_id: z.string().min(1).optional(),
  project_id: z.string().min(1).optional(),
  group_id: z.string().min(1).optional(),
});
export type EvidenceArtifactV1Payload = z.infer<typeof EvidenceArtifactV1PayloadSchema>;

export const EvidenceArtifactV1Schema = z.object({
  type: z.literal("evidence_artifact_v1"),
  payload: EvidenceArtifactV1PayloadSchema,
});

export type EvidenceArtifactV1 = z.infer<typeof EvidenceArtifactV1Schema>;

export function assertFlightTableEvidenceArtifactNotFormalV1(payload: EvidenceArtifactV1Payload): void {
  const source = String(payload.source ?? "").toUpperCase();
  const devSource = String(payload.dev_source ?? "").toUpperCase();
  const artifactRef = String(payload.artifact_ref ?? "").toUpperCase();
  const isFlightTable = source.startsWith("FLIGHT_TABLE_") || devSource.startsWith("FLIGHT_TABLE") || artifactRef.includes("FLIGHT-TABLE") || artifactRef.includes("FLIGHT_TABLE");
  if (!isFlightTable) return;
  if (payload.formal_eligible === true || payload.source_lane === "FORMAL_OPERATION" || payload.evidence_level === "FORMAL" || payload.evidence_level === "STRONG") {
    throw new Error("FLIGHT_TABLE_EVIDENCE_MUST_NOT_BE_FORMAL");
  }
}
