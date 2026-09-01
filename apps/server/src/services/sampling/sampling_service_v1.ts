import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

type EvidenceRef = { kind: string; ref_id: string };
type SamplingVerdict = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

export type SamplingScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type SamplingFactRowV1 = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: Record<string, any>;
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

const SAMPLING_ACCEPTANCE_POLICY_REF = "SAMPLING_ACCEPTANCE_EXACT_CHAIN_V1";
const SAMPLE_RECEIPT_IDENTITY_POLICY_REF = "SAMPLE_RECEIPT_SCOPE_SAMPLE_SHA256_V1";

function sha256(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex");
}

function exactPlanFactId(plan_id: string): string {
  return `sp_${plan_id}`;
}

function exactLabFactId(import_id: string): string {
  return `sl_${import_id}`;
}

function sameScope(record: Record<string, any>, scope: SamplingScopeV1): boolean {
  return String(record?.tenant_id ?? "") === scope.tenant_id
    && String(record?.project_id ?? "") === scope.project_id
    && String(record?.group_id ?? "") === scope.group_id;
}

export class SamplingServiceErrorV1 extends Error {
  readonly code: string;
  readonly status_code: number;

  constructor(code: string, status_code = 409) {
    super(code);
    this.name = "SamplingServiceErrorV1";
    this.code = code;
    this.status_code = status_code;
  }
}

export class SamplingServiceV1 {
  constructor(private readonly pool: Pool) {}

  private async insertFact(input: InsertFactInput): Promise<boolean> {
    const result = await this.pool.query(INSERT_FACT_SQL, [input.fact_id, input.occurred_at, input.source, JSON.stringify(input.record_json)]);
    return Array.isArray(result.rows) && result.rows.length > 0;
  }

