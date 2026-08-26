import { classifyPhysicalMeasurementV1, type PhysicalQcResultV1 } from "./physical_qc_v1.js";

/**
 * B-04b bounded ingress annotation.
 *
 * This is a provenance-preserving snapshot of source measurement + B-04a
 * physical QC. It is not the full EvidenceQualificationV1 authority object:
 * temporal/source/spatial/conflict qualification remains separate work.
 */
export type IngressPhysicalQcSnapshotV1 = {
  schema_version: "ingress_physical_qc_snapshot_v1";
  source_fact_id: string;
  source_metric: string;
  source_value: number | string | boolean | null;
  source_unit: string | null;
  physical_qc: PhysicalQcResultV1;
};

export function buildIngressPhysicalQcSnapshotV1(input: {
  source_fact_id: string;
  metric: string;
  value: number | string | boolean | null;
  unit: string | null;
}): IngressPhysicalQcSnapshotV1 {
  return {
    schema_version: "ingress_physical_qc_snapshot_v1",
    source_fact_id: String(input.source_fact_id ?? "").trim(),
    source_metric: String(input.metric ?? "").trim(),
    source_value: input.value,
    source_unit: input.unit == null ? null : String(input.unit),
    physical_qc: classifyPhysicalMeasurementV1({
      metric: input.metric,
      value: input.value,
      unit: input.unit,
    }),
  };
}
