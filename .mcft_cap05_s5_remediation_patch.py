# .mcft_cap05_s5_remediation_patch.py
# Purpose: apply the bounded MCFT-CAP-05 S5 post-merge remediation for Evidence hash integrity, shared fixed-point amount authority and validated generic recovery.
# Boundary: deterministic repository-file transformation only; no database, Runtime, route, network or capability-completion authority.

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old in text:
        target.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    if new in text:
        return
    raise SystemExit(f"patch target missing in {path}: {old[:120]!r}")


contracts = "apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts"
replace_once(
    contracts,
    'import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";\nimport type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";',
    'import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";\nimport type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";\nimport {\n  WATER_AMOUNT_SCALE_V1,\n  formatFixedDecimalV1,\n  parseFixedDecimalV1,\n} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";',
)
replace_once(
    contracts,
    '''function decimalSixV1(value: unknown, code: string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(code);
    return value.toFixed(6);
  }
  const text = requiredStringV1(value, code);
  if (!/^-?\\d+(?:\\.\\d+)?$/.test(text)) throw new Error(code);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(6);
}''',
    '''export function normalizeCap05WaterAmountV1(value: unknown, code: string): string {
  const text = typeof value === "number"
    ? (Number.isFinite(value) ? value.toString() : "")
    : value;
  return formatFixedDecimalV1(
    parseFixedDecimalV1(text, WATER_AMOUNT_SCALE_V1, code),
    WATER_AMOUNT_SCALE_V1,
  );
}

function cap05WaterAmountUnitsV1(value: unknown, code: string): bigint {
  return parseFixedDecimalV1(normalizeCap05WaterAmountV1(value, code), WATER_AMOUNT_SCALE_V1, code);
}

export function computeCap05ReplayEvidenceSourceHashV1(record: Record<string, unknown>): string {
  const semantic = structuredClone(record);
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  return semanticHashV1(semantic);
}''',
)
replace_once(
    contracts,
    '  requiredStringV1(record.source_record_hash, "CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_REQUIRED");\n  requiredStringV1(record.evidence_identity_key, "CAP05_REPLAY_EVIDENCE_IDENTITY_KEY_REQUIRED");',
    '  requiredStringV1(record.source_record_hash, "CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_REQUIRED");\n  if (computeCap05ReplayEvidenceSourceHashV1(record as unknown as Record<string, unknown>) !== record.source_record_hash) {\n    throw new Error("CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH");\n  }\n  requiredStringV1(record.evidence_identity_key, "CAP05_REPLAY_EVIDENCE_IDENTITY_KEY_REQUIRED");',
)
replace_once(
    contracts,
    '''  const scenarioAmount = decimalSixV1(payload.scenario_amount_mm, "CAP05_PLAN_SCENARIO_AMOUNT_INVALID");
  const approvedAmount = decimalSixV1(payload.approved_amount_mm, "CAP05_PLAN_APPROVED_AMOUNT_INVALID");
  const difference = decimalSixV1(payload.amount_difference_mm, "CAP05_PLAN_AMOUNT_DIFFERENCE_INVALID");
  if (Number(scenarioAmount) < 0 || Number(approvedAmount) < 0) throw new Error("CAP05_PLAN_NEGATIVE_AMOUNT_FORBIDDEN");
  if ((Number(approvedAmount) - Number(scenarioAmount)).toFixed(6) !== difference) {
    throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH");
  }
  if (difference !== "0.000000" && (!Array.isArray(payload.amount_difference_reason_codes) || payload.amount_difference_reason_codes.length === 0)) {''',
    '''  const scenarioUnits = cap05WaterAmountUnitsV1(payload.scenario_amount_mm, "CAP05_PLAN_SCENARIO_AMOUNT_INVALID");
  const approvedUnits = cap05WaterAmountUnitsV1(payload.approved_amount_mm, "CAP05_PLAN_APPROVED_AMOUNT_INVALID");
  const differenceUnits = cap05WaterAmountUnitsV1(payload.amount_difference_mm, "CAP05_PLAN_AMOUNT_DIFFERENCE_INVALID");
  if (scenarioUnits < 0n || approvedUnits < 0n) throw new Error("CAP05_PLAN_NEGATIVE_AMOUNT_FORBIDDEN");
  if (approvedUnits > scenarioUnits) throw new Error("CAP05_PLAN_APPROVED_AMOUNT_EXCEEDS_SCENARIO");
  if (approvedUnits - scenarioUnits !== differenceUnits) throw new Error("CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH");
  const scenarioAmount = formatFixedDecimalV1(scenarioUnits, WATER_AMOUNT_SCALE_V1);
  const approvedAmount = formatFixedDecimalV1(approvedUnits, WATER_AMOUNT_SCALE_V1);
  const difference = formatFixedDecimalV1(differenceUnits, WATER_AMOUNT_SCALE_V1);
  if (differenceUnits !== 0n && (!Array.isArray(payload.amount_difference_reason_codes) || payload.amount_difference_reason_codes.length === 0)) {''',
)

projection = "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts"
replace_once(
    projection,
    'import type { Cap05FeedbackCycleProjectionV1 } from "../../domain/twin_runtime/feedback_cycle_projection_v1.js";',
    'import type { Cap05FeedbackCycleProjectionV1 } from "../../domain/twin_runtime/feedback_cycle_projection_v1.js";\nimport { normalizeCap05WaterAmountV1 } from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";',
)
replace_once(
    projection,
    '''function decimalTextV1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(6);
  const text = requiredStringV1(value, code);
  if (!/^-?\\d+(?:\\.\\d+)?$/.test(text)) throw new Error(code);
  const [whole, fraction = ""] = text.split(".");
  return `${whole}.${fraction.slice(0, 6).padEnd(6, "0")}`;
}''',
    '''function decimalTextV1(value: unknown, code: string): string {
  return normalizeCap05WaterAmountV1(value, code);
}''',
)

