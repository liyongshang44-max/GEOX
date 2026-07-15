# scripts/remediation/APPLY_MCFT_CAP_05_REPLAY_EXECUTION_METADATA_SEPARATION.py
# Purpose: separate source-binding execution metadata from the canonical Replay Evidence shape so CAP-03 selectors can resolve a conversion-rule version without changing A0 Evidence semantics or active-lineage identity.
# Boundary: source transformation only; no source fixture mutation, source-binding authority mutation, Runtime mathematics, database access, canonical write, calibration, Model Activation, or CAP-06 authority.

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_MARKER_COUNT:{path}:{count}:{old[:100]}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "apps/server/src/runtime/twin_runtime/ports.ts",
    '''export type CanonicalReplayEvidenceRecordV1 = TwinScopeKeyV1 & {''',
    '''export type ReplayEvidenceExecutionMetadataV1 = {
  policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1";
  source_binding_version: number;
  conversion_rule_version: string;
};

export type CanonicalReplayEvidenceRecordV1 = TwinScopeKeyV1 & {''',
)
replace_once(
    "apps/server/src/runtime/twin_runtime/ports.ts",
    '''  conversion_rule: Record<string, unknown>;
  limitations: string[];''',
    '''  conversion_rule: Record<string, unknown>;
  execution_metadata?: ReplayEvidenceExecutionMetadataV1;
  limitations: string[];''',
)

replace_once(
    "apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts",
    '''// Purpose: load deterministic MCFT-CAP-01 Canonical Replay records for one explicit logical tick, verify every source-record semantic hash, and enrich each record with its frozen source-binding unit and conversion metadata.
// Boundary: filesystem adapter only; no Evidence selection, State mathematics, Runtime orchestration, database access, wall-clock reads, canonical writes, source-record mutation, or source-binding authority mutation.''',
    '''// Purpose: load deterministic MCFT-CAP-01 Canonical Replay records for one explicit logical tick, verify every source-record semantic hash, preserve canonical binding conversion data, and attach separate source-binding execution metadata.
// Boundary: filesystem adapter only; no Evidence selection, State mathematics, Runtime orchestration, database access, wall-clock reads, canonical writes, source-record mutation, canonical Evidence projection mutation, or source-binding authority mutation.''',
)
replace_once(
    "apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts",
    '''import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";''',
    '''import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceExecutionMetadataV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../runtime/twin_runtime/ports.js";''',
)
replace_once(
    "apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts",
    '''function normalizeConversionRuleExecutionMetadataV1(binding: SourceBindingV1): Record<string, unknown> {
  const conversionRule = structuredClone(binding.conversion_rule);
  assertStringV1(conversionRule.id, `CONVERSION_RULE_ID_REQUIRED:${binding.binding_id}`);
  const authoritativeVersion = String(binding.binding_version);
  if (conversionRule.version === undefined) {
    conversionRule.version = authoritativeVersion;
    return conversionRule;
  }
  assertStringV1(conversionRule.version, `CONVERSION_RULE_VERSION_INVALID:${binding.binding_id}`);
  if (conversionRule.version !== authoritativeVersion) {
    throw new Error(`CONVERSION_RULE_VERSION_BINDING_VERSION_MISMATCH:${binding.binding_id}`);
  }
  return conversionRule;
}''',
    '''function resolveConversionRuleExecutionMetadataV1(
  binding: SourceBindingV1,
): ReplayEvidenceExecutionMetadataV1 {
  const conversionRule = structuredClone(binding.conversion_rule);
  assertStringV1(conversionRule.id, `CONVERSION_RULE_ID_REQUIRED:${binding.binding_id}`);
  const authoritativeVersion = String(binding.binding_version);
  if (conversionRule.version !== undefined) {
    assertStringV1(conversionRule.version, `CONVERSION_RULE_VERSION_INVALID:${binding.binding_id}`);
    if (conversionRule.version !== authoritativeVersion) {
      throw new Error(`CONVERSION_RULE_VERSION_BINDING_VERSION_MISMATCH:${binding.binding_id}`);
    }
  }
  return {
    policy_id: SOURCE_BINDING_CONVERSION_RULE_EXECUTION_METADATA_POLICY_ID_V1,
    source_binding_version: binding.binding_version,
    conversion_rule_version: authoritativeVersion,
  };
}''',
)
replace_once(
    "apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts",
    '''        conversion_rule: normalizeConversionRuleExecutionMetadataV1(binding),''',
    '''        conversion_rule: structuredClone(binding.conversion_rule),
        execution_metadata: resolveConversionRuleExecutionMetadataV1(binding),''',
)

