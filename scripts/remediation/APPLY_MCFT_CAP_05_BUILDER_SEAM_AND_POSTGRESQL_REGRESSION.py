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
replace_once(
    postgresql_acceptance,
    '''  const evidence = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "fixtures/mcft/water_state/feedback_v1/decision_and_execution_evidence.jsonl"),
      "utf8",
    ).trim(),
  ) as Array<Record<string, any>>;''',
    '''  const feedbackRoot = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
  const readSingleEvidenceV1 = (filename: string): Record<string, any> => {
    const records = fs.readFileSync(path.join(feedbackRoot, filename), "utf8")
      .split("\\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, any>);
    assert.equal(records.length, 1, `STANDARD_FEEDBACK_FIXTURE_CARDINALITY:${filename}`);
    return records[0];
  };
  const evidence = [
    readSingleEvidenceV1("approval_assertions.jsonl"),
    readSingleEvidenceV1("approved_plans.jsonl"),
    readSingleEvidenceV1("execution_receipts.jsonl"),
  ];''',
)
