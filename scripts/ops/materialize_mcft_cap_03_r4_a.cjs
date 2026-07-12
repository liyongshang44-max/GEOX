'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function replaceOnce(relativePath, before, after) {
  const target = filePath(relativePath);
  const current = fs.readFileSync(target, 'utf8');
  const first = current.indexOf(before);
  if (first < 0) {
    throw new Error(`R4_A_REPLACE_SOURCE_NOT_FOUND:${relativePath}`);
  }
  if (current.indexOf(before, first + before.length) >= 0) {
    throw new Error(`R4_A_REPLACE_SOURCE_NOT_UNIQUE:${relativePath}`);
  }
  fs.writeFileSync(
    target,
    current.slice(0, first) + after + current.slice(first + before.length),
    'utf8',
  );
}

const contractsPath =
  'apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts';
const selectorPath =
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts';

replaceOnce(
  contractsPath,
  `export type AssimilatedObservationSemanticHashBasisV2 = {\n  canonical_payload: Record<string, unknown>;\n  quality: AssimilatedObservationQualityV2;\n  source_unit: string;\n  canonical_unit: "fraction";\n  conversion_rule: AssimilatedObservationConversionRuleV2;\n  epistemic_class: "OBSERVED";\n};`,
  `export type AssimilatedObservationSemanticHashBasisV2 = {\n  canonical_payload: Record<string, unknown>;\n  quality: AssimilatedObservationQualityV2;\n  source_unit: string;\n  canonical_unit: string;\n  conversion_rule: AssimilatedObservationConversionRuleV2;\n  epistemic_class: "OBSERVED";\n};`,
);

replaceOnce(
  contractsPath,
  `    binding_id: string;\n    quantity_kind: "VOLUMETRIC_WATER_CONTENT";\n    canonical_value: number;`,
  `    binding_id: string;\n    quantity_kind: string;\n    canonical_value: number;`,
);

replaceOnce(
  contractsPath,
  `  if (candidate.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_QUANTITY_MISMATCH");\n  }\n  if (candidate.canonical_unit !== "fraction") {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_CANONICAL_UNIT_MISMATCH");\n  }`,
  `  const quantityKind = requiredStringV2(\n    candidate.quantity_kind,\n    "ASSIMILATION_V2_CANDIDATE_QUANTITY_REQUIRED",\n  );\n  const canonicalUnit = requiredStringV2(\n    candidate.canonical_unit,\n    "ASSIMILATION_V2_CANDIDATE_CANONICAL_UNIT_REQUIRED",\n  );`,
);

replaceOnce(
  contractsPath,
  `  if (canonicalPayload.unit !== "fraction") {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_UNIT_MISMATCH");\n  }\n  if (canonicalPayload.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_QUANTITY_MISMATCH");\n  }`,
  `  if (canonicalPayload.unit !== canonicalUnit) {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_UNIT_MISMATCH");\n  }\n  if (canonicalPayload.quantity_kind !== quantityKind) {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_QUANTITY_MISMATCH");\n  }`,
);

replaceOnce(
  contractsPath,
  `  validateStringArrayV2(\n    candidate.reason_codes,\n    "ASSIMILATION_V2_CANDIDATE_REASON_CODES_REQUIRED",\n  );`,
  `  const reasonCodes = validateStringArrayV2(\n    candidate.reason_codes,\n    "ASSIMILATION_V2_CANDIDATE_REASON_CODES_REQUIRED",\n  );\n  const assessment =\n    candidate.candidate_assessment as AssimilatedContinuationCandidateAssessmentV2;\n  if (\n    quantityKind !== "VOLUMETRIC_WATER_CONTENT"\n    && !reasonCodes.includes("REJECTED_QUANTITY")\n  ) {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_QUANTITY_REJECTION_TRACE_REQUIRED");\n  }\n  if (\n    canonicalUnit !== "fraction"\n    && !reasonCodes.includes("REJECTED_CANONICAL_UNIT")\n  ) {\n    throw new Error("ASSIMILATION_V2_CANDIDATE_UNIT_REJECTION_TRACE_REQUIRED");\n  }\n  if (\n    !assessment.startsWith("REJECTED_")\n    && (\n      quantityKind !== "VOLUMETRIC_WATER_CONTENT"\n      || canonicalUnit !== "fraction"\n    )\n  ) {\n    throw new Error("ASSIMILATION_V2_NON_REJECTED_CANDIDATE_NOT_AUTHORIZED");\n  }`,
);