replace_once(
    "apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts",
    '''function compareSoilSelectionV1(a: CanonicalReplayEvidenceRecordV1, b: CanonicalReplayEvidenceRecordV1): number {''',
    '''function canonicalReplayRecordForPersistenceV1(
  record: CanonicalReplayEvidenceRecordV1,
): CanonicalReplayEvidenceRecordV1 {
  const { execution_metadata: _executionMetadata, ...canonicalRecord } = record;
  return structuredClone(canonicalRecord) as CanonicalReplayEvidenceRecordV1;
}

function compareSoilSelectionV1(a: CanonicalReplayEvidenceRecordV1, b: CanonicalReplayEvidenceRecordV1): number {''',
)
replace_once(
    "apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts",
    '''  const assimilationObservation = usableSoil[0];''',
    '''  const assimilationObservation = canonicalReplayRecordForPersistenceV1(usableSoil[0]);''',
)

helper_v1 = '''function conversionRuleV1(
  record: CanonicalReplayEvidenceRecordV1,
  conversion: Record<string, unknown>,
): { id: string; version: string } {
  const id = requiredStringV1(conversion.id, "CONVERSION_RULE_ID_REQUIRED");
  const metadata = record.execution_metadata;
  let version: string;
  if (conversion.version === undefined) {
    if (!metadata) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_VERSION_REQUIRED");
    }
    if (metadata.policy_id !== "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1") {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_METADATA_POLICY_INVALID");
    }
    if (!Number.isInteger(metadata.source_binding_version) || metadata.source_binding_version <= 0) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:SOURCE_BINDING_VERSION_INVALID");
    }
    version = requiredStringV1(
      metadata.conversion_rule_version,
      "CONVERSION_RULE_EXECUTION_VERSION_REQUIRED",
    );
    if (version !== String(metadata.source_binding_version)) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_VERSION_MISMATCH");
    }
  } else {
    version = requiredStringV1(conversion.version, "CONVERSION_RULE_VERSION_REQUIRED");
    if (metadata && (
      metadata.conversion_rule_version !== version
      || String(metadata.source_binding_version) !== version
    )) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_VERSION_MISMATCH");
    }
  }
  return { id, version };
}

'''
replace_once(
    "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts",
    '''function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

''',
    '''function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

''' + helper_v1,
)
replace_once(
    "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts",
    '''  const conversionRule = {
    id: requiredStringV1(conversion.id, "CONVERSION_RULE_ID_REQUIRED"),
    version: requiredStringV1(conversion.version, "CONVERSION_RULE_VERSION_REQUIRED"),
  };''',
    '''  const conversionRule = conversionRuleV1(record, conversion);''',
)

