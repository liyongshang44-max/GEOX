import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type SamplingScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type SamplingFactRowV1 = {
  fact_id: string;
  occurred_at: unknown;
  source: string;
  record_json: Record<string, any>;
};

type EvidenceRef = { kind: string; ref_id: string };
type SamplingVerdict = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

type InsertFactInput = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: Record<string, unknown>;
};

export class SamplingServiceErrorV1 extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "SamplingServiceErrorV1";
  }
}

const INSERT_FACT_SQL = `
  INSERT INTO facts (fact_id, occurred_at, source, record_json)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (fact_id) DO NOTHING
  RETURNING fact_id
`;

function scopeParams(scope: SamplingScopeV1): [string, string, string] {
  return [scope.tenant_id, scope.project_id, scope.group_id];
}

function samplingIdentityHashV1(parts: Array<string | null | undefined>): string {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("\n"), "utf8").digest("hex");
}

function deterministicReceiptIdentityV1(scope: SamplingScopeV1, sample_id: string): { receipt_id: string; fact_id: string } {
  const digest = samplingIdentityHashV1(["sample_receipt_v1", ...scopeParams(scope), sample_id]);
  return {
    receipt_id: `sample_receipt_${digest.slice(0, 32)}`,
    fact_id: `sr_${digest}`,
  };
}

function deterministicAcceptanceIdentityV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  sampling_plan_fact_id: string;
  sample_receipt_fact_id?: string | null;
  lab_result_fact_id?: string | null;
  sample_id: string;
  import_id?: string | null;
}): { acceptance_id: string; fact_id: string } {
  const digest = samplingIdentityHashV1([
    "sampling_acceptance_v1",
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.sampling_plan_fact_id,
    input.sample_receipt_fact_id ?? null,
    input.lab_result_fact_id ?? null,
    input.sample_id,
    input.import_id ?? null,
  ]);
  return {
    acceptance_id: `sampling_acceptance_${digest.slice(0, 32)}`,
    fact_id: `sa_${digest}`,
  };
}

export class SamplingServiceV1 {
  constructor(private readonly pool: Pool) {}

  private async insertFact(input: InsertFactInput): Promise<void> {
    const result = await this.pool.query(INSERT_FACT_SQL, [input.fact_id, input.occurred_at, input.source, JSON.stringify(input.record_json)]);
    if (!Array.isArray(result.rows) || result.rows.length < 1) {
      throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);
    }
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