replaceOnce(
  contractsPath,
  `    canonical_unit: "fraction",\n    conversion_rule: conversionRule,`,
  `    canonical_unit: canonicalUnit,\n    conversion_rule: conversionRule,`,
);

replaceOnce(
  contractsPath,
  `  const candidates = requiredArrayV2(\n    payload.candidate_observations,\n    "ASSIMILATION_V2_CANDIDATES_REQUIRED",\n  );\n\n  for (const candidate of candidates) {\n    validateAssimilatedObservationCandidateV2(candidate);\n  }`,
  `  const candidates = requiredArrayV2(\n    payload.candidate_observations,\n    "ASSIMILATION_V2_CANDIDATES_REQUIRED",\n  );\n\n  for (const candidate of candidates) {\n    validateAssimilatedObservationCandidateV2(candidate);\n  }\n  const candidateValues =\n    candidates as AssimilatedObservationCandidateV2[];`,
);

replaceOnce(
  contractsPath,
  `  const selected = payload.selected_observation_ref;\n  if (selected !== null) {\n    requiredStringV2(\n      selected,\n      "ASSIMILATION_V2_SELECTED_REF_INVALID",\n    );\n  }`,
  `  const selected = payload.selected_observation_ref;\n  let selectedCandidate: AssimilatedObservationCandidateV2 | null = null;\n  if (selected !== null) {\n    const selectedRef = requiredStringV2(\n      selected,\n      "ASSIMILATION_V2_SELECTED_REF_INVALID",\n    );\n    selectedCandidate = candidateValues.find(\n      (candidate) => candidate.observation_ref === selectedRef,\n    ) ?? null;\n    if (!selectedCandidate) {\n      throw new Error("ASSIMILATION_V2_SELECTED_CANDIDATE_NOT_FOUND");\n    }\n  }`,
);

replaceOnce(
  contractsPath,
  `  if (status === "APPLIED") {\n    const selectedRef = requiredStringV2(\n      selected,\n      "ASSIMILATION_V2_SELECTED_OBSERVATION_REQUIRED",\n    );\n    exactArrayV2(\n      evaluated,\n      [selectedRef],\n      "ASSIMILATION_V2_APPLIED_EVALUATED_REFS_MISMATCH",\n    );\n    exactArrayV2(\n      applied,\n      [selectedRef],\n      "ASSIMILATION_V2_APPLIED_REFS_MISMATCH",\n    );\n  }`,
  `  if (status === "APPLIED" || disposition === "REJECTED_OUTLIER") {\n    const selectedRef = requiredStringV2(\n      selected,\n      "ASSIMILATION_V2_SELECTED_OBSERVATION_REQUIRED",\n    );\n    if (\n      !selectedCandidate\n      || selectedCandidate.candidate_assessment !== "SELECTED"\n      || selectedCandidate.binding_id !== "soil_obs_c8_20cm_v1"\n      || selectedCandidate.quantity_kind !== "VOLUMETRIC_WATER_CONTENT"\n      || selectedCandidate.canonical_unit !== "fraction"\n      || selectedCandidate.quality_status === "FAIL"\n    ) {\n      throw new Error("ASSIMILATION_V2_SELECTED_CANDIDATE_NOT_AUTHORIZED");\n    }\n    exactArrayV2(\n      evaluated,\n      [selectedRef],\n      "ASSIMILATION_V2_EVALUATED_REFS_MUST_EQUAL_SELECTED",\n    );\n    exactArrayV2(\n      applied,\n      status === "APPLIED" ? [selectedRef] : [],\n      "ASSIMILATION_V2_APPLIED_REFS_STATUS_MISMATCH",\n    );\n  }`,
);

replaceOnce(
  selectorPath,
  `    source_unit: sourceUnit,\n    canonical_unit: "fraction",\n    conversion_rule: conversionRule,`,
  `    source_unit: sourceUnit,\n    canonical_unit: canonicalUnit,\n    conversion_rule: conversionRule,`,
);

replaceOnce(
  selectorPath,
  `    binding_id: record.binding_id,\n    quantity_kind: "VOLUMETRIC_WATER_CONTENT",\n    source_unit: sourceUnit,\n    canonical_unit: "fraction",`,
  `    binding_id: record.binding_id,\n    quantity_kind: quantityKind,\n    source_unit: sourceUnit,\n    canonical_unit: canonicalUnit,`,
);

replaceOnce(
  selectorPath,
  `  const selectedRef = selected?.candidate.observation_ref ?? null;\n  const evaluatedRefs = candidates\n    .map((candidate) => candidate.observation_ref)\n    .sort();`,
  `  const selectedRef = selected?.candidate.observation_ref ?? null;\n  const evaluatedRefs = selectedRef === null ? [] : [selectedRef];`,
);

