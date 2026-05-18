import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

type EvidenceRef = { kind: string; ref_id: string };
type SamplingVerdict = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

type InsertFactInput = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: Record<string, unknown>;
};

const INSERT_FACT_SQL = `
  INSERT INTO facts (fact_id, occurred_at, source, record_json)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (fact_id) DO NOTHING
  RETURNING fact_id
`;

const FIND_FACT_SQL = `
  SELECT fact_id, occurred_at, source, record_json
  FROM facts
  WHERE (record_json::jsonb->>'type') = $1
    AND (record_json::jsonb->>$2) = $3
  ORDER BY occurred_at DESC
  LIMIT 1
`;

export class SamplingServiceV1 {
  constructor(private readonly pool: Pool) {}

  private async insertFact(input: InsertFactInput): Promise<boolean> {
    const result = await this.pool.query(INSERT_FACT_SQL, [input.fact_id, input.occurred_at, input.source, JSON.stringify(input.record_json)]);
    return Array.isArray(result.rows) && result.rows.length > 0;
  }

  async createPlan(input: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    zone_id?: string | null;
    reason: string;
    sample_type: string;
    required_depth_cm?: number | null;
    required_points: number;
    operation_id?: string | null;
    operation_plan_id?: string | null;
    evidence_refs: EvidenceRef[];
  }): Promise<{ plan_id: string; fact_id: string; relation_fact_id?: string }> {
    const plan_id = randomUUID();
    const fact_id = `sp_${plan_id}`;

    const record_json: Record<string, unknown> = {
      type: "sampling_plan_v1",
      schema_version: "1",
      plan_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      zone_id: input.zone_id ?? null,
      reason: input.reason,
      sample_type: input.sample_type,
      required_depth_cm: input.required_depth_cm ?? null,
      required_points: input.required_points,
      created_at_ts: Date.now(),
      evidence_refs: input.evidence_refs,
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");

    const operation_id = typeof input.operation_id === "string" && input.operation_id.trim() ? input.operation_id.trim() : null;
    const operation_plan_id = typeof input.operation_plan_id === "string" && input.operation_plan_id.trim() ? input.operation_plan_id.trim() : null;
    if (!operation_id && !operation_plan_id) return { plan_id, fact_id };

    const relation_id = randomUUID();
    const relation_fact_id = `sor_${relation_id}`;
    const relationRecordJson: Record<string, unknown> = {
      type: "sampling_operation_relation_v1",
      schema_version: "1",
      relation_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      plan_id,
      operation_id,
      operation_plan_id,
      created_at_ts: Date.now(),
    };

    const relationOk = await this.insertFact({
      fact_id: relation_fact_id,
      occurred_at: new Date().toISOString(),
      source: "api_v1_sampling",
      record_json: relationRecordJson,
    });
    if (!relationOk) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");

    return { plan_id, fact_id, relation_fact_id };
  }

  async createReceipt(input: {
    plan_id: string;
    sample_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    zone_id?: string | null;
    collected_at_ts: number;
    collector_actor_id: string;
    sample_type: string;
    depth_cm?: number | null;
    location_ref?: string | null;
    barcode?: string | null;
    evidence_refs: EvidenceRef[];
    chain_of_custody_status: string;
    ao_sense_receipt_fact_id?: string;
    sample_type_override?: boolean;
    override_reason?: string;
  }): Promise<{ receipt_id: string; fact_id: string }> {
    const receipt_id = randomUUID();
    const fact_id = `sr_${receipt_id}`;

    const record_json: Record<string, unknown> = {
      type: "sample_receipt_v1",
      schema_version: "1",
      sample_id: input.sample_id,
      plan_id: input.plan_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      zone_id: input.zone_id ?? null,
      collected_at_ts: input.collected_at_ts,
      collector_actor_id: input.collector_actor_id,
      sample_type: input.sample_type,
      depth_cm: input.depth_cm ?? null,
      location_ref: input.location_ref ?? null,
      barcode: input.barcode ?? null,
      evidence_refs: input.evidence_refs,
      chain_of_custody_status: input.chain_of_custody_status,
      ao_sense_receipt_fact_id: input.ao_sense_receipt_fact_id ?? null,
      sample_type_override: input.sample_type_override === true,
      override_reason: input.override_reason ?? null,
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { receipt_id, fact_id };
  }

  async findPlanById(plan_id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(FIND_FACT_SQL, ["sampling_plan_v1", "plan_id", plan_id]);
    return result.rows?.[0]?.record_json ?? null;
  }

  async findReceiptBySampleId(sample_id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `SELECT record_json
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'sample_receipt_v1'
         AND (record_json::jsonb->>'sample_id') = $1
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [sample_id],
    );
    return result.rows?.[0]?.record_json ?? null;
  }

  async hasFactByIdAndType(fact_id: string, type: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM facts
       WHERE fact_id = $1
         AND (record_json::jsonb->>'type') = $2
       LIMIT 1`,
      [fact_id, type],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createLabResult(input: {
    sample_id: string;
    imported_at_ts: number;
    import_id?: string;
    lab_name?: string | null;
    metrics: Record<string, unknown>;
    units: Record<string, string>;
    evidence_refs: EvidenceRef[];
    quality_status: string;
  }): Promise<{ import_id: string; fact_id: string }> {
    const import_id = input.import_id ?? randomUUID();
    const fact_id = `sl_${import_id}`;

    const record_json: Record<string, unknown> = {
      type: "lab_result_import_v1",
      schema_version: "1",
      import_id,
      sample_id: input.sample_id,
      imported_at_ts: input.imported_at_ts,
      lab_name: input.lab_name ?? null,
      metrics: input.metrics,
      units: input.units,
      evidence_refs: input.evidence_refs,
      quality_status: input.quality_status,
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { import_id, fact_id };
  }

  async findLabResultBySampleId(sample_id: string, import_id?: string): Promise<Record<string, unknown> | null> {
    if (import_id) {
      const result = await this.pool.query(
        `SELECT record_json
         FROM facts
         WHERE (record_json::jsonb->>'type') = 'lab_result_import_v1'
           AND (record_json::jsonb->>'sample_id') = $1
           AND (record_json::jsonb->>'import_id') = $2
         ORDER BY occurred_at DESC
         LIMIT 1`,
        [sample_id, import_id],
      );
      return result.rows?.[0]?.record_json ?? null;
    }

    const result = await this.pool.query(FIND_FACT_SQL, ["lab_result_import_v1", "sample_id", sample_id]);
    return result.rows?.[0]?.record_json ?? null;
  }

  async createAcceptance(input: {
    plan_id: string;
    sample_id: string;
    import_id?: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    verdict: SamplingVerdict;
    reasons: string[];
    evidence_refs: EvidenceRef[];
  }): Promise<{ acceptance_id: string; fact_id: string }> {
    if (!input.tenant_id || !input.project_id || !input.group_id) {
      throw new Error("INVALID_ACCEPTANCE_SCOPE");
    }
    const acceptance_id = randomUUID();
    const fact_id = `sa_${acceptance_id}`;

    const record_json: Record<string, unknown> = {
      type: "sampling_acceptance_v1",
      schema_version: "1",
      acceptance_id,
      plan_id: input.plan_id,
      sample_id: input.sample_id,
      import_id: input.import_id ?? null,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      verdict: input.verdict,
      reasons: input.reasons,
      evaluated_at_ts: Date.now(),
      evidence_refs: input.evidence_refs,
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { acceptance_id, fact_id };
  }

  async getPlan(plan_id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(FIND_FACT_SQL, ["sampling_plan_v1", "plan_id", plan_id]);
    return result.rows?.[0] ?? null;
  }

  async getSample(sample_id: string): Promise<Record<string, unknown> | null> {
    const receiptResult = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'sample_receipt_v1'
         AND (record_json::jsonb->>'sample_id') = $1
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [sample_id],
    );
    if (receiptResult.rows?.[0]) return receiptResult.rows[0];

    const labResult = await this.pool.query(FIND_FACT_SQL, ["lab_result_import_v1", "sample_id", sample_id]);
    return labResult.rows?.[0] ?? null;
  }
}
