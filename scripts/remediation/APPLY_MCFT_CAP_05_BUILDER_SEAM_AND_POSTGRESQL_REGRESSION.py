# scripts/remediation/APPLY_MCFT_CAP_05_BUILDER_SEAM_AND_POSTGRESQL_REGRESSION.py
# Purpose: deterministically apply the remaining canonical-envelope/execution-payload separation to CAP-04 builders and attach the permanent CAP-05 PostgreSQL runner regression to the repository acceptance entrypoint.
# Boundary: source transformation only; no repository push, database access, Runtime execution, canonical write, active binding, Model Activation, calibration, CAP-06 Runtime authority, or migration authority.

from pathlib import Path
import re


def replace_once(path_text: str, old: str, new: str) -> None:
    path = Path(path_text)
    text = path.read_text()
    if new and new in text:
        return
    if old not in text:
        raise SystemExit(f"PATCH_MARKER_NOT_FOUND:{path_text}")
    path.write_text(text.replace(old, new, 1))


state_builder = "apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts"
replace_once(
    state_builder,
    'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
    'import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
)
replace_once(
    state_builder,
    '''  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV2;''',
    '''  runtime_config: CanonicalObjectEnvelopeV1;
  execution_config_payload?: Cap04RuntimeConfigPayloadV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV2;''',
)
replace_once(
    state_builder,
    '''  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SOURCE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "CAP04_SOURCE_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateCap04RuntimeConfigPayloadV1(input.runtime_config.payload);
  const config = input.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;''',
    '''  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SOURCE_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "CAP04_SOURCE_RUNTIME_CONFIG_SCOPE_MISMATCH");
  const executionPayload = input.execution_config_payload ?? input.runtime_config.payload;
  validateCap04RuntimeConfigPayloadV1(executionPayload);
  const config = structuredClone(executionPayload) as unknown as Cap04RuntimeConfigPayloadV1;''',
)

record_builder = "apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts"
replace_once(
    record_builder,
    'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
    'import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
)
replace_once(
    record_builder,
    '''  runtime_config: CanonicalObjectEnvelopeV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;''',
    '''  runtime_config: CanonicalObjectEnvelopeV1;
  execution_config_payload?: Cap04RuntimeConfigPayloadV1;
  source_members: Cap04ARecordSetBuilderSourceMembersV1;''',
)
replace_once(
    record_builder,
    '''  const config = input.runtime_config;
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(config, input.scope, "CAP04_BUILDER_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (config.logical_time !== input.logical_time || config.as_of !== input.logical_time) {
    throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH");
  }
  validateCap04RuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;''',
    '''  const config = input.runtime_config;
  validateCanonicalObjectV1(config);
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(config, input.scope, "CAP04_BUILDER_RUNTIME_CONFIG_SCOPE_MISMATCH");
  if (config.logical_time !== input.logical_time || config.as_of !== input.logical_time) {
    throw new Error("CAP04_BUILDER_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH");
  }
  const executionPayload = input.execution_config_payload ?? config.payload;
  validateCap04RuntimeConfigPayloadV1(executionPayload);
  const payload = structuredClone(executionPayload) as unknown as Cap04RuntimeConfigPayloadV1;''',
)

service = "apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts"
replace_once(
    service,
    '''        runtime_config: runtimeConfig,
        evidence_window: evidenceWindow,''',
    '''        runtime_config: runtimeConfig,
        execution_config_payload: config,
        evidence_window: evidenceWindow,''',
)
text = Path(service).read_text()
pattern = re.compile(
    r"(?P<indent>\s+)runtime_config: runtimeConfig,\n(?P=indent)source_members: sources,",
)
text, count = pattern.subn(
    lambda match: (
        f"{match.group('indent')}runtime_config: runtimeConfig,\n"
        f"{match.group('indent')}execution_config_payload: config,\n"
        f"{match.group('indent')}source_members: sources,"
    ),
    text,
)
if count != 4:
    raise SystemExit(f"CAP04_RECORD_BUILDER_CALL_COUNT_MISMATCH:{count}")
Path(service).write_text(text)

acceptance_runner = "scripts/acceptance/run_acceptance.cjs"
replace_once(
    acceptance_runner,
    '''    {
      id: 'RUNTIME_OPENAPI_SALES_CRITICAL',
      pnpmArgs: ['run', 'ci:governance:runtime-openapi-sales-critical'],
      logFile: 'RUNTIME_OPENAPI_SALES_CRITICAL.log',
      notes: 'Fetches runtime /api/v1/openapi.json and validates sales-critical OpenAPI JSON paths, schemas, operations, security, responses, and x-geox-governance.'
    }
  ],''',
    '''    {
      id: 'RUNTIME_OPENAPI_SALES_CRITICAL',
      pnpmArgs: ['run', 'ci:governance:runtime-openapi-sales-critical'],
      logFile: 'RUNTIME_OPENAPI_SALES_CRITICAL.log',
      notes: 'Fetches runtime /api/v1/openapi.json and validates sales-critical OpenAPI JSON paths, schemas, operations, security, responses, and x-geox-governance.'
    },
    {
      id: 'MCFT_CAP_05_POST_CLOSURE_CONFORMANCE_GOVERNANCE',
      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION.cjs',
      logFile: 'MCFT_CAP_05_POST_CLOSURE_CONFORMANCE_GOVERNANCE.log',
      notes: 'Verifies append-only CAP-05 defect authority and non-canonical execution-view separation.'
    },
    {
      id: 'MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER',
      command: 'pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts',
      logFile: 'MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.log',
      notes: 'Reproduces checkpoint 72 to 80 in an isolated database and verifies canonical CAP-05 Config pins, restart recovery, and zero-write replay.'
    }
  ],''',
)

