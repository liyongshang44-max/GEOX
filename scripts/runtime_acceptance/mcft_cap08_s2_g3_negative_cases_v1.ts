// scripts/runtime_acceptance/mcft_cap08_s2_g3_negative_cases_v1.ts
// Purpose: execute the frozen CAP-08 completion-authority N1-N14 matrix against one completed disposable PostgreSQL graph.
// Boundary: destructive acceptance mutation with exact restoration only; no production database, retained corruption, route, scheduler, S2 candidate, or S3 claim.

import {
  admin,
  assert,
  cloneV1,
  invariantSnapshotV1,
  scopeValuesV1,
  type InspectCap08CompletionAuthorityInputV1,
  type Cap08CompletionAuthorityServiceV1,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";

type NegativeCaseResultV1 = {
  case_id: string;
  mutation: string;
  expected_error: string;
  observed_error: string;
  status: "PASS";
  restored_invariant_delta: 0;
};

type NegativeContextV1 = {
  completionService: Cap08CompletionAuthorityServiceV1;
  inspectInput: InspectCap08CompletionAuthorityInputV1;
  authorityRef: string;
  originalAuthority: Record<string, any>;
  terminalCheckpointFact: Record<string, any>;
  previousCheckpointRef: string;
  previousCheckpointFact: Record<string, any>;
  previousTickRef: string;
  originalCheckpointPointer: Record<string, any>;
  terminalForecastFact: Record<string, any>;
  earlyScenarioFact: Record<string, any>;
  lineageFact: Record<string, any>;
  fixture: { scope: InspectCap08CompletionAuthorityInputV1["scope"] };
};

async function expectErrorV1(
  action: () => Promise<unknown>,
  expected: string,
): Promise<string> {
  try {
    await action();
  } catch (error) {
    const observed = error instanceof Error ? error.message : String(error);
    assert.equal(observed, expected);
    return observed;
  }
  throw new Error(`NEGATIVE_CASE_DID_NOT_FAIL:${expected}`);
}

async function caseV1(input: {
  case_id: string;
  mutation: string;
  expected_error: string;
  action: () => Promise<unknown>;
  mutate?: () => Promise<void>;
  restore?: () => Promise<void>;
}): Promise<NegativeCaseResultV1> {
  const before = await invariantSnapshotV1();
  let observed = "";
  try {
    await input.mutate?.();
    observed = await expectErrorV1(input.action, input.expected_error);
  } finally {
    await input.restore?.();
  }
  const after = await invariantSnapshotV1();
  assert.deepEqual(after, before, `${input.case_id}_RESTORED_INVARIANT_MISMATCH`);
  return {
    case_id: input.case_id,
    mutation: input.mutation,
    expected_error: input.expected_error,
    observed_error: observed,
    status: "PASS",
    restored_invariant_delta: 0,
  };
}

function authorityPayloadV1(context: NegativeContextV1): Record<string, any> {
  return cloneV1(context.originalAuthority.semantic_payload as Record<string, any>);
}

async function writeAuthorityPayloadV1(context: NegativeContextV1, payload: Record<string, any>): Promise<void> {
  await admin.query(
    `UPDATE twin_runtime_authority_snapshot_v1
        SET semantic_payload=$1::jsonb
      WHERE authority_kind=$2 AND authority_ref=$3`,
    [JSON.stringify(payload), context.originalAuthority.authority_kind, context.authorityRef],
  );
}

async function restoreAuthorityV1(context: NegativeContextV1): Promise<void> {
  await admin.query(
    `UPDATE twin_runtime_authority_snapshot_v1
        SET authority_ref=$1,determinism_hash=$2,semantic_payload=$3::jsonb
      WHERE authority_kind=$4
        AND (authority_ref=$1 OR semantic_payload->>'schema_version'='geox_mcft_cap08_completion_authority_v1')`,
    [
      context.authorityRef,
      context.originalAuthority.determinism_hash,
      JSON.stringify(context.originalAuthority.semantic_payload),
      context.originalAuthority.authority_kind,
    ],
  );
}

function pointerWhereV1(): string {
  return "tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6";
}

export async function runNegativeCasesV1(context: NegativeContextV1): Promise<NegativeCaseResultV1[]> {
  const results: NegativeCaseResultV1[] = [];
  const inspect = (override: Partial<InspectCap08CompletionAuthorityInputV1> = {}) => context.completionService.inspect({
    ...context.inspectInput,
    ...override,
    scope: override.scope ? cloneV1(override.scope) : cloneV1(context.inspectInput.scope),
  });

  results.push(await caseV1({
    case_id: "N1",
    mutation: "WRONG_FORMAL_RUN_ID",
    expected_error: "CAP08_COMPLETION_FORMAL_RUN_MISMATCH",
    action: () => inspect({ formal_run_id: `${context.inspectInput.formal_run_id}_wrong` }),
  }));

  results.push(await caseV1({
    case_id: "N2",
    mutation: "WRONG_FIELD_ID",
    expected_error: "CAP08_COMPLETION_SCOPE_MISMATCH",
    mutate: async () => {
      const payload = authorityPayloadV1(context);
      payload.scope.field_id = `${payload.scope.field_id}_wrong`;
      await writeAuthorityPayloadV1(context, payload);
    },
    action: () => inspect(),
    restore: () => restoreAuthorityV1(context),
  }));

  results.push(await caseV1({
    case_id: "N3",
    mutation: "WRONG_SEASON_OR_ZONE",
    expected_error: "CAP08_COMPLETION_SCOPE_MISMATCH",
    mutate: async () => {
      const payload = authorityPayloadV1(context);
      payload.scope.zone_id = `${payload.scope.zone_id}_wrong`;
      await writeAuthorityPayloadV1(context, payload);
    },
    action: () => inspect(),
    restore: () => restoreAuthorityV1(context),
  }));

  results.push(await caseV1({
    case_id: "N4",
    mutation: "WRONG_LINEAGE_ID",
    expected_error: "CAP08_COMPLETION_LINEAGE_MISMATCH",
    mutate: async () => {
      const payload = authorityPayloadV1(context);
      payload.lineage_id = `${payload.lineage_id}_wrong`;
      await writeAuthorityPayloadV1(context, payload);
    },
    action: () => inspect(),
    restore: () => restoreAuthorityV1(context),
  }));

  results.push(await caseV1({
    case_id: "N5",
    mutation: "WRONG_REVISION_ID",
    expected_error: "CAP08_COMPLETION_REVISION_MISMATCH",
    mutate: async () => {
      const payload = authorityPayloadV1(context);
      payload.revision_id = `${payload.revision_id}_wrong`;
      await writeAuthorityPayloadV1(context, payload);
    },
    action: () => inspect(),
    restore: () => restoreAuthorityV1(context),
  }));

  results.push(await caseV1({
    case_id: "N6",
    mutation: "T24_STALE_CHECKPOINT_WITHOUT_COMPLETE_T23_GRAPH",
    expected_error: "CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE",
    mutate: async () => {
      await admin.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1 SET determinism_hash=$7 WHERE ${pointerWhereV1()}`,
        [...scopeValuesV1(context.fixture.scope), `sha256:${"0".repeat(64)}`],
      );
    },
    action: () => inspect(),
    restore: async () => {
      await admin.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1 SET determinism_hash=$7 WHERE ${pointerWhereV1()}`,
        [...scopeValuesV1(context.fixture.scope), context.originalCheckpointPointer.determinism_hash],
      );
    },
  }));

  results.push(await caseV1({
    case_id: "N7",
    mutation: "SAME_SCOPE_COMPLETED_BY_FOREIGN_FORMAL_RUN",
    expected_error: "CAP08_COMPLETION_FOREIGN_RUN",
    mutate: async () => {
      await admin.query(
        `UPDATE twin_runtime_authority_snapshot_v1
            SET authority_ref=$1
          WHERE authority_kind=$2 AND authority_ref=$3`,
        [`${context.authorityRef}_foreign`, context.originalAuthority.authority_kind, context.authorityRef],
      );
    },
    action: () => inspect(),
    restore: () => restoreAuthorityV1(context),
  }));

  results.push(await caseV1({
    case_id: "N8",
    mutation: "PHASE_CONTRACT_DIGEST_MISMATCH_ONLY",
    expected_error: "CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH",
    action: () => inspect({ phase_engine_contract_digest: `sha256:${"1".repeat(64)}` }),
  }));

  results.push(await caseV1({
    case_id: "N9",
    mutation: "PHASE_SOURCE_DIGEST_MISMATCH_ONLY",
    expected_error: "CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH",
    action: () => inspect({ phase_engine_source_digest: `sha256:${"2".repeat(64)}` }),
  }));

  results.push(await caseV1({
    case_id: "N10",
    mutation: "PHASE_CONTRACT_AND_SOURCE_DIGEST_MISMATCH",
    expected_error: "CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH",
    action: () => inspect({
      phase_engine_contract_digest: `sha256:${"3".repeat(64)}`,
      phase_engine_source_digest: `sha256:${"4".repeat(64)}`,
    }),
  }));

  const previousEnvelope = context.previousCheckpointFact.record_json.payload as Record<string, any>;
  results.push(await caseV1({
    case_id: "N11",
    mutation: "LATEST_POINTER_REFERENCES_NONTERMINAL_TICK",
    expected_error: "CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE",
    mutate: async () => {
      await admin.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1
            SET checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,
                determinism_hash=$11,source_fact_id=$12
          WHERE ${pointerWhereV1()}`,
        [
          ...scopeValuesV1(context.fixture.scope),
          context.previousCheckpointRef,
          previousEnvelope.lineage_id,
          previousEnvelope.revision_id,
          previousEnvelope.logical_time,
          previousEnvelope.determinism_hash,
          context.previousCheckpointFact.fact_id,
        ],
      );
    },
    action: () => inspect(),
    restore: async () => {
      const row = context.originalCheckpointPointer;
      await admin.query(
        `UPDATE twin_runtime_checkpoint_latest_index_v1
            SET checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,
                determinism_hash=$11,source_fact_id=$12
          WHERE ${pointerWhereV1()}`,
        [
          ...scopeValuesV1(context.fixture.scope),
          row.checkpoint_object_id,
          row.lineage_id,
          row.revision_id,
          row.logical_time,
          row.determinism_hash,
          row.source_fact_id,
        ],
      );
    },
  }));

  const statePointer = (await admin.query(
    `SELECT to_jsonb(t) AS row FROM twin_state_latest_index_v1 t WHERE ${pointerWhereV1()}`,
    scopeValuesV1(context.fixture.scope),
  )).rows[0].row as Record<string, any>;
  results.push(await caseV1({
    case_id: "N12",
    mutation: "CHECKPOINT_STATE_FORECAST_CROSS_LINEAGE",
    expected_error: "CAP08_COMPLETION_LINEAGE_MISMATCH",
    mutate: async () => {
      await admin.query(
        `UPDATE twin_state_latest_index_v1 SET lineage_id=$7 WHERE ${pointerWhereV1()}`,
        [...scopeValuesV1(context.fixture.scope), `${statePointer.lineage_id}_foreign`],
      );
    },
    action: () => inspect(),
    restore: async () => {
      await admin.query(
        `UPDATE twin_state_latest_index_v1 SET lineage_id=$7 WHERE ${pointerWhereV1()}`,
        [...scopeValuesV1(context.fixture.scope), statePointer.lineage_id],
      );
    },
  }));

  const earlyScenarioObjectId = String(context.earlyScenarioFact.record_json.payload.object_id);
  const scenarioProjection = (await admin.query(
    "SELECT to_jsonb(t) AS row FROM twin_scenario_set_projection_v1 t WHERE scenario_set_id=$1",
    [earlyScenarioObjectId],
  )).rows[0]?.row as Record<string, any> | undefined;
  assert.ok(scenarioProjection, "N13_SCENARIO_PROJECTION_REQUIRED");
  results.push(await caseV1({
    case_id: "N13",
    mutation: "TICK_COMPLETE_SCENARIO_CARDINALITY_23",
    expected_error: "CAP08_COMPLETION_CARDINALITY_MISMATCH",
    mutate: async () => {
      await admin.query("DELETE FROM twin_scenario_set_projection_v1 WHERE scenario_set_id=$1", [earlyScenarioObjectId]);
    },
    action: () => inspect(),
    restore: async () => {
      await admin.query(
        "INSERT INTO twin_scenario_set_projection_v1 SELECT * FROM jsonb_populate_record(NULL::twin_scenario_set_projection_v1,$1::jsonb)",
        [JSON.stringify(scenarioProjection)],
      );
    },
  }));

  const originalLineageRecord = cloneV1(context.lineageFact.record_json as Record<string, any>);
  const foreignLineageRecord = cloneV1(originalLineageRecord);
  const originalLineageEnvelope = foreignLineageRecord.payload as Record<string, any>;
  originalLineageEnvelope.object_id = `${originalLineageEnvelope.object_id}_n14`;
  originalLineageEnvelope.lineage_id = `${originalLineageEnvelope.lineage_id}_n14`;
  originalLineageEnvelope.idempotency_key = `${originalLineageEnvelope.idempotency_key}_n14`;
  const foreignFactId = `${context.lineageFact.fact_id}_n14`;
  const lineageTime = (await admin.query("SELECT occurred_at FROM facts WHERE fact_id=$1", [context.lineageFact.fact_id])).rows[0].occurred_at;
  results.push(await caseV1({
    case_id: "N14",
    mutation: "SECOND_ACTIVE_LINEAGE_SAME_SCOPE",
    expected_error: "CAP08_COMPLETION_LINEAGE_MISMATCH",
    mutate: async () => {
      const client = await admin.connect();
      try {
        await client.query("SET session_replication_role='replica'");
        try {
          await client.query(
            "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
            [foreignFactId, lineageTime, JSON.stringify(foreignLineageRecord)],
          );
        } finally {
          await client.query("SET session_replication_role='origin'");
        }
      } finally {
        client.release();
      }
    },
    action: () => inspect(),
    restore: async () => {
      const client = await admin.connect();
      try {
        await client.query("SET session_replication_role='replica'");
        try {
          await client.query("DELETE FROM facts WHERE fact_id=$1", [foreignFactId]);
        } finally {
          await client.query("SET session_replication_role='origin'");
        }
      } finally {
        client.release();
      }
    },
  }));

  assert.equal(results.length, 14);
  assert.deepEqual(results.map((entry) => entry.case_id), Array.from({ length: 14 }, (_, index) => `N${index + 1}`));
  return results;
}
