import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireDecisionEligibilityPolicyDeclarationAuthorityV1 } from "../auth/ao_act_authz_v0.js";
import {
  appendDecisionEligibilityPolicyDeclarationFactV1,
  DecisionEligibilityPolicyDeclarationWriteErrorV1,
  type DecisionEligibilityPolicyDeclarationWriteInputV1,
} from "../domain/decision/decision_eligibility_policy_declaration_fact_v1.js";

export const DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1 =
  "/api/v1/decision-eligibility/policy-declarations";

function isRecordV1(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactBodyV1(value: unknown): {
  declaration: DecisionEligibilityPolicyDeclarationWriteInputV1;
  change_reason: string;
} {
  if (!isRecordV1(value)) throw new Error("INVALID_BODY");
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["change_reason", "declaration"])) {
    throw new Error("INVALID_BODY");
  }
  if (!isRecordV1(value.declaration)) throw new Error("INVALID_BODY");
  if (typeof value.change_reason !== "string" || !value.change_reason.trim()) {
    throw new Error("INVALID_BODY");
  }
  return {
    declaration: value.declaration as unknown as DecisionEligibilityPolicyDeclarationWriteInputV1,
    change_reason: value.change_reason,
  };
}

function statusForWriteErrorV1(code: DecisionEligibilityPolicyDeclarationWriteErrorV1["code"]): number {
  if (code === "POLICY_SCOPE_AUTH_MISMATCH") return 404;
  if (code === "POLICY_REF_CONFLICT" || code === "POLICY_REF_AMBIGUOUS") return 409;
  if (code === "POLICY_REF_EXISTING_DECLARATION_INVALID") return 500;
  return 400;
}

export function registerDecisionEligibilityPolicyDeclarationV1Routes(
  app: FastifyInstance,
  pool: Pool,
): void {
  app.post(DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1, async (req, reply) => {
    const auth = requireDecisionEligibilityPolicyDeclarationAuthorityV1(req, reply);
    if (!auth) return reply;

    let body: ReturnType<typeof exactBodyV1>;
    try {
      body = exactBodyV1(req.body);
    } catch {
      return reply.code(400).send({ ok: false, error: "INVALID_BODY" });
    }

    try {
      const result = await appendDecisionEligibilityPolicyDeclarationFactV1(
        pool,
        auth,
        body.declaration,
        body.change_reason,
      );
      return reply.code(result.created ? 201 : 200).send({
        ok: true,
        schema_version: "decision_eligibility_policy_declaration_write_response_v1",
        created: result.created,
        fact_id: result.fact_id,
        occurred_at: result.occurred_at,
        declaration: result.declaration,
      });
    } catch (error) {
      if (error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1) {
        const status = statusForWriteErrorV1(error.code);
        return reply.code(status).send({ ok: false, error: error.code });
      }
      throw error;
    }
  });
}
