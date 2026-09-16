import Fastify from "fastify";

import {
  prepareInternalTaskIssuerPrincipalV1,
  resolveInternalTaskIssuerPrincipalV1,
} from "../../apps/server/src/auth/internal_task_issuer_principal_v1.js";
import {
  requireAoActScopeV0,
  type AoActScopeV0,
} from "../../apps/server/src/auth/ao_act_authz_v0.js";
import { registerApprovalRequestV1Routes } from "../../apps/server/src/routes/control_approval_request_v1.js";

const ENV_KEYS = [
  "GEOX_RUNTIME_ENV",
  "GEOX_TOKENS_JSON",
  "GEOX_TOKENS_FILE",
  "GEOX_TOKEN_SSOT_PATH",
  "GEOX_TOKEN",
  "GEOX_AO_ACT_TOKEN",
  "AO_ACT_TOKEN",
  "GEOX_INTERNAL_TASK_ISSUER_TOKEN",
  "GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID",
] as const;
const savedEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv(): void {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function expect(condition: unknown, message: string, details?: unknown): asserts condition {
  if (!condition) throw new Error(message + (details === undefined ? "" : `: ${JSON.stringify(details)}`));
}

function tokenRecord(input: {
  token: string;
  token_id: string;
  actor_id: string;
  role: string;
  scopes: string[];
  revoked?: boolean;
}) {
  return {
    token: input.token,
    token_id: input.token_id,
    actor_id: input.actor_id,
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    role: input.role,
    revoked: input.revoked === true,
    allowed_field_ids: [],
    scopes: input.scopes,
  };
}

const exactIssuer = tokenRecord({
  token: "w6b1_internal_exact",
  token_id: "tok_internal_task_issuer_v1",
  actor_id: "svc_internal_task_issuer_v1",
  role: "operator",
  scopes: ["action.task.create"],
});
const broadOperator = tokenRecord({
  token: "w6b1_broad_operator",
  token_id: "tok_w6b1_broad_operator",
  actor_id: "w6b1_broad_operator_actor",
  role: "operator",
  scopes: ["action.task.create", "action.task.dispatch", "action.receipt.submit"],
});
const adminTaskOnly = tokenRecord({
  token: "w6b1_admin_task_only",
  token_id: "tok_w6b1_admin_task_only",
  actor_id: "w6b1_admin_actor",
  role: "admin",
  scopes: ["action.task.create"],
});
const revokedIssuer = tokenRecord({
  token: "w6b1_revoked_internal",
  token_id: "tok_w6b1_revoked_internal",
  actor_id: "w6b1_revoked_internal_actor",
  role: "operator",
  scopes: ["action.task.create"],
  revoked: true,
});
const approver = tokenRecord({
  token: "w6b1_approver",
  token_id: "tok_w6b1_approver",
  actor_id: "w6b1_approver_actor",
  role: "approver",
  scopes: ["approval.decide"],
});

const TOKEN_SOURCE = [exactIssuer, broadOperator, adminTaskOnly, revokedIssuer, approver];

function setTokenSource(): void {
  process.env.GEOX_RUNTIME_ENV = "test";
  process.env.GEOX_TOKENS_JSON = JSON.stringify({ version: "ao_act_tokens_v0", tokens: TOKEN_SOURCE });
  delete process.env.GEOX_TOKENS_FILE;
  delete process.env.GEOX_TOKEN_SSOT_PATH;
  delete process.env.GEOX_TOKEN;
  delete process.env.GEOX_AO_ACT_TOKEN;
  delete process.env.AO_ACT_TOKEN;
}

function expectIssuerError(expected: string, fn: () => unknown): void {
  let actual = "";
  try {
    fn();
  } catch (error: any) {
    actual = String(error?.message ?? error);
  }
  expect(actual === expected, `expected ${expected}`, { actual });
}

async function provePrincipalSelection(): Promise<Record<string, unknown>> {
  setTokenSource();
  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = exactIssuer.token_id;
  delete process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN;

  const resolved = resolveInternalTaskIssuerPrincipalV1();
  expect(resolved.token_id === exactIssuer.token_id, "dedicated token_id not selected", resolved);
  expect(resolved.actor_id === exactIssuer.actor_id, "dedicated actor_id not selected", resolved);
  expect(resolved.role === "operator", "dedicated issuer role drift", resolved);
  expect(JSON.stringify(resolved.scopes) === JSON.stringify(["action.task.create"]), "dedicated issuer scope drift", resolved);

  const prepared = prepareInternalTaskIssuerPrincipalV1();
  expect(process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN === `Bearer ${exactIssuer.token}`, "prepared bearer secret drift");
  expect(prepared.token_id === exactIssuer.token_id, "prepared principal drift");

  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = broadOperator.token_id;
  delete process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN;
  expectIssuerError("INTERNAL_TASK_ISSUER_SCOPE_INVALID", () => resolveInternalTaskIssuerPrincipalV1());

  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = adminTaskOnly.token_id;
  expectIssuerError("INTERNAL_TASK_ISSUER_ROLE_INVALID", () => resolveInternalTaskIssuerPrincipalV1());

  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = "tok_missing_internal_issuer";
  expectIssuerError("INTERNAL_TASK_ISSUER_PRINCIPAL_UNKNOWN", () => resolveInternalTaskIssuerPrincipalV1());

  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = revokedIssuer.token_id;
  expectIssuerError("INTERNAL_TASK_ISSUER_PRINCIPAL_REVOKED", () => resolveInternalTaskIssuerPrincipalV1());

  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = exactIssuer.token_id;
  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN = broadOperator.token;
  expectIssuerError("INTERNAL_TASK_ISSUER_TOKEN_ID_SECRET_MISMATCH", () => resolveInternalTaskIssuerPrincipalV1());

  delete process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN;
  return {
    exact_token_id: exactIssuer.token_id,
    exact_actor_id: exactIssuer.actor_id,
    exact_role: resolved.role,
    exact_scopes: resolved.scopes,
    broad_operator_rejected: true,
    admin_rejected: true,
    unknown_rejected: true,
    revoked_rejected: true,
    token_id_secret_mismatch_rejected: true,
  };
}

async function proveDedicatedScopeCeiling(): Promise<Record<string, number>> {
  setTokenSource();
  const app = Fastify({ logger: false });
  const scopes: AoActScopeV0[] = [
    "action.task.create",
    "approval.decide",
    "action.task.dispatch",
    "action.receipt.submit",
    "acceptance.evaluate",
    "telemetry.write",
    "inspection.write",
  ];
  for (const [index, scope] of scopes.entries()) {
    app.post(`/probe/${index}`, async (req, reply) => {
      const auth = requireAoActScopeV0(req, reply, scope);
      if (!auth) return reply;
      return reply.send({ ok: true, actor_id: auth.actor_id, token_id: auth.token_id, scope });
    });
  }
  await app.ready();
  const statuses: Record<string, number> = {};
  for (const [index, scope] of scopes.entries()) {
    const response = await app.inject({
      method: "POST",
      url: `/probe/${index}`,
      headers: { authorization: `Bearer ${exactIssuer.token}` },
    });
    statuses[scope] = response.statusCode;
    if (scope === "action.task.create") {
      expect(response.statusCode === 200, "dedicated issuer lost action.task.create", { scope, status: response.statusCode, body: response.body });
    } else {
      const body = response.json() as any;
      expect(response.statusCode === 403 && body?.error === "AUTH_SCOPE_DENIED", "dedicated issuer exceeded scope ceiling", { scope, status: response.statusCode, body });
    }
  }
  await app.close();
  return statuses;
}

class ApprovalPoolStub {
  public inserts: any[] = [];

  async query(sql: any, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const text = String(sql);
    if (text.includes("(record_json::jsonb->>'type') = 'approval_request_v1'") && text.includes("request_id")) {
      return {
        rows: [{
          fact_id: "fact_apr_w6b1",
          record_json: {
            type: "approval_request_v1",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              request_id: "apr_w6b1",
              status: "PENDING",
              requested_by_actor_id: "w6b1_requester_actor",
              requested_by_token_id: "tok_w6b1_requester",
              field_id: "field_w6b1",
              season_id: "season_w6b1",
              proposal: {
                action_type: "IRRIGATE",
                target: "field:field_w6b1",
                time_window: { start_ts: 1, end_ts: 2 },
                parameters: { duration_sec: 30 },
                constraints: {},
                meta: {
                  allow_auto_task_issue: true,
                  field_id: "field_w6b1",
                  season_id: "season_w6b1",
                },
              },
            },
          },
        }],
        rowCount: 1,
      };
    }
    if (text.includes("(record_json::jsonb->>'type')='operation_plan_v1'") && text.includes("operation_plan_id")) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("INSERT INTO public.operation_plan_index_v1")) {
      return {
        rows: [{
          operation_plan_id: String(params[0]),
          tenant_id: String(params[1]),
          project_id: String(params[2]),
          group_id: String(params[3]),
          field_id: params[4] ?? null,
          zone_id: params[5] ?? null,
          spatial_scope_json: params[6] ? JSON.parse(String(params[6])) : null,
          season_id: params[7] ?? null,
          program_id: params[8] ?? null,
          recommendation_id: params[9] ?? null,
          recommendation_fact_id: params[10] ?? null,
          approval_request_id: params[11] ?? null,
          approval_decision: params[12] ?? null,
          approval_decision_fact_id: params[13] ?? null,
          status: String(params[14]),
          act_task_id: params[15] ?? null,
          receipt_fact_id: params[16] ?? null,
          source_fact_id: params[17] ?? null,
          created_ts: Number(params[18]),
          updated_ts: Number(params[19]),
        }],
        rowCount: 1,
      };
    }
    if (text.includes("INSERT INTO facts")) {
      this.inserts.push(params[2] ?? null);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }

  async connect() {
    return { query: this.query.bind(this), release: () => undefined };
  }
}