  private async findExactFactByIdAndType(
    fact_id: string,
    type: string,
    scope?: SamplingScopeV1,
  ): Promise<SamplingFactRowV1 | null> {
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE fact_id = $1
          AND (record_json::jsonb->>'type') = $2
        LIMIT 1`,
      [fact_id, type],
    );
    const row = (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
    if (!row) return null;
    if (scope && !sameScope(row.record_json, scope)) return null;
    return row;
  }

  private async findUniqueFactByTypeAndKey(
    type: string,
    key: string,
    value: string,
    scope?: SamplingScopeV1,
  ): Promise<SamplingFactRowV1 | null> {
    const result = scope
      ? await this.pool.query(
        `SELECT fact_id, occurred_at, source, record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = $1
            AND (record_json::jsonb->>$2) = $3
            AND (record_json::jsonb->>'tenant_id') = $4
            AND (record_json::jsonb->>'project_id') = $5
            AND (record_json::jsonb->>'group_id') = $6
          LIMIT 2`,
        [type, key, value, scope.tenant_id, scope.project_id, scope.group_id],
      )
      : await this.pool.query(
        `SELECT fact_id, occurred_at, source, record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = $1
            AND (record_json::jsonb->>$2) = $3
          LIMIT 2`,
        [type, key, value],
      );

    if ((result.rows?.length ?? 0) > 1) {
      throw new SamplingServiceErrorV1(`SAMPLING_SOURCE_AMBIGUOUS:${type}:${key}`, 409);
    }
    return (result.rows?.[0] as SamplingFactRowV1 | undefined) ?? null;
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
    const fact_id = exactPlanFactId(plan_id);

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
    if (!ok) throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);

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

    const relationOk = await this.insertFact({
      fact_id: relation_fact_id,
      occurred_at: new Date().toISOString(),
      source: "api_v1_sampling",
      record_json: relationRecordJson,
    });
    if (!relationOk) throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);

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
    const scope: SamplingScopeV1 = {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
    };
    const existing = await this.findUniqueFactByTypeAndKey("sample_receipt_v1", "sample_id", input.sample_id, scope);
    if (existing) throw new SamplingServiceErrorV1("SAMPLE_ID_ALREADY_BOUND", 409);

    const digest = sha256([
      SAMPLE_RECEIPT_IDENTITY_POLICY_REF,
      input.tenant_id,
      input.project_id,
      input.group_id,
      input.sample_id,
    ]);
    const receipt_id = `sampling_receipt_${digest}`;
    const fact_id = `sr_${digest}`;

    const record_json: Record<string, unknown> = {
      type: "sample_receipt_v1",
      schema_version: "1",
      receipt_id,
      receipt_identity_policy_ref: SAMPLE_RECEIPT_IDENTITY_POLICY_REF,
      sample_id: input.sample_id,
      plan_id: input.plan_id,
      sampling_plan_fact_id: exactPlanFactId(input.plan_id),
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
    if (!ok) throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);
    return { receipt_id, fact_id };
  }

  async findPlanFactById(plan_id: string): Promise<SamplingFactRowV1 | null> {
    const row = await this.findExactFactByIdAndType(exactPlanFactId(plan_id), "sampling_plan_v1");
    if (!row || String(row.record_json?.plan_id ?? "") !== plan_id) return null;
    return row;
  }

  async findPlanById(plan_id: string): Promise<Record<string, unknown> | null> {
    const row = await this.findPlanFactById(plan_id);
    return row?.record_json ?? null;
  }

  async findReceiptFactBySampleId(scope: SamplingScopeV1, sample_id: string): Promise<SamplingFactRowV1 | null> {
    return this.findUniqueFactByTypeAndKey("sample_receipt_v1", "sample_id", sample_id, scope);
  }

  async findReceiptBySampleId(scope: SamplingScopeV1, sample_id: string): Promise<Record<string, unknown> | null> {
    const row = await this.findReceiptFactBySampleId(scope, sample_id);
    return row?.record_json ?? null;
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
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    sample_receipt_fact_id: string;
    imported_at_ts: number;
    import_id?: string;
    lab_name?: string | null;
    metrics: Record<string, unknown>;
    units: Record<string, string>;
    evidence_refs: EvidenceRef[];
    quality_status: string;
  }): Promise<{ import_id: string; fact_id: string }> {
    const import_id = input.import_id ?? randomUUID();
    const fact_id = exactLabFactId(import_id);

    const record_json: Record<string, unknown> = {
      type: "lab_result_import_v1",
      schema_version: "1",
      import_id,
      sample_id: input.sample_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      sample_receipt_fact_id: input.sample_receipt_fact_id,
      imported_at_ts: input.imported_at_ts,
      lab_name: input.lab_name ?? null,
      metrics: input.metrics,
      units: input.units,
      evidence_refs: input.evidence_refs,
      quality_status: input.quality_status,
    };

    const ok = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!ok) throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);
    return { import_id, fact_id };
  }

  async findLabResultFactBySampleId(
    scope: SamplingScopeV1,
    sample_id: string,
    import_id?: string,
  ): Promise<SamplingFactRowV1 | null> {
    if (import_id) {
      const row = await this.findExactFactByIdAndType(exactLabFactId(import_id), "lab_result_import_v1", scope);
      if (!row || String(row.record_json?.sample_id ?? "") !== sample_id || String(row.record_json?.import_id ?? "") !== import_id) return null;
      return row;
    }
    return this.findUniqueFactByTypeAndKey("lab_result_import_v1", "sample_id", sample_id, scope);
  }

  async findLabResultBySampleId(
    scope: SamplingScopeV1,
    sample_id: string,
    import_id?: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.findLabResultFactBySampleId(scope, sample_id, import_id);
    return row?.record_json ?? null;
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
  }): Promise<{ acceptance_id: string; fact_id: string }> {
    if (!input.tenant_id || !input.project_id || !input.group_id) {
      throw new SamplingServiceErrorV1("INVALID_ACCEPTANCE_SCOPE", 400);
    }

    const digest = sha256([
      SAMPLING_ACCEPTANCE_POLICY_REF,
      input.tenant_id,
      input.project_id,
      input.group_id,
      input.field_id,
      input.plan_id,
      input.sample_id,
      input.import_id ?? "",
      input.sampling_plan_fact_id,
      input.sample_receipt_fact_id ?? "",
      input.lab_result_fact_id ?? "",
    ]);
    const acceptance_id = `sampling_acceptance_${digest}`;
    const fact_id = `sa_${digest}`;

    const record_json: Record<string, unknown> = {
      type: "sampling_acceptance_v1",
      schema_version: "1",
      acceptance_id,
      acceptance_policy_ref: SAMPLING_ACCEPTANCE_POLICY_REF,
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

    const inserted = await this.insertFact({ fact_id, occurred_at: new Date().toISOString(), source: "api_v1_sampling", record_json });
    if (!inserted) {
      const existing = await this.findExactFactByIdAndType(fact_id, "sampling_acceptance_v1", input);
      if (!existing) throw new SamplingServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);
      const payload = existing.record_json ?? {};
      if (
        String(payload.acceptance_policy_ref ?? "") !== SAMPLING_ACCEPTANCE_POLICY_REF
        || String(payload.sampling_plan_fact_id ?? "") !== input.sampling_plan_fact_id
        || String(payload.sample_receipt_fact_id ?? "") !== String(input.sample_receipt_fact_id ?? "")
        || String(payload.lab_result_fact_id ?? "") !== String(input.lab_result_fact_id ?? "")
      ) {
        throw new SamplingServiceErrorV1("SAMPLING_ACCEPTANCE_IDENTITY_CONFLICT", 409);
      }
    }
    return { acceptance_id, fact_id };
  }

  async getPlan(plan_id: string): Promise<SamplingFactRowV1 | null> {
    return this.findPlanFactById(plan_id);
  }

  async getSample(scope: SamplingScopeV1, sample_id: string): Promise<SamplingFactRowV1 | null> {
    return this.findReceiptFactBySampleId(scope, sample_id);
  }
}
