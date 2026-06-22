// apps/server/src/routes/evidence_artifact_from_as_executed_v1.ts
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  buildEvidenceArtifactsFromAsExecutedV1,
  type EvidenceArtifactFromAsExecutedRecordV1,
  type OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1,
} from "../domain/evidence/evidence_artifact_from_as_executed_v1.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type ExistingFactRow = {
  fact_id: string;
  record_json: unknown;
};

function tenantFromBody(body: any, auth: TenantTriple): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(body?.project_id ?? auth.project_id).trim(),
    group_id: String(body?.group_id ?? auth.group_id).trim(),
  };
}

function responseCode(status: string): number {
  if (status === "EVIDENCE_ARTIFACTS_RECORDED") return 200;
  if (status === "REJECTED_AS_EXECUTED_NOT_FOUND") return 404;
  if (status === "REJECTED_DUPLICATE") return 409;
  if (status === "REJECTED_INVALID_INPUT") return 400;
  return 422;
}

function normalizeArtifactRecordForConflict(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeArtifactRecordForConflict);

  const obj = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === "created_at") continue;
    normalized[key] = normalizeArtifactRecordForConflict(obj[key]);
  }
  return normalized;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(",")}}`;
}

function invalidInputResponse() {
  return {
    ok: false,
    status: "REJECTED_INVALID_INPUT",
    error: "REJECTED_INVALID_INPUT",
    evidence_artifacts_created: false,
    acceptance_created: false,
    water_response_verification_created: false,
    roi_created: false,
    field_memory_created: false,
  };
}

function duplicateResponse(payload: Partial<OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1> = {}) {
  return {
    ok: false,
    ...payload,
    status: "REJECTED_DUPLICATE",
    duplicate: true,
    evidence_artifacts_created: false,
    acceptance_created: false,
    water_response_verification_created: false,
    roi_created: false,
    field_memory_created: false,
  };
}

async function findDuplicateSubmission(
  pool: Pool,
  tenantId: string,
  idempotencyKey: string,
): Promise<ExistingFactRow | null> {
  const result = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operator_as_executed_evidence_artifact_submission_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,idempotency_key}') = $2
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenantId, idempotencyKey],
  );
  return result.rows?.[0] ?? null;
}

async function readAsExecutedRecord(pool: Pool, tenant: TenantTriple, asExecutedId: string) {
  const result = await pool.query(
    `SELECT as_executed_id,
            tenant_id,
            project_id,
            group_id,
            field_id,
            task_id,
            receipt_id,
            prescription_id,
            planned::jsonb AS planned,
            executed::jsonb AS executed,
            evidence_refs::jsonb AS evidence_refs,
            receipt_refs::jsonb AS receipt_refs,
            log_refs::jsonb AS log_refs
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, asExecutedId],
  );
  return result.rows?.[0] ?? null;
}

