import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  decisionEligibilityPolicyDeclarationV1Schema,
  type DecisionEligibilityPolicyDeclarationV1,
} from "../../contracts/decision_eligibility_policy_declaration_v1.js";

export const DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1 =
  "decision_eligibility_policy_declaration_v1";

export const DECISION_ELIGIBILITY_POLICY_DECLARATION_SOURCE_TYPE_V1 =
  "AUTHORIZED_HUMAN_API";

export const DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_AUDIT_VERSION_V1 =
  "decision_eligibility_policy_declaration_audit_v1";

export type DecisionEligibilityPolicyDeclarationWriteInputV1 = Pick<
  DecisionEligibilityPolicyDeclarationV1,
  | "policy_id"
  | "policy_version"
  | "scope"
  | "applicable_action_types"
  | "required_criteria"
  | "lifecycle_semantics"
  | "provenance_refs"
  | "effective_from"
  | "effective_until"
  | "supersedes_policy_ref"
  | "limitations"
>;

export type DecisionEligibilityPolicyDeclarationFactAuditV1 = {
  schema_version: typeof DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_AUDIT_VERSION_V1;
  changed_by_actor_id: string;
  changed_by_token_id: string;
  change_reason: string;
  written_at: string;
};

export type DecisionEligibilityPolicyDeclarationFactRecordV1 = {
  type: typeof DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1;
  payload: DecisionEligibilityPolicyDeclarationV1;
  audit: DecisionEligibilityPolicyDeclarationFactAuditV1;
};

export type DecisionEligibilityPolicyDeclarationWriteResultV1 = {
  created: boolean;
  fact_id: string;
  occurred_at: string;
  declaration: DecisionEligibilityPolicyDeclarationV1;
};

export class DecisionEligibilityPolicyDeclarationWriteErrorV1 extends Error {
  constructor(
    readonly code:
      | "POLICY_DECLARATION_INVALID"
      | "POLICY_CHANGE_REASON_REQUIRED"
      | "POLICY_SCOPE_AUTH_MISMATCH"
      | "POLICY_REF_CONFLICT"
      | "POLICY_REF_AMBIGUOUS"
      | "POLICY_REF_EXISTING_DECLARATION_INVALID",
    message: string = code,
  ) {
    super(message);
    this.name = "DecisionEligibilityPolicyDeclarationWriteErrorV1";
  }
}

const WRITE_INPUT_KEYS_V1 = new Set([
  "policy_id",
  "policy_version",
  "scope",
  "applicable_action_types",
  "required_criteria",
  "lifecycle_semantics",
  "provenance_refs",
  "effective_from",
  "effective_until",
  "supersedes_policy_ref",
  "limitations",
]);

function assertWriteInputKeysV1(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (!WRITE_INPUT_KEYS_V1.has(key)) {
      throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
        "POLICY_DECLARATION_INVALID",
        `POLICY_DECLARATION_UNKNOWN_FIELD:${key}`,
      );
    }
  }
}

function normalizedChangeReasonV1(changeReason: string): string {
  const value = String(changeReason ?? "").trim();
  if (!value) {
    throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
      "POLICY_CHANGE_REASON_REQUIRED",
    );
  }
  return value;
}

function policyRefV1(policyId: string, policyVersion: string): string {
  return `decision_eligibility_policy_v1:${policyId}:${policyVersion}`;
}

function declarationIdV1(policyId: string, policyVersion: string): string {
  return `decision_eligibility_policy_declaration_v1:${policyId}:${policyVersion}`;
}

function sourceRefV1(auth: AoActAuthContextV0): string {
  return `actor:${auth.actor_id}`;
}

function assertScopeMatchesAuthV1(
  auth: AoActAuthContextV0,
  input: DecisionEligibilityPolicyDeclarationWriteInputV1,
): void {
  const scope = input.scope?.decision_scope;
  if (
    scope?.tenant_id !== auth.tenant_id
    || scope?.project_id !== auth.project_id
    || scope?.group_id !== auth.group_id
  ) {
    throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
      "POLICY_SCOPE_AUTH_MISMATCH",
    );
  }
}