helper_v2 = '''function conversionRuleV2(
  record: CanonicalReplayEvidenceRecordV1,
  conversion: Record<string, unknown>,
): { id: string; version: string } {
  const id = requiredStringV2(conversion.id, "CONVERSION_RULE_ID_REQUIRED");
  const metadata = record.execution_metadata;
  let version: string;
  if (conversion.version === undefined) {
    if (!metadata) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_VERSION_REQUIRED");
    }
    if (metadata.policy_id !== "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1") {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_METADATA_POLICY_INVALID");
    }
    if (!Number.isInteger(metadata.source_binding_version) || metadata.source_binding_version <= 0) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:SOURCE_BINDING_VERSION_INVALID");
    }
    version = requiredStringV2(
      metadata.conversion_rule_version,
      "CONVERSION_RULE_EXECUTION_VERSION_REQUIRED",
    );
    if (version !== String(metadata.source_binding_version)) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_VERSION_MISMATCH");
    }
  } else {
    version = requiredStringV2(conversion.version, "CONVERSION_RULE_VERSION_REQUIRED");
    if (metadata && (
      metadata.conversion_rule_version !== version
      || String(metadata.source_binding_version) !== version
    )) {
      throw new Error("MALFORMED_CANONICAL_OBSERVATION:CONVERSION_RULE_EXECUTION_VERSION_MISMATCH");
    }
  }
  return { id, version };
}

'''
replace_once(
    "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts",
    '''function finiteNumberV2(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

''',
    '''function finiteNumberV2(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

''' + helper_v2,
)
replace_once(
    "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts",
    '''  const conversionRule = {
    id: requiredStringV2(
      conversion.id,
      "CONVERSION_RULE_ID_REQUIRED",
    ),
    version: requiredStringV2(
      conversion.version,
      "CONVERSION_RULE_VERSION_REQUIRED",
    ),
  };''',
    '''  const conversionRule = conversionRuleV2(record, conversion);''',
)

replace_once(
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts",
    '''import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";''',
    '''import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import { selectAssimilatedContinuationObservationV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.js";''',
)
replace_once(
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts",
    '''    assert.deepEqual(loaded[0].conversion_rule, {
      id: "PERCENT_TO_FRACTION_V1",
      expression: "canonical_value = source_value / 100",
      version: "1",
    });
    ok("missing conversion-rule version is derived from frozen binding_version");''',
    '''    assert.deepEqual(loaded[0].conversion_rule, {
      id: "PERCENT_TO_FRACTION_V1",
      expression: "canonical_value = source_value / 100",
    });
    assert.deepEqual(loaded[0].execution_metadata, {
      policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
      source_binding_version: 1,
      conversion_rule_version: "1",
    });
    ok("missing conversion-rule version is attached only as separate execution metadata");''',
)
replace_once(
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts",
    '''    ok("derived execution metadata does not mutate Replay Evidence identity or file bytes");

    await writeMatrixV1(matrixPath, sourceMatrixV1({''',
    '''    ok("derived execution metadata does not mutate Replay Evidence identity or file bytes");

    const withoutExecutionMetadata = structuredClone(loaded[0]);
    delete withoutExecutionMetadata.execution_metadata;
    const windowWithMetadata = buildFrozenEvidenceWindowV1({
      scope,
      logical_time: "2026-06-04T07:00:00.000Z",
      candidate_records: loaded,
    });
    const windowWithoutMetadata = buildFrozenEvidenceWindowV1({
      scope,
      logical_time: "2026-06-04T07:00:00.000Z",
      candidate_records: [withoutExecutionMetadata],
    });
    assert.deepEqual(windowWithMetadata, windowWithoutMetadata);
    assert.equal(windowWithMetadata.assimilation_observation.execution_metadata, undefined);
    ok("execution metadata is excluded from canonical A0 Evidence and active-lineage identity inputs");

    const selected = selectAssimilatedContinuationObservationV1({
      scope,
      logical_time: "2026-06-04T07:00:00.000Z",
      saturation_fraction: 0.45,
      observation_records: loaded,
    });
    assert.deepEqual(selected.selected_observation?.conversion_rule, {
      id: "PERCENT_TO_FRACTION_V1",
      version: "1",
    });
    ok("observation selector resolves the executable conversion version from separate metadata");

    await writeMatrixV1(matrixPath, sourceMatrixV1({''',
)
replace_once(
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts",
    '''    assert.equal(explicitMatch[0].conversion_rule.version, "1");
    ok("matching explicit conversion-rule version remains valid");''',
    '''    assert.equal(explicitMatch[0].conversion_rule.version, "1");
    assert.equal(explicitMatch[0].execution_metadata?.conversion_rule_version, "1");
    ok("matching explicit conversion-rule version remains valid and consistent with execution metadata");''',
)
replace_once(
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts",
    '''    assert.equal(pass, 6);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\\n`);''',
    '''    assert.equal(pass, 8);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\\n`);''',
)