async function readExistingArtifactFacts(
  pool: Pool,
  factIds: string[],
): Promise<Map<string, unknown>> {
  if (factIds.length === 0) return new Map();
  const result = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE fact_id = ANY($1::text[])`,
    [factIds],
  );
  return new Map(result.rows.map((row) => [String(row.fact_id), row.record_json]));
}

async function validateArtifactConflicts(
  pool: Pool,
  artifacts: EvidenceArtifactFromAsExecutedRecordV1[],
): Promise<{ ok: true } | { ok: false; fact_id: string }> {
  const existing = await readExistingArtifactFacts(pool, artifacts.map((artifact) => artifact.fact_id));

  for (const artifact of artifacts) {
    const existingRecord = existing.get(artifact.fact_id);
    if (!existingRecord) continue;
    const existingComparable = normalizeArtifactRecordForConflict(existingRecord);
    const nextComparable = normalizeArtifactRecordForConflict(artifact.record);
    if (stableJson(existingComparable) !== stableJson(nextComparable)) {
      return { ok: false, fact_id: artifact.fact_id };
    }
  }

  return { ok: true };
}

async function writeSubmissionAndArtifacts(
  client: PoolClient,
  submission: OperatorAsExecutedEvidenceArtifactSubmissionPayloadV1,
  artifacts: EvidenceArtifactFromAsExecutedRecordV1[],
): Promise<void> {
  await client.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, NOW(), $2, $3::jsonb)`,
    [
      submission.submission_id,
      "operator_as_executed_evidence_artifact_submission_api",
      JSON.stringify({ type: "operator_as_executed_evidence_artifact_submission_v1", payload: submission }),
    ],
  );

  for (const artifact of artifacts) {
    await client.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, NOW(), $2, $3::jsonb)
       ON CONFLICT (fact_id) DO NOTHING`,
      [
        artifact.fact_id,
        "operator_as_executed_evidence_artifact_submission_api",
        JSON.stringify(artifact.record),
      ],
    );
  }
}

export function registerEvidenceArtifactFromAsExecutedV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/evidence-artifacts/from-as-executed", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "evidence.artifact.write");
    if (!auth) return reply;

    if (!["executor", "operator", "admin"].includes(String(auth.role))) {
      return reply.status(403).send({ ok: false, error: "AUTH_ROLE_SCOPE_DENIED" });
    }

    const body: any = req.body ?? {};
    const tenant = tenantFromBody(body, auth);
    if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    }
    if (
      tenant.tenant_id !== auth.tenant_id ||
      tenant.project_id !== auth.project_id ||
      tenant.group_id !== auth.group_id
    ) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }

    const fieldId = String(body?.field_id ?? "").trim();
    const asExecutedId = String(body?.as_executed_id ?? "").trim();
    const taskId = String(body?.task_id ?? "").trim();
    const receiptId = String(body?.receipt_id ?? "").trim();
    const operatorId = String(body?.operator_id ?? auth.actor_id).trim();
    const idempotencyKey = String(body?.idempotency_key ?? "").trim();

    if (!fieldId || !asExecutedId || !taskId || !receiptId || !operatorId || !idempotencyKey) {
      return reply.status(400).send(invalidInputResponse());
    }

    const duplicate = await findDuplicateSubmission(pool, tenant.tenant_id, idempotencyKey);
    if (duplicate) {
      const payload = (duplicate.record_json as any)?.payload ?? {};
      return reply.status(409).send(duplicateResponse(payload));
    }

    const asExecutedRecord = await readAsExecutedRecord(pool, tenant, asExecutedId);
    const operationPlanId =
      body?.operation_plan_id == null || String(body.operation_plan_id).trim() === ""
        ? null
        : String(body.operation_plan_id).trim();

    const built = buildEvidenceArtifactsFromAsExecutedV1({
      ...tenant,
      field_id: fieldId,
      zone_id: body?.zone_id == null ? null : String(body.zone_id).trim(),
      operator_id: operatorId,
      idempotency_key: idempotencyKey,
      materialization_reason: String(body?.materialization_reason ?? "").trim(),
      asExecutedRecord,
      as_executed_id: asExecutedId,
      task_id: taskId,
      receipt_id: receiptId,
      operation_plan_id: operationPlanId,
      submission_id: `sub_${randomUUID()}`,
      created_at: new Date().toISOString(),
    });

    if (built.submission.status !== "EVIDENCE_ARTIFACTS_RECORDED") {
      return reply.status(responseCode(built.submission.status)).send({ ok: false, ...built.submission });
    }

    const conflict = await validateArtifactConflicts(pool, built.artifacts);
    if (!conflict.ok) {
      return reply.status(409).send({
        ...duplicateResponse(built.submission),
        conflict_fact_id: conflict.fact_id,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await writeSubmissionAndArtifacts(client, built.submission, built.artifacts);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return reply.send({ ok: true, ...built.submission });
  });
}