function buildDeclarationCandidateV1(
  auth: AoActAuthContextV0,
  input: DecisionEligibilityPolicyDeclarationWriteInputV1,
  declaredAt: string,
): DecisionEligibilityPolicyDeclarationV1 {
  try {
    return decisionEligibilityPolicyDeclarationV1Schema.parse({
      schema_version: "decision_eligibility_policy_declaration_v1",
      declaration_id: declarationIdV1(input.policy_id, input.policy_version),
      policy_id: input.policy_id,
      policy_version: input.policy_version,
      policy_ref: policyRefV1(input.policy_id, input.policy_version),
      scope: input.scope,
      applicable_action_types: input.applicable_action_types,
      required_criteria: input.required_criteria,
      lifecycle_semantics: input.lifecycle_semantics,
      declaration_source_type: DECISION_ELIGIBILITY_POLICY_DECLARATION_SOURCE_TYPE_V1,
      declaration_source_ref: sourceRefV1(auth),
      provenance_refs: input.provenance_refs,
      declared_at: declaredAt,
      effective_from: input.effective_from,
      effective_until: input.effective_until,
      supersedes_policy_ref: input.supersedes_policy_ref,
      limitations: input.limitations,
      authority_state: "POLICY_DECLARATION_ONLY",
    });
  } catch (error) {
    throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
      "POLICY_DECLARATION_INVALID",
      String((error as Error)?.message ?? error),
    );
  }
}

function validateStableIntentV1(
  auth: AoActAuthContextV0,
  rawInput: DecisionEligibilityPolicyDeclarationWriteInputV1,
): DecisionEligibilityPolicyDeclarationV1 {
  assertWriteInputKeysV1(rawInput as unknown as Record<string, unknown>);
  assertScopeMatchesAuthV1(auth, rawInput);

  // Structural validation for retries is intentionally independent of wall clock.
  // The real persisted declared_at is server-assigned only for a new fact.
  return buildDeclarationCandidateV1(auth, rawInput, rawInput.effective_from);
}

function stableDeclarationV1(
  declaration: DecisionEligibilityPolicyDeclarationV1,
): Omit<DecisionEligibilityPolicyDeclarationV1, "declared_at"> {
  const { declared_at: _declaredAt, ...stable } = declaration;
  return stable;
}

function stableJsonV1(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonV1).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonV1(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseExistingDeclarationV1(value: unknown): DecisionEligibilityPolicyDeclarationV1 {
  try {
    return decisionEligibilityPolicyDeclarationV1Schema.parse(value);
  } catch {
    throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
      "POLICY_REF_EXISTING_DECLARATION_INVALID",
    );
  }
}

function occurredAtStringV1(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

async function rollbackQuietlyV1(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
}

export async function appendDecisionEligibilityPolicyDeclarationFactV1(
  pool: Pool,
  auth: AoActAuthContextV0,
  rawInput: DecisionEligibilityPolicyDeclarationWriteInputV1,
  changeReason: string,
  options: { now?: () => string } = {},
): Promise<DecisionEligibilityPolicyDeclarationWriteResultV1> {
  const reason = normalizedChangeReasonV1(changeReason);
  const stableCandidate = validateStableIntentV1(auth, rawInput);
  const policyRef = stableCandidate.policy_ref;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [policyRef],
    );

    const existing = await client.query(
      `SELECT fact_id, occurred_at, record_json
         FROM facts
        WHERE record_json->>'type' = $1
          AND record_json->'payload'->>'policy_ref' = $2
        ORDER BY occurred_at ASC
        LIMIT 2`,
      [DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1, policyRef],
    );

    if (existing.rows.length > 1) {
      throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
        "POLICY_REF_AMBIGUOUS",
      );
    }

    if (existing.rows.length === 1) {
      const row = existing.rows[0] as Record<string, unknown>;
      const record = row.record_json as Record<string, unknown> | undefined;
      const existingDeclaration = parseExistingDeclarationV1(record?.payload);
      if (
        stableJsonV1(stableDeclarationV1(existingDeclaration))
        !== stableJsonV1(stableDeclarationV1(stableCandidate))
      ) {
        throw new DecisionEligibilityPolicyDeclarationWriteErrorV1(
          "POLICY_REF_CONFLICT",
        );
      }
      await client.query("COMMIT");
      return {
        created: false,
        fact_id: String(row.fact_id),
        occurred_at: occurredAtStringV1(row.occurred_at),
        declaration: existingDeclaration,
      };
    }

    const writtenAt = options.now?.() ?? new Date().toISOString();
    const declaration = buildDeclarationCandidateV1(auth, rawInput, writtenAt);
    const factId = randomUUID();
    const record: DecisionEligibilityPolicyDeclarationFactRecordV1 = {
      type: DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_TYPE_V1,
      payload: declaration,
      audit: {
        schema_version: DECISION_ELIGIBILITY_POLICY_DECLARATION_FACT_AUDIT_VERSION_V1,
        changed_by_actor_id: auth.actor_id,
        changed_by_token_id: auth.token_id,
        change_reason: reason,
        written_at: writtenAt,
      },
    };

    await client.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)",
      [
        factId,
        writtenAt,
        "api/decision_eligibility_policy_declarations/v1",
        record,
      ],
    );
    await client.query("COMMIT");

    return {
      created: true,
      fact_id: factId,
      occurred_at: writtenAt,
      declaration,
    };
  } catch (error) {
    await rollbackQuietlyV1(client);
    throw error;
  } finally {
    client.release();
  }
}
