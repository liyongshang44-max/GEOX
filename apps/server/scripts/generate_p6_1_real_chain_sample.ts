import { randomUUID } from "node:crypto";
import { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FactInput = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: Record<string, unknown>;
};

function isoAt(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

async function insertFact(pool: Pool, fact: FactInput): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact.fact_id, fact.occurred_at, fact.source, JSON.stringify(fact.record_json)],
  );
}

async function seedSuccessChain(pool: Pool, tenant: TenantTriple): Promise<{ operation_plan_id: string; act_task_id: string }> {
  const operation_plan_id = `op_p6_1_success_${Date.now()}`;
  const recommendation_id = `rec_p6_1_${Date.now()}`;
  const approval_request_id = `apr_p6_1_${Date.now()}`;
  const approval_decision_id = `apd_p6_1_${Date.now()}`;
  const act_task_id = `task_p6_1_${Date.now()}`;
  const receipt_id = `receipt_p6_1_${Date.now()}`;
  const source = "p6_1_real_chain";

  const shared = {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
  };

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-6),
    source,
    record_json: {
      type: "decision_recommendation_v1",
      payload: {
        ...shared,
        recommendation_id,
        field_id: "field_c8_demo",
        device_id: "dev_onboard_accept_001",
        program_id: "program_demo_p6_1",
        season_id: "season_demo_2026",
        suggested_action: { action_type: "IRRIGATE" },
        status: "PROPOSED",
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-5),
    source,
    record_json: {
      type: "approval_request_v1",
      payload: {
        ...shared,
        request_id: approval_request_id,
        recommendation_id,
        status: "PENDING",
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-4),
    source,
    record_json: {
      type: "approval_decision_v1",
      payload: {
        ...shared,
        request_id: approval_request_id,
        decision_id: approval_decision_id,
        decision: "APPROVED",
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-3),
    source,
    record_json: {
      type: "operation_plan_v1",
      payload: {
        ...shared,
        operation_plan_id,
        recommendation_id,
        approval_request_id,
        act_task_id,
        field_id: "field_c8_demo",
        device_id: "dev_onboard_accept_001",
        action_type: "IRRIGATE",
        status: "READY",
      },
    },
  });

  for (const [offset, status] of [[-3, "READY"], [-2, "DISPATCHED"], [-1, "SUCCEEDED"]] as const) {
    await insertFact(pool, {
      fact_id: `fact_${randomUUID()}`,
      occurred_at: isoAt(offset),
      source,
      record_json: {
        type: "operation_plan_transition_v1",
        payload: {
          ...shared,
          operation_plan_id,
          status,
        },
      },
    });
  }

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-2),
    source,
    record_json: {
      type: "ao_act_task_v0",
      payload: {
        ...shared,
        act_task_id,
        action_type: "IRRIGATE",
        meta: { device_id: "dev_onboard_accept_001", field_id: "field_c8_demo" },
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-1),
    source,
    record_json: {
      type: "ao_act_receipt_v1",
      payload: {
        ...shared,
        operation_plan_id,
        act_task_id,
        receipt_id,
        status: "executed",
        water_l: 1250,
        electric_kwh: 18,
        chemical_ml: 0,
        evidence_artifact_ids: ["artifact_p6_1_image"],
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-1),
    source,
    record_json: {
      type: "evidence_artifact_v1",
      payload: {
        ...shared,
        operation_plan_id,
        act_task_id,
        artifact_id: "artifact_p6_1_image",
        kind: "image/jpeg",
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(0),
    source,
    record_json: {
      type: "acceptance_result_v1",
      payload: {
        ...shared,
        operation_plan_id,
        act_task_id,
        verdict: "PASS",
        missing_evidence: [],
        generated_at: isoAt(0),
      },
    },
  });

  return { operation_plan_id, act_task_id };
}

async function seedInvalidChain(pool: Pool, tenant: TenantTriple): Promise<void> {
  const operation_plan_id = `op_p6_1_invalid_${Date.now()}`;
  const act_task_id = `task_p6_1_invalid_${Date.now()}`;
  const source = "p6_1_real_chain";
  const shared = {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
  };

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-3),
    source,
    record_json: {
      type: "operation_plan_v1",
      payload: {
        ...shared,
        operation_plan_id,
        act_task_id,
        field_id: "field_c8_demo",
        device_id: "dev_onboard_accept_001",
        action_type: "IRRIGATE",
        status: "READY",
      },
    },
  });

  await insertFact(pool, {
    fact_id: `fact_${randomUUID()}`,
    occurred_at: isoAt(-2),
    source,
    record_json: {
      type: "ao_act_receipt_v1",
      payload: {
        ...shared,
        operation_plan_id,
        act_task_id,
        status: "executed",
      },
    },
  });
}

async function main(): Promise<void> {
  const tenant: TenantTriple = {
    tenant_id: process.env.P6_1_TENANT_ID ?? "tenantA",
    project_id: process.env.P6_1_PROJECT_ID ?? "P_DEFAULT",
    group_id: process.env.P6_1_GROUP_ID ?? "G_DEFAULT",
  };

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const success = await seedSuccessChain(pool, tenant);
    await seedInvalidChain(pool, tenant);
    console.log(JSON.stringify({ ok: true, tenant, success }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