const acceptance = `// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_A_EVIDENCE_CLASSIFICATION.ts
// Purpose: prove the full V2 Runtime tick preserves selected-only evaluated refs and commits legal NO_USABLE_OBSERVATION ticks for rejected-only candidate sets.
// Boundary: deterministic in-memory Replay acceptance only; no production database, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  AssimilatedContinuationTickServiceV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.js";
import {
  buildMcftCap03R2V2FixtureV1,
  memberR2V2,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

const MINUTE_MS = 60 * 1000;
let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(\`PASS \${message}\`);
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
}

function observationFrom(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1 {
  const observation = records.find(
    (record) => record.record_type === "soil_moisture_observation_v1",
  );
  assert.ok(observation);
  return structuredClone(observation);
}

function nonObservationRecords(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1[] {
  return records
    .filter((record) => record.record_type !== "soil_moisture_observation_v1")
    .map((record) => structuredClone(record));
}

function identify(
  record: CanonicalReplayEvidenceRecordV1,
  id: string,
): CanonicalReplayEvidenceRecordV1 {
  record.source_record_id = id;
  record.source_record_hash = \`sha256:\${id}\`;
  return record;
}

type FixtureV1 = Awaited<ReturnType<typeof buildMcftCap03R2V2FixtureV1>>;
type CandidateTransformV1 = (
  records: CanonicalReplayEvidenceRecordV1[],
  logicalTime: string,
) => CanonicalReplayEvidenceRecordV1[];

function tickServiceWithEvidence(
  fixture: FixtureV1,
  transform: CandidateTransformV1,
): AssimilatedContinuationTickServiceV2 {
  const evidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      const records = await fixture.runtime.loadCandidateRecords(input);
      return transform(
        records.map((record) => structuredClone(record)),
        input.logical_time,
      );
    },
  };

  return new AssimilatedContinuationTickServiceV2(
    fixture.handoffService,
    evidenceSource,
    fixture.runtime,
    fixture.runtime,
  );
}

async function proveMultipleUsableSelection(): Promise<void> {
  const fixture = await buildMcftCap03R2V2FixtureV1(1);
  const service = tickServiceWithEvidence(
    fixture,
    (records, logicalTime) => {
      const base = observationFrom(records);
      const older = identify(structuredClone(base), "obs_r4_multi_older");
      const latest = identify(structuredClone(base), "obs_r4_multi_latest");

      older.role_time = {
        ...older.role_time,
        observed_at: addMinutes(logicalTime, -10),
        ingested_at: addMinutes(logicalTime, -9),
      };
      older.available_to_runtime_at = addMinutes(logicalTime, -9);

      latest.role_time = {
        ...latest.role_time,
        observed_at: addMinutes(logicalTime, -5),
        ingested_at: addMinutes(logicalTime, -4),
      };
      latest.available_to_runtime_at = addMinutes(logicalTime, -4);

      return [...nonObservationRecords(records), older, latest];
    },
  );

  const result = await service.executeOneTick(fixture.tickInput());
  assert.equal(result.status, "INSERTED");
  assert.equal(result.assimilation?.status, "APPLIED");
  assert.equal(
    result.assimilation?.selected_observation_ref,
    "obs_r4_multi_latest",
  );
  assert.deepEqual(
    result.assimilation?.evaluated_observation_refs,
    ["obs_r4_multi_latest"],
  );
  assert.deepEqual(
    result.evidence_window?.assimilation_evaluated_evidence_refs,
    ["obs_r4_multi_latest"],
  );
  const candidates =
    result.evidence_window?.observation_selection.candidates ?? [];
  assert.equal(
    candidates.find(
      (candidate) => candidate.observation_ref === "obs_r4_multi_older",
    )?.candidate_assessment,
    "NOT_SELECTED_OLDER_USABLE",
  );
  const update = memberR2V2(
    result.record_set,
    "twin_assimilation_update_v1",
  );
  assert.deepEqual(
    update.payload.evaluated_observation_refs,
    ["obs_r4_multi_latest"],
  );
  ok("multiple usable observations commit with selected-only evaluated refs");
}

async function proveRejectedOnlyTick(input: {
  name: string;
  observationId: string;
  expectedAssessment: string;
  mutate: (
    observation: CanonicalReplayEvidenceRecordV1,
    logicalTime: string,
  ) => void;
}): Promise<void> {
  const fixture = await buildMcftCap03R2V2FixtureV1(1);
  const service = tickServiceWithEvidence(
    fixture,
    (records, logicalTime) => {
      const observation = identify(
        observationFrom(records),
        input.observationId,
      );
      input.mutate(observation, logicalTime);
      return [...nonObservationRecords(records), observation];
    },
  );

  const result = await service.executeOneTick(fixture.tickInput());
  assert.equal(result.status, "INSERTED");
  assert.equal(result.assimilation?.status, "NOT_APPLIED");
  assert.equal(
    result.assimilation?.disposition,
    "NO_USABLE_OBSERVATION",
  );
  assert.equal(result.assimilation?.selected_observation_ref, null);
  assert.deepEqual(result.assimilation?.evaluated_observation_refs, []);
  assert.deepEqual(result.assimilation?.applied_observation_refs, []);
  assert.deepEqual(result.assimilation?.consumed_observation_refs, []);
  assert.deepEqual(
    result.evidence_window?.assimilation_evaluated_evidence_refs,
    [],
  );
  assert.deepEqual(
    result.evidence_window?.assimilation_applied_evidence_refs,
    [],
  );
  assert.ok(
    result.evidence_window?.rejected_evidence_refs.includes(
      input.observationId,
    ),
  );
  assert.ok(
    !result.evidence_window?.consumed_evidence_refs.includes(
      input.observationId,
    ),
  );
  const candidate =
    result.evidence_window?.observation_selection.candidates.find(
      (value) => value.observation_ref === input.observationId,
    );
  assert.equal(candidate?.candidate_assessment, input.expectedAssessment);
  const update = memberR2V2(
    result.record_set,
    "twin_assimilation_update_v1",
  );
  assert.deepEqual(update.payload.evaluated_observation_refs, []);
  assert.equal(update.payload.state_correction_vwc, 0);
  ok(\`\${input.name} remains a rejected candidate and commits a legal NOT_APPLIED tick\`);
}

async function main(): Promise<void> {
  await proveMultipleUsableSelection();

  await proveRejectedOnlyTick({
    name: "stale-only observation",
    observationId: "obs_r4_stale_only",
    expectedAssessment: "REJECTED_TIME_STALE",
    mutate(observation, logicalTime) {
      observation.role_time = {
        ...observation.role_time,
        observed_at: addMinutes(logicalTime, -16),
        ingested_at: addMinutes(logicalTime, -5),
      };
      observation.available_to_runtime_at = addMinutes(logicalTime, -5);
    },
  });

  await proveRejectedOnlyTick({
    name: "FAIL-quality-only observation",
    observationId: "obs_r4_fail_only",
    expectedAssessment: "REJECTED_QUALITY_FAIL",
    mutate(observation) {
      observation.quality = { status: "FAIL" };
    },
  });

  await proveRejectedOnlyTick({
    name: "scope-mismatch-only observation",
    observationId: "obs_r4_scope_only",
    expectedAssessment: "REJECTED_SCOPE",
    mutate(observation) {
      observation.field_id = \`\${observation.field_id}_other\`;
    },
  });

  await proveRejectedOnlyTick({
    name: "binding-mismatch-only observation",
    observationId: "obs_r4_binding_only",
    expectedAssessment: "REJECTED_UNAUTHORIZED_BINDING",
    mutate(observation) {
      observation.binding_id = "soil_obs_unapproved_v1";
    },
  });

  await proveRejectedOnlyTick({
    name: "quantity-mismatch-only observation",
    observationId: "obs_r4_quantity_only",
    expectedAssessment: "REJECTED_QUANTITY",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        quantity_kind: "SOIL_TEMPERATURE",
      };
    },
  });

  await proveRejectedOnlyTick({
    name: "unit-mismatch-only observation",
    observationId: "obs_r4_unit_only",
    expectedAssessment: "REJECTED_CANONICAL_UNIT",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        unit: "percent",
      };
      observation.canonical_unit = "percent";
    },
  });

  await proveRejectedOnlyTick({
    name: "physical-bound-only observation",
    observationId: "obs_r4_physical_only",
    expectedAssessment: "REJECTED_PHYSICAL_BOUNDS",
    mutate(observation) {
      observation.canonical_payload = {
        ...observation.canonical_payload,
        value: 0.9,
      };
    },
  });

  console.log(
    \`MCFT-CAP-03 R4-A evidence classification: \${pass} PASS, 0 FAIL\`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

fs.writeFileSync(
  filePath(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_A_EVIDENCE_CLASSIFICATION.ts',
  ),
  acceptance,
  'utf8',
);

console.log('MCFT-CAP-03 R4-A materialization complete');
