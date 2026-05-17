import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

type SubjectRef = {
  project_id: string;
  field_id: string;
};

type SampleRef = {
  sample_id: string;
};

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

  async createPlan(input: { subject_ref: SubjectRef; sampling_kind: string; requested_by: string; requested_at_ts: number; notes?: string }): Promise<{ plan_id: string; fact_id: string }> {
    const plan_id = randomUUID();
    const fact_id = `sp_${plan_id}`;

    const record_json: Record<string, unknown> = {
      type: "sampling_plan_v1",
      schema_version: "1",
      plan_id,
      subject_ref: input.subject_ref,
      sampling_kind: input.sampling_kind,
      requested_by: input.requested_by,
      requested_at_ts: input.requested_at_ts,
      notes: input.notes ?? null,
      created_at_ts: Date.now(),
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { plan_id, fact_id };
  }

  async createReceipt(input: { plan_id: string; sample_ref: SampleRef; collected_at_ts: number; collector_id: string; evidence_refs: Array<{ kind: string; ref_id: string }>; ao_sense_receipt_fact_id?: string }): Promise<{ receipt_id: string; fact_id: string }> {
    const receipt_id = randomUUID();
    const fact_id = `sr_${receipt_id}`;

    const record_json: Record<string, unknown> = {
      type: "sample_receipt_v1",
      schema_version: "1",
      receipt_id,
      plan_id: input.plan_id,
      sample_ref: input.sample_ref,
      collected_at_ts: input.collected_at_ts,
      collector_id: input.collector_id,
      evidence_refs: input.evidence_refs,
      ao_sense_receipt_fact_id: input.ao_sense_receipt_fact_id ?? null,
      created_at_ts: Date.now(),
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { receipt_id, fact_id };
  }

  async createLabResult(input: { sample_id: string; report_ref: string; imported_at_ts: number; metrics: Record<string, unknown> }): Promise<{ lab_result_id: string; fact_id: string }> {
    const lab_result_id = randomUUID();
    const fact_id = `sl_${lab_result_id}`;

    const record_json: Record<string, unknown> = {
      type: "lab_result_import_v1",
      schema_version: "1",
      lab_result_id,
      sample_id: input.sample_id,
      report_ref: input.report_ref,
      imported_at_ts: input.imported_at_ts,
      metrics: input.metrics,
      created_at_ts: Date.now(),
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new Error("FACT_INSERT_CONFLICT_OR_FAILED");
    return { lab_result_id, fact_id };
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
         AND (record_json::jsonb->'sample_ref'->>'sample_id') = $1
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [sample_id],
    );
    if (receiptResult.rows?.[0]) return receiptResult.rows[0];

    const labResult = await this.pool.query(FIND_FACT_SQL, ["lab_result_import_v1", "sample_id", sample_id]);
    return labResult.rows?.[0] ?? null;
  }
}
