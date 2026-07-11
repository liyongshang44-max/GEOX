// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.ts
// Purpose: prove the additive MCFT-CAP-03 V2 selector fixes the PT15M, duplicate-order, and committed semantic-hash-basis defects while preserving V1 readback behavior.
// Boundary: pure in-memory acceptance only; no database, persistence, Runtime tick, route, scheduler, workflow, canonical write, or production claim.

import {
  ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2,
  computeAssimilatedObservationSemanticContentHashV2,
  validateAssimilatedObservationCandidateV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import {
  validateAssimilatedObservationCandidateV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.js";
import {
  selectAssimilatedContinuationObservationV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.js";
import {
  selectAssimilatedContinuationObservationV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.js";
import {
  buildContinuationEvidenceWindowV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
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

async function mainV1(): Promise<void> {
  const fixture =
    await buildMcftCap03S2SemanticConformanceRemediationFixtureV1();
  const logicalTime = fixture.cap02.evidenceFixture.logical_time;
  const selectorInput = {
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
  };

  const exactBoundary = fixture.makeObservation({
    source_record_id: "v2_exact_15m",
    observed_at: "2026-06-01T01:45:00.000Z",
    ingested_at: "2026-06-01T01:45:01.000Z",
    available_to_runtime_at: "2026-06-01T01:45:01.000Z",
    canonical_payload_extra: {
      measurement_basis: "controlled_fixture",
    },
  });
  const exactBoundarySelection = selectAssimilatedContinuationObservationV2({
    ...selectorInput,
    observation_records: [exactBoundary],
  });
  check(
    exactBoundarySelection.selected_observation_ref === "v2_exact_15m",
    "exactly 900000 ms remains eligible",
  );
  check(
    exactBoundarySelection.selected_observation
      ?.temporal_offset_milliseconds === 900_000,
    "V2 candidate records the exact millisecond temporal offset",
  );

  const duplicateEarlier = fixture.makeObservation({
    source_record_id: "v2_duplicate_earlier",
    observed_at: "2026-06-01T01:55:00.000Z",
    ingested_at: "2026-06-01T01:56:00.000Z",
    value: 0.23,
  });
  const duplicateWinner = fixture.makeObservation({
    source_record_id: "v2_duplicate_winner",
    observed_at: "2026-06-01T01:55:00.000Z",
    ingested_at: "2026-06-01T01:57:00.000Z",
    value: 0.23,
  });
  const older = fixture.makeObservation({
    source_record_id: "v2_older",
    observed_at: "2026-06-01T01:50:00.000Z",
    ingested_at: "2026-06-01T01:51:00.000Z",
    value: 0.22,
  });

  const selectionA = selectAssimilatedContinuationObservationV2({
    ...selectorInput,
    observation_records: [older, duplicateEarlier, duplicateWinner],
  });
  const selectionB = selectAssimilatedContinuationObservationV2({
    ...selectorInput,
    observation_records: [duplicateWinner, older, duplicateEarlier],
  });

  check(
    selectionA.semantic_digest === selectionB.semantic_digest,
    "V2 selector semantic result is independent of input order",
  );
  check(
    selectionA.selected_observation_ref === "v2_duplicate_winner",
    "identical duplicate winner follows the frozen deterministic policy",
  );
  check(
    selectionA.candidates.find(
      (candidate) => candidate.source_record_id === "v2_duplicate_earlier",
    )?.candidate_assessment === "IDENTICAL_DUPLICATE_SUPPRESSED",
    "identical duplicate remains explicitly suppressed",
  );
  check(
    selectionA.candidates.find(
      (candidate) => candidate.source_record_id === "v2_older",
    )?.candidate_assessment === "NOT_SELECTED_OLDER_USABLE",
    "older usable observation remains traceable",
  );

  const selected = selectionA.selected_observation;
  if (!selected) {
    throw new Error("V2_SELECTED_OBSERVATION_REQUIRED");
  }
  validateAssimilatedObservationCandidateV2(selected);
  check(true, "committed V2 candidate passes independent validation");

  const recomputedHash = computeAssimilatedObservationSemanticContentHashV2({
    canonical_payload: selected.canonical_payload,
    quality: selected.quality,
    source_unit: selected.source_unit,
    canonical_unit: selected.canonical_unit,
    conversion_rule: selected.conversion_rule,
    epistemic_class: selected.epistemic_class,
  });
  check(
    recomputedHash === selected.observation_semantic_content_hash,
    "committed V2 candidate independently reproduces its semantic content hash",
  );
  check(
    selected.canonical_payload.quantity_kind
      === "VOLUMETRIC_WATER_CONTENT",
    "committed V2 candidate preserves the complete canonical payload basis",
  );

  const baseRecords = [
    ...fixture.cap02.evidenceFixture.candidate_records,
    older,
    duplicateEarlier,
    duplicateWinner,
  ];
  const baseWindow = buildContinuationEvidenceWindowV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    candidate_records: baseRecords,
    crop_stage_context_ref:
      fixture.cap02.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash:
      fixture.cap02.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cap02.cropStageContext,
  });
  const v2Window = buildAssimilatedContinuationEvidenceWindowV2({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    candidate_records: baseRecords,
    observation_candidate_records: [
      older,
      duplicateEarlier,
      duplicateWinner,
    ],
    saturation_fraction: 0.5,
    crop_stage_context_ref:
      fixture.cap02.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash:
      fixture.cap02.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cap02.cropStageContext,
  });
  check(
    v2Window.evidence_window_contract_id
      === ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2,
    "V2 Evidence Window uses the additive contract id",
  );
  check(
    v2Window.base_continuation_window.semantic_digest
      === baseWindow.semantic_digest,
    "V2 wrapper preserves immutable CAP-02 Evidence Window output",
  );

  const historicalV1 = selectAssimilatedContinuationObservationV1({
    ...selectorInput,
    observation_records: [older],
  });
  if (!historicalV1.selected_observation) {
    throw new Error("V1_HISTORICAL_SELECTED_OBSERVATION_REQUIRED");
  }
  validateAssimilatedObservationCandidateV1(
    historicalV1.selected_observation,
  );
  check(
    historicalV1.selected_observation.temporal_offset_seconds === 600,
    "historical V1 candidate validation remains unchanged",
  );

  console.log(
    `MCFT-CAP-03 S2 semantic-conformance remediation: ${pass} PASS, ${fail} FAIL`,
  );
  if (fail > 0) {
    process.exitCode = 1;
  }
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
