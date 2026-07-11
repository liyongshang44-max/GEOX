// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_NEGATIVE.ts
// Purpose: prove the additive MCFT-CAP-03 V2 selector and candidate validator fail closed for the four confirmed semantic nonconformities and committed hash-basis mutations.
// Boundary: pure in-memory negative acceptance only; no database, persistence, Runtime tick, route, scheduler, workflow, canonical write, or production claim.

import {
  validateAssimilatedObservationCandidateV2,
  type AssimilatedObservationCandidateV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import {
  selectAssimilatedContinuationObservationV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.js";
import {
  buildMcftCap03S2SemanticConformanceRemediationFixtureV1,
} from "./mcft_cap_03_s2_semantic_conformance_remediation_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function errorMessage(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function throwsCode(fn: () => unknown, code: string): boolean {
  return errorMessage(fn)?.includes(code) === true;
}

function cloneCandidateV2(
  candidate: AssimilatedObservationCandidateV2,
): AssimilatedObservationCandidateV2 {
  return structuredClone(candidate);
}

async function mainV1(): Promise<void> {
  const fixture =
    await buildMcftCap03S2SemanticConformanceRemediationFixtureV1();
  const logicalTime = fixture.cap02.evidenceFixture.logical_time;
  const selectorInput = {
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
  };

  const staleByOneMillisecond = fixture.makeObservation({
    source_record_id: "v2_stale_by_1ms",
    observed_at: "2026-06-01T01:44:59.999Z",
    ingested_at: "2026-06-01T01:45:00.000Z",
    available_to_runtime_at: "2026-06-01T01:45:00.000Z",
  });
  const staleResult = selectAssimilatedContinuationObservationV2({
    ...selectorInput,
    observation_records: [staleByOneMillisecond],
  });
  check(
    staleResult.candidates[0]?.candidate_assessment
      === "REJECTED_TIME_STALE",
    "900001 ms is rejected as stale without second truncation",
  );

  const unsupported = fixture.makeObservation({
    source_record_id: "v2_unsupported_type",
    record_type: "unsupported_observation_v1",
  });
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [unsupported],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE",
    ),
    "unsupported record type fails the whole selector closed",
  );

  const missingId = fixture.makeObservation({
    source_record_id: "v2_missing_id",
  });
  missingId.source_record_id = "";
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [missingId],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:SOURCE_RECORD_ID_REQUIRED",
    ),
    "missing source record id fails closed",
  );

  const missingHash = fixture.makeObservation({
    source_record_id: "v2_missing_hash",
  });
  missingHash.source_record_hash = "";
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [missingHash],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:SOURCE_RECORD_HASH_REQUIRED",
    ),
    "missing source record hash fails closed",
  );

  const missingTime = fixture.makeObservation({
    source_record_id: "v2_missing_time",
  });
  delete missingTime.role_time.observed_at;
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [missingTime],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:OBSERVED_AT_INVALID",
    ),
    "missing observed_at fails closed",
  );

  const missingPayload = fixture.makeObservation({
    source_record_id: "v2_missing_payload",
  });
  missingPayload.canonical_payload = null as never;
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [missingPayload],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:CANONICAL_PAYLOAD_REQUIRED",
    ),
    "missing canonical payload fails closed",
  );

  const unknownQuality = fixture.makeObservation({
    source_record_id: "v2_unknown_quality",
  });
  unknownQuality.quality.status = "UNKNOWN";
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [unknownQuality],
      }),
      "MALFORMED_CANONICAL_OBSERVATION:UNKNOWN_QUALITY_STATUS",
    ),
    "unknown quality fails closed",
  );

  const passQuality = fixture.makeObservation({
    source_record_id: "v2_quality_pass",
    quality_status: "PASS",
    value: 0.23,
  });
  const failQuality = fixture.makeObservation({
    source_record_id: "v2_quality_fail",
    quality_status: "FAIL",
    value: 0.23,
  });
  check(
    throwsCode(
      () => selectAssimilatedContinuationObservationV2({
        ...selectorInput,
        observation_records: [passQuality, failQuality],
      }),
      "CONFLICTING_DUPLICATE_EVIDENCE",
    ),
    "PASS versus FAIL duplicate conflict is detected before quality exclusion",
  );

  const inRange = fixture.makeObservation({
    source_record_id: "v2_value_in_range",
    value: 0.23,
  });
  const outOfRange = fixture.makeObservation({
    source_record_id: "v2_value_out_of_range",
    value: 0.9,
  });
  const conflictForward = errorMessage(
    () => selectAssimilatedContinuationObservationV2({
      ...selectorInput,
      observation_records: [inRange, outOfRange],
    }),
  );
  const conflictReverse = errorMessage(
    () => selectAssimilatedContinuationObservationV2({
      ...selectorInput,
      observation_records: [outOfRange, inRange],
    }),
  );
  check(
    conflictForward?.includes("CONFLICTING_DUPLICATE_EVIDENCE") === true,
    "in-range versus physically invalid duplicate fails before physical exclusion",
  );
  check(
    conflictForward === conflictReverse,
    "duplicate input order cannot change the fail-closed error",
  );

  const validSelection = selectAssimilatedContinuationObservationV2({
    ...selectorInput,
    observation_records: [fixture.makeObservation({
      source_record_id: "v2_hash_basis",
      canonical_payload_extra: {
        measurement_basis: "controlled_fixture",
      },
    })],
  });
  const valid = validSelection.selected_observation;
  if (!valid) {
    throw new Error("V2_VALID_CANDIDATE_REQUIRED");
  }

  const payloadMutation = cloneCandidateV2(valid);
  payloadMutation.canonical_payload.measurement_basis = "mutated";
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(payloadMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "canonical payload mutation is rejected",
  );

  const valueMutation = cloneCandidateV2(valid);
  valueMutation.canonical_payload.value = 0.24;
  valueMutation.canonical_value = 0.24;
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(valueMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "canonical value hash-basis mutation is rejected",
  );

  const qualityMutation = cloneCandidateV2(valid);
  qualityMutation.quality.status = "LIMITED";
  qualityMutation.quality_status = "LIMITED";
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(qualityMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "quality status hash-basis mutation is rejected",
  );

  const sourceUnitMutation = cloneCandidateV2(valid);
  sourceUnitMutation.source_unit = "fraction";
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(sourceUnitMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "source unit hash-basis mutation is rejected",
  );

  const conversionMutation = cloneCandidateV2(valid);
  conversionMutation.conversion_rule.version = "2";
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(conversionMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "conversion rule hash-basis mutation is rejected",
  );

  const canonicalUnitMutation = cloneCandidateV2(valid);
  canonicalUnitMutation.canonical_unit = "ratio" as never;
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(canonicalUnitMutation),
      "ASSIMILATION_V2_CANDIDATE_CANONICAL_UNIT_MISMATCH",
    ),
    "canonical unit mutation is rejected",
  );

  const epistemicMutation = cloneCandidateV2(valid);
  epistemicMutation.epistemic_class = "ESTIMATED" as never;
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(epistemicMutation),
      "ASSIMILATION_V2_CANDIDATE_EPISTEMIC_CLASS_MISMATCH",
    ),
    "epistemic class mutation is rejected",
  );

  const hashMutation = cloneCandidateV2(valid);
  hashMutation.observation_semantic_content_hash = "sha256:mutated";
  check(
    throwsCode(
      () => validateAssimilatedObservationCandidateV2(hashMutation),
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    ),
    "recorded semantic content hash mutation is rejected",
  );

  console.log(
    `MCFT-CAP-03 S2 semantic-conformance remediation negative: ${pass} PASS, ${fail} FAIL`,
  );
  if (fail > 0) {
    process.exitCode = 1;
  }
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
