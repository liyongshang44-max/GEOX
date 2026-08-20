from pathlib import Path


def replace_once(text: str, old: str, new: str, code: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{code}:{count}")
    return text.replace(old, new, 1)


canonicalizer = Path("apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts")
s = canonicalizer.read_text()
anchor = '''function rawSha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function validateScope(scope: TwinScopeKeyV1): TwinScopeKeyV1 {'''
inserted = '''function rawSha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export const MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1 = {
  rule_id: "MCFT_CAP09_ET0_MM_PER_HOUR_DECIMAL_9_FIXED_V1",
  decimal_places: 9,
  measurement_precision_claim: false,
} as const;

export function normalizeMcftCap09Et0CanonicalNumberV1(value: unknown): number {
  requireCondition(typeof value === "number" && Number.isFinite(value), "EA3_ET0_CANONICAL_NUMBER_FINITE_REQUIRED");
  const normalized = Number(value.toFixed(MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1.decimal_places));
  requireCondition(Number.isFinite(normalized), "EA3_ET0_CANONICAL_NUMBER_NORMALIZATION_FAILED");
  return Object.is(normalized, -0) ? 0 : normalized;
}

function normalizeEt0CanonicalPayloadV1(
  role: McftCap09ExternalEvidenceRoleV1,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (role === "HISTORICAL_ET0_INPUT") {
    return { ...payload, value: normalizeMcftCap09Et0CanonicalNumberV1(payload.value) };
  }
  if (role === "FUTURE_ET0_ASSUMPTION") {
    requireCondition(Array.isArray(payload.points), "EA3_FUTURE_ET0_POINTS_REQUIRED");
    return {
      ...payload,
      points: payload.points.map((point, index) => {
        requireCondition(point !== null && typeof point === "object" && !Array.isArray(point), `EA3_FUTURE_ET0_POINT_OBJECT_REQUIRED:${index}`);
        const record = point as Record<string, unknown>;
        return {
          ...record,
          et0_mm_per_hour: normalizeMcftCap09Et0CanonicalNumberV1(record.et0_mm_per_hour),
        };
      }),
    };
  }
  return { ...payload };
}

function validateScope(scope: TwinScopeKeyV1): TwinScopeKeyV1 {'''
s = replace_once(s, anchor, inserted, "CANONICALIZER_NORMALIZER_INSERT")
s = replace_once(
    s,
    "  const canonicalPayloadSha256 = semanticHashV1(input.draft.canonical_payload);",
    "  const canonicalPayload = normalizeEt0CanonicalPayloadV1(input.draft.role, input.draft.canonical_payload);\n  const canonicalPayloadSha256 = semanticHashV1(canonicalPayload);",
    "CANONICALIZER_PAYLOAD_HASH",
)
quality_old = '''    quality: {
      ...input.draft.quality,
      canonical_payload_sha256: canonicalPayloadSha256,'''
quality_new = '''    quality: {
      ...input.draft.quality,
      ...(input.draft.role === "HISTORICAL_ET0_INPUT" || input.draft.role === "FUTURE_ET0_ASSUMPTION" ? {
        et0_canonical_numeric_serialization_rule: MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1.rule_id,
        et0_canonical_numeric_serialization_decimal_places: MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1.decimal_places,
        et0_canonical_numeric_serialization_is_measurement_precision: MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1.measurement_precision_claim,
      } : {}),
      canonical_payload_sha256: canonicalPayloadSha256,'''
s = replace_once(s, quality_old, quality_new, "CANONICALIZER_QUALITY_METADATA")
s = replace_once(s, "    canonical_payload: { ...input.draft.canonical_payload },", "    canonical_payload: canonicalPayload,", "CANONICALIZER_RECORD_PAYLOAD")
canonicalizer.write_text(s)

rolling = Path(".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml")
s = rolling.read_text()
provider_line = "      - 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts'"
if s.count(provider_line) != 2:
    raise RuntimeError(f"ROLLING_PROVIDER_PATH_CARDINALITY:{s.count(provider_line)}")
pr_block = provider_line + "\n      - 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts'\n      - 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'\n      - 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py'\n      - 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_ET0_CANONICAL_NUMERIC_STABILITY_V1.ts'"
push_block = provider_line + "\n      - 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts'\n      - 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'\n      - 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py'"
s = s.replace(provider_line, pr_block, 1)
s = s.replace(provider_line, push_block, 1)
rolling.write_text(s)

p24 = Path(".github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml")
s = p24.read_text()
rehyd_line = "      - 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts'"
path_block = rehyd_line + "\n      - 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts'\n      - 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'\n      - 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py'\n      - 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_ET0_CANONICAL_NUMERIC_STABILITY_V1.ts'"
s = replace_once(s, rehyd_line, path_block, "P24_DEPENDENCY_PATHS")
for code, line in [
    ("P24_REMOVE_IMPLEMENTATION_PHASE_CHANGED_FILE_GUARD", "          grep -Fxq 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts' <<<\"$changed\" || { echo 'AM19_P24_SUCCESSOR_QUALIFICATION_REFACTOR_REQUIRED' >&2; exit 1; }\n"),
    ("P24_REMOVE_SHARED_BUILDER_CHANGED_FILE_GUARD", "          grep -Fxq 'apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts' <<<\"$changed\" || { echo 'AM19_P24_SHARED_MANIFEST_BUILDER_CHANGE_REQUIRED' >&2; exit 1; }\n"),
]:
    s = replace_once(s, line, "", code)
s = replace_once(
    s,
    "          changed=$(git diff --name-only \"$base_sha\" \"$SUBJECT_SHA\")\n          grep -Fq 'buildExternalFormalAmendment19WindowManifestV1'",
    "          changed=$(git diff --name-only \"$base_sha\" \"$SUBJECT_SHA\")\n          test -n \"$changed\" || { echo 'AM19_P24_PR_CHANGED_FILE_REQUIRED' >&2; exit 1; }\n          grep -Fq 'buildExternalFormalAmendment19WindowManifestV1'",
    "P24_STEADY_STATE_GUARD",
)
s = replace_once(
    s,
    "          ! grep -Fq 'MCFT_CAP09_AM19_ACCELERATED_PERSISTENT24_MANIFEST_V1' scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts",
    "          ! grep -Fq 'MCFT_CAP09_AM19_ACCELERATED_PERSISTENT24_MANIFEST_V1' scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts\n          grep -Fq 'MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1' apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
    "P24_NUMERIC_RULE_STATIC_ASSERTION",
)
type_anchor = '''            apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts \\
            scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts \\
            scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts'''
type_new = '''            apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts \\
            apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts \\
            scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts \\
            scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts \\
            scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_ET0_CANONICAL_NUMERIC_STABILITY_V1.ts'''
s = replace_once(s, type_anchor, type_new, "P24_FOCUSED_TYPECHECK")
self_anchor = '''          pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts selftest
          pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts selftest'''
self_new = '''          pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts selftest
          pnpm exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_ET0_CANONICAL_NUMERIC_STABILITY_V1.ts
          pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts selftest'''
s = replace_once(s, self_anchor, self_new, "P24_ET0_SELFTEST_WIRING")
p24.write_text(s)

print("PATCH_OK")