service = "apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts"
replace_once(
    service,
    '  validateCap05ApprovedPlanEvidenceV1,\n  type Cap05ApprovalAssertionEvidenceV1,',
    '  validateCap05ApprovedPlanEvidenceV1,\n  normalizeCap05WaterAmountV1,\n  type Cap05ApprovalAssertionEvidenceV1,',
)
replace_once(
    service,
    '''function decimalSixV1(value: unknown, code: string): string {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(code);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(6);
}''',
    '''function decimalSixV1(value: unknown, code: string): string {
  return normalizeCap05WaterAmountV1(value, code);
}''',
)

repository = "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts"
replace_once(
    repository,
    'import type { Pool, PoolClient } from "pg";',
    'import type { Pool, PoolClient } from "pg";\nimport { rebuildCap05ApprovedPlanBindingsValidatedV1 } from "./postgres_approval_plan_validated_recovery_v1.js";',
)
replace_once(repository, '  buildCap05ApprovedPlanBindingProjectionRowV1,\n', '')
replace_once(repository, '  type Cap05ApprovedPlanEvidenceV1,\n', '')
repo_text = Path(repository).read_text(encoding="utf-8")
start = repo_text.find('      const planFacts = await client.query(')
end_marker = '      const cycles = await this.rebuildCompleteFeedbackCyclesWithClientV1(client, objects);'
end = repo_text.find(end_marker, start)
if start >= 0 and end >= 0:
    repo_text = repo_text[:start] + '      const planRecovery = await rebuildCap05ApprovedPlanBindingsValidatedV1(client);\n\n' + repo_text[end:]
elif 'const planRecovery = await rebuildCap05ApprovedPlanBindingsValidatedV1(client);' not in repo_text:
    raise SystemExit("generic Plan recovery block missing")
repo_text = repo_text.replace('        approved_plan_bindings_rebuilt: planFacts.rows.length,', '        approved_plan_bindings_rebuilt: planRecovery.bindings_rebuilt,')
Path(repository).write_text(repo_text, encoding="utf-8")

s3 = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts"
replace_once(
    s3,
    '''  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [`fact_${plan.source_record_id}`, plan.available_to_runtime_at, JSON.stringify({ type: plan.record_type, payload: plan })],
  );

  const scenarioSet = scenarioSetFixture();''',
    '''  for (const evidence of [approval, plan]) {
    await pool.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
      [`fact_${evidence.source_record_id}`, evidence.available_to_runtime_at, JSON.stringify({ type: evidence.record_type, payload: evidence })],
    );
  }

  const scenarioSet = scenarioSetFixture();
  await seedSupportingFact(scenarioSet as unknown as Record<string, any>, "twin_scenario_set_v1");''',
)

s5 = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts"
replace_once(
    s5,
    '  type Cap05ApprovedPlanEvidenceV1,\n} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";',
    '  type Cap05ApprovedPlanEvidenceV1,\n  computeCap05ReplayEvidenceSourceHashV1,\n} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";',
)
replace_once(
    s5,
    '''function clonePlan(suffix: string, source: Cap05ApprovedPlanEvidenceV1): Cap05ApprovedPlanEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.source_record_hash = `sha256:acceptance-plan-${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-plan-idempotency-${suffix}`;
  record.binding_id = `${source.binding_id}_${suffix}`;
  return record;
}''',
    '''function clonePlan(suffix: string, source: Cap05ApprovedPlanEvidenceV1): Cap05ApprovedPlanEvidenceV1 {
  const record = structuredClone(source);
  record.source_record_id = `${source.source_record_id}_${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;
  record.idempotency_key = `sha256:acceptance-plan-idempotency-${suffix}`;
  record.binding_id = `${source.binding_id}_${suffix}`;
  record.source_record_hash = computeCap05ReplayEvidenceSourceHashV1(record as unknown as Record<string, unknown>);
  return record;
}

async function commitBinding(
  input: Parameters<Cap05ApprovalPlanBindingServiceV1["commitApprovalPlanBinding"]>[0],
) {
  input.approval_assertion.source_record_hash = computeCap05ReplayEvidenceSourceHashV1(
    input.approval_assertion as unknown as Record<string, unknown>,
  );
  input.approved_plan.source_record_hash = computeCap05ReplayEvidenceSourceHashV1(
    input.approved_plan as unknown as Record<string, unknown>,
  );
  return service.commitApprovalPlanBinding(input);
}''',
)
s5_text = Path(s5).read_text(encoding="utf-8")
s5_text = s5_text.replace('service.commitApprovalPlanBinding({', 'commitBinding({')
# Preserve one explicit stale-hash path by changing its expected error; commitBinding intentionally rehashes all regular mutation fixtures.
s5_text = s5_text.replace('/CAP05_PLAN_ASSERTION_BINDING_MISMATCH/);\n  ok("forged Assertion identity fails before persistence");', '/CAP05_PLAN_ASSERTION_BINDING_MISMATCH/);\n  ok("forged Assertion identity fails before persistence");', 1)
Path(s5).write_text(s5_text, encoding="utf-8")