postgresql_acceptance = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts"
postgresql_text = Path(postgresql_acceptance).read_text()
standard_feedback_pattern = re.compile(
    r"async function establishStandardFeedbackPathV1\(pool: Pool\): Promise<void> \{.*?\n\}\n\nfunction parseRunnerOutputV1",
    re.DOTALL,
)
standard_feedback_replacement = '''async function seedReplayEvidenceV1(
  pool: Pool,
  record: Record<string, unknown>,
): Promise<void> {
  const identity = String(record.evidence_identity_key ?? record.source_record_id);
  const digest = semanticHashV1(identity).replace(/^sha256:/, "").slice(0, 32);
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_post_closure_replay_evidence_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      `fact_mcft_cap05_post_closure_${digest}`,
      record.available_to_runtime_at,
      JSON.stringify({ type: record.record_type, payload: record }),
    ],
  );
}

async function establishStandardFeedbackPathV1(pool: Pool): Promise<void> {
  const feedbackRoot = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
  const readSingleEvidenceV1 = <T>(filename: string): T => {
    const records = fs.readFileSync(path.join(feedbackRoot, filename), "utf8")
      .split(String.fromCharCode(10))
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
    assert.equal(records.length, 1, `STANDARD_FEEDBACK_FIXTURE_CARDINALITY:${filename}`);
    return records[0];
  };

  const assertion = readSingleEvidenceV1<Cap05ApprovalAssertionEvidenceV1>("approval_assertions.jsonl");
  const plan = readSingleEvidenceV1<Cap05ApprovedPlanEvidenceV1>("approved_plans.jsonl");
  const dispatch = readSingleEvidenceV1<Record<string, unknown>>("external_dispatch.jsonl");
  const receipt = readSingleEvidenceV1<Cap05ExecutionReceiptEvidenceV1>("execution_receipts.jsonl");
  const planService = new Cap05ApprovalPlanBindingServiceV1(pool);
  const feedbackService = new Cap05ActionFeedbackNormalizationServiceV1(pool);

  await seedReplayEvidenceV1(pool, dispatch);
  const planBinding = await planService.commitApprovalPlanBinding({
    scope: EXPECTED_SCOPE,
    approval_assertion: assertion,
    approved_plan: plan,
    dispatch: {
      disposition: "EXTERNALLY_RECORDED",
      evidence_ref: String(dispatch.source_record_id),
      evidence_hash: String(dispatch.source_record_hash),
    },
  });
  assert.ok(
    ["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(planBinding.approved_plan_status),
    "APPROVED_PLAN_BINDING_REQUIRED",
  );

  await seedReplayEvidenceV1(pool, receipt as unknown as Record<string, unknown>);
  const feedback = await feedbackService.commitActionFeedback({
    scope: EXPECTED_SCOPE,
    receipt_evidence_ref: receipt.source_record_id,
    receipt_evidence_hash: receipt.source_record_hash,
  });
  assert.ok(
    ["INSERTED", "EXISTING_IDEMPOTENT_SUCCESS"].includes(feedback.persistence_status),
    "STANDARD_ACTION_FEEDBACK_REQUIRED",
  );
  assert.equal(feedback.action_feedback.payload.eligible_for_state_input, true);
  assert.equal(feedback.action_feedback.payload.source_quality, "PASS");
}

function parseRunnerOutputV1'''
postgresql_text, standard_feedback_count = standard_feedback_pattern.subn(
    standard_feedback_replacement,
    postgresql_text,
)
if standard_feedback_count != 1:
    raise SystemExit(f"STANDARD_FEEDBACK_FUNCTION_REPLACEMENT_COUNT_MISMATCH:{standard_feedback_count}")
Path(postgresql_acceptance).write_text(postgresql_text)

replace_once(
    postgresql_acceptance,
    '''    await establishStandardFeedbackPathV1(targetPool);
    ok("checkpoint 72 plus canonical G, one approved Plan binding and one State-eligible H are reproduced");''',
    '''    await establishStandardFeedbackPathV1(targetPool);
    ok("checkpoint 72 plus canonical G, one approved Plan binding and one State-eligible H are reproduced");

    const expiredPredecessorLease = await targetPool.query(
      `UPDATE twin_runtime_lease_v1
          SET expires_at=transaction_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [
        EXPECTED_SCOPE.tenant_id,
        EXPECTED_SCOPE.project_id,
        EXPECTED_SCOPE.group_id,
        EXPECTED_SCOPE.field_id,
        EXPECTED_SCOPE.season_id,
        EXPECTED_SCOPE.zone_id,
      ],
    );
    assert.equal(expiredPredecessorLease.rowCount, 1, "PREDECESSOR_LEASE_CARDINALITY");
    ok("expired predecessor lease permits fenced owner takeover without weakening mutual exclusion");''',
)
replace_once(
    postgresql_acceptance,
    "    assert.equal(pass, 6);",
    "    assert.equal(pass, 7);",
)