async function proveApprovalIssuerSeparation(): Promise<Record<string, unknown>> {
  setTokenSource();
  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID = exactIssuer.token_id;
  delete process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN;
  prepareInternalTaskIssuerPrincipalV1();

  const pool = new ApprovalPoolStub();
  const app = Fastify({ logger: false });
  registerApprovalRequestV1Routes(app, pool as any);
  await app.ready();

  const originalFetch = global.fetch;
  let capturedAuthorization = "";
  let capturedTaskBody: any = null;
  global.fetch = (async (input: any, init?: any) => {
    if (String(input).includes("/api/v1/actions/task")) {
      capturedAuthorization = String(init?.headers?.authorization ?? init?.headers?.Authorization ?? "");
      capturedTaskBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ ok: true, act_task_id: "act_w6b1", fact_id: "fact_act_w6b1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as any;

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/approvals/approve",
      headers: { authorization: `Bearer ${approver.token}`, "content-type": "application/json" },
      payload: { request_id: "apr_w6b1" },
    });
    const body = response.json() as any;
    expect(response.statusCode === 200, "approval auto-task proof failed", { status: response.statusCode, body });
    expect(body?.act_task_id === "act_w6b1", "approval did not receive task identity", body);
    expect(capturedAuthorization === `Bearer ${exactIssuer.token}`, "approval subrequest did not use dedicated service credential", { capturedAuthorization });
    expect(capturedTaskBody?.issuer?.id === approver.actor_id, "business issuer no longer preserves approving human actor", capturedTaskBody?.issuer);
    expect(capturedTaskBody?.issuer?.namespace === "approval_request_v1", "business issuer namespace drift", capturedTaskBody?.issuer);
    expect(capturedTaskBody?.operation_plan_id === "opl_apr_w6b1", "operation plan linkage drift", capturedTaskBody);
    return {
      approval_status: response.statusCode,
      task_id: body.act_task_id,
      authenticated_internal_writer_actor_id: exactIssuer.actor_id,
      authenticated_internal_writer_token_id: exactIssuer.token_id,
      business_issuer_actor_id: capturedTaskBody?.issuer?.id,
      business_issuer_namespace: capturedTaskBody?.issuer?.namespace,
      credential_separated: exactIssuer.actor_id !== approver.actor_id,
    };
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
}

async function main(): Promise<void> {
  const principalSelection = await provePrincipalSelection();
  const scopeCeiling = await proveDedicatedScopeCeiling();
  const approvalIssuerSeparation = await proveApprovalIssuerSeparation();
  console.log(JSON.stringify({
    result: "PASS",
    workstream: "W6_B1_INTERNAL_TASK_ISSUER_PRINCIPAL_BOUNDARY",
    principal_selection: principalSelection,
    scope_ceiling_statuses: scopeCeiling,
    approval_issuer_separation: approvalIssuerSeparation,
    new_roles: 0,
    new_scopes: 0,
    mcft_delta: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(restoreEnv);