    await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });

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
      sampling_plan_fact_id: fact_id,
      operation_id,
      operation_plan_id,
      created_at_ts: Date.now(),
    };

    await this.insertFact({
      fact_id: relation_fact_id,
      occurred_at: new Date().toISOString(),
      source: "api_v1_sampling",
      record_json: relationRecordJson,
    });

    return { plan_id, fact_id, relation_fact_id };
  }

  async findPlanById(plan_id: string): Promise<SamplingFactRowV1 | null> {
    const factId = `sp_${plan_id}`;
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = 'sampling_plan_v1'
          AND (record_json::jsonb->>'plan_id') = $2
        LIMIT 1`,
      [factId, plan_id],
    );
    return (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
  }

  async findReceiptBySampleId(sample_id: string, scope: SamplingScopeV1): Promise<SamplingFactRowV1 | null> {
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'sample_receipt_v1'
          AND (record_json::jsonb->>'sample_id') = $1
          AND (record_json::jsonb->>'tenant_id') = $2
          AND (record_json::jsonb->>'project_id') = $3
          AND (record_json::jsonb->>'group_id') = $4
        LIMIT 2`,
      [sample_id, ...scopeParams(scope)],
    );
    if ((result.rows?.length ?? 0) > 1) throw new SamplingServiceErrorV1("AMBIGUOUS:sample_receipt_v1", 409);
    return (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
  }

  async createReceipt(input: {
    plan_id: string;
    sample_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    sampling_plan_fact_id: string;
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
    const scope = { tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id };
    const existing = await this.findReceiptBySampleId(input.sample_id, scope);
    if (existing) throw new SamplingServiceErrorV1("DUPLICATE:sample_id", 409);

    const { receipt_id, fact_id } = deterministicReceiptIdentityV1(scope, input.sample_id);

    const record_json: Record<string, unknown> = {
      type: "sample_receipt_v1",
      schema_version: "1",
      receipt_id,
      sample_id: input.sample_id,
      plan_id: input.plan_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      sampling_plan_fact_id: input.sampling_plan_fact_id,
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

    try {
      await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    } catch (error) {
      if (error instanceof SamplingServiceErrorV1 && error.message === "FACT_INSERT_CONFLICT_OR_FAILED") {
        throw new SamplingServiceErrorV1("DUPLICATE:sample_id", 409);
      }
      throw error;
    }
    return { receipt_id, fact_id };
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
    sample_receipt_fact_id: string;
    sampling_plan_fact_id: string;
    plan_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
  }): Promise<{ import_id: string; fact_id: string }> {
    const import_id = input.import_id ?? randomUUID();
    const fact_id = `sl_${import_id}`;

    const record_json: Record<string, unknown> = {
      type: "lab_result_import_v1",
      schema_version: "1",
      import_id,
      sample_id: input.sample_id,
      sample_receipt_fact_id: input.sample_receipt_fact_id,
      sampling_plan_fact_id: input.sampling_plan_fact_id,
      plan_id: input.plan_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      imported_at_ts: input.imported_at_ts,
      lab_name: input.lab_name ?? null,
      metrics: input.metrics,
      units: input.units,
      evidence_refs: input.evidence_refs,
      quality_status: input.quality_status,
    };

    await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    return { import_id, fact_id };
  }

  async findLabResultBySampleId(
    sample_id: string,
    import_id: string | undefined,
    sampleReceiptFactId: string,
  ): Promise<SamplingFactRowV1 | null> {
    if (import_id) {
      const factId = `sl_${import_id}`;
      const result = await this.pool.query(
        `SELECT fact_id, occurred_at, source, record_json
           FROM facts
          WHERE fact_id = $1
            AND (record_json::jsonb->>'type') = 'lab_result_import_v1'
            AND (record_json::jsonb->>'sample_id') = $2
            AND (record_json::jsonb->>'import_id') = $3
            AND (record_json::jsonb->>'sample_receipt_fact_id') = $4
          LIMIT 1`,
        [factId, sample_id, import_id, sampleReceiptFactId],
      );
      return (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
    }

    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'lab_result_import_v1'
          AND (record_json::jsonb->>'sample_id') = $1
          AND (record_json::jsonb->>'sample_receipt_fact_id') = $2
        LIMIT 2`,
      [sample_id, sampleReceiptFactId],
    );
    if ((result.rows?.length ?? 0) > 1) throw new SamplingServiceErrorV1("AMBIGUOUS:lab_result_import_v1", 409);
    return (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
  }

  async createAcceptance(input: {
    plan_id: string;
    sample_id: string;
    import_id?: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    sampling_plan_fact_id: string;
    sample_receipt_fact_id?: string | null;
    lab_result_fact_id?: string | null;
    verdict: SamplingVerdict;
    reasons: string[];
    evidence_refs: EvidenceRef[];
  }): Promise<{ acceptance_id: string; fact_id: string; idempotent: boolean }> {
    if (!input.tenant_id || !input.project_id || !input.group_id) {
      throw new SamplingServiceErrorV1("INVALID_ACCEPTANCE_SCOPE", 400);
    }

    const findExisting = async () => this.pool.query(
      `SELECT fact_id, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'sampling_acceptance_v1'
          AND (record_json::jsonb->>'tenant_id') = $1
          AND (record_json::jsonb->>'project_id') = $2
          AND (record_json::jsonb->>'group_id') = $3
          AND (record_json::jsonb->>'sampling_plan_fact_id') = $4
          AND (record_json::jsonb->>'sample_receipt_fact_id') IS NOT DISTINCT FROM $5::text
          AND (record_json::jsonb->>'lab_result_fact_id') IS NOT DISTINCT FROM $6::text
          AND (record_json::jsonb->>'sample_id') = $7
          AND COALESCE(record_json::jsonb->>'import_id', '') = COALESCE($8::text, '')
        LIMIT 2`,
      [
        input.tenant_id,
        input.project_id,
        input.group_id,
        input.sampling_plan_fact_id,
        input.sample_receipt_fact_id ?? null,
        input.lab_result_fact_id ?? null,
        input.sample_id,
        input.import_id ?? null,
      ],
    );

    const resolveExisting = (rows: any[]): { acceptance_id: string; fact_id: string } | null => {
      if (rows.length > 1) {
        throw new SamplingServiceErrorV1("AMBIGUOUS:sampling_acceptance_v1", 409);
      }
      if (!rows[0]) return null;
      const existingRecord = rows[0].record_json ?? {};
      const existingReasons = Array.isArray(existingRecord.reasons) ? existingRecord.reasons.map(String) : [];
      if (String(existingRecord.verdict ?? "") !== input.verdict
        || JSON.stringify(existingReasons) !== JSON.stringify(input.reasons)) {
        throw new SamplingServiceErrorV1("CONFLICT:sampling_acceptance_exact_chain_verdict", 409);
      }
      const acceptanceId = String(existingRecord.acceptance_id ?? "").trim();
      if (!acceptanceId) throw new SamplingServiceErrorV1("INVALID:sampling_acceptance_identity", 409);
      return { acceptance_id: acceptanceId, fact_id: String(rows[0].fact_id) };
    };

    const before = resolveExisting((await findExisting()).rows ?? []);
    if (before) return { ...before, idempotent: true };

    const { acceptance_id, fact_id } = deterministicAcceptanceIdentityV1(input);
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
      field_id: input.field_id,
      sampling_plan_fact_id: input.sampling_plan_fact_id,
      sample_receipt_fact_id: input.sample_receipt_fact_id ?? null,
      lab_result_fact_id: input.lab_result_fact_id ?? null,
      verdict: input.verdict,
      reasons: input.reasons,
      evaluated_at_ts: Date.now(),
      evidence_refs: input.evidence_refs,
    };

    try {
      await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
      return { acceptance_id, fact_id, idempotent: false };
    } catch (error) {
      if (!(error instanceof SamplingServiceErrorV1) || error.message !== "FACT_INSERT_CONFLICT_OR_FAILED") throw error;
      const raced = resolveExisting((await findExisting()).rows ?? []);
      if (raced) return { ...raced, idempotent: true };
      throw error;
    }
  }

  async getPlan(plan_id: string): Promise<SamplingFactRowV1 | null> {
    return this.findPlanById(plan_id);
  }

  async getSample(sample_id: string, scope: SamplingScopeV1): Promise<SamplingFactRowV1 | null> {
    return this.findReceiptBySampleId(sample_id, scope);
  }
}
