import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  adaptDeereFieldOperationV1,
} from "./deere_field_operation_adapter_v1.js";

import {
  validateExternalOperationSourceEvidenceV1,
  type ExternalOperationSourceEvidenceV1,
} from "../../../domain/operation_reconciliation/external_operation_source_evidence_v1.js";

const EXPECTED_FIXTURE_SHA256 =
  "b153849b8ec5fb4e7b62f4303476233c8c82d1123fd56e3e376134e2390f8f85";

const fixturePath = path.resolve(
  process.cwd(),
  "../../fixtures/external_operations/john_deere/single_product_rx_v1.json",
);

const fixtureBytes = fs.readFileSync(fixturePath);

// Preserve the exact source bytes for SHA256 identity.
// Windows PowerShell-created UTF-8 JSON may contain a leading BOM;
// strip it only from the decoded text used by JSON.parse.
const fixtureRaw = fixtureBytes
  .toString("utf8")
  .replace(/^\uFEFF/, "");

const fixture = JSON.parse(fixtureRaw) as unknown;

function adapt(): ExternalOperationSourceEvidenceV1 {
  return adaptDeereFieldOperationV1({
    fixture,
    source_fixture_sha256:
      EXPECTED_FIXTURE_SHA256,
    source_data_class:
      "JOHN_DEERE_OFFICIAL_SAMPLE_DATA",
    provider_environment:
      "SANDBOX",
  });
}

test("Deere fixture exact SHA256 is frozen", () => {
  const actual = crypto
    .createHash("sha256")
    .update(fixtureBytes)
    .digest("hex");

  assert.equal(
    actual,
    EXPECTED_FIXTURE_SHA256,
  );
});

test("Deere adapter preserves source-only authority boundary", () => {
  const output = adapt();

  assert.equal(
    output.authority_state,
    "SOURCE_EVIDENCE_ONLY",
  );

  assert.equal(
    output.provider.provider_id,
    "JOHN_DEERE_OPERATIONS_CENTER",
  );

  assert.equal(
    output.external_identity.external_operation_id,
    "fa05d132-67f2-4587-aa84-e91bc981edc5",
  );

  assert.equal(
    output.external_identity.external_field_id,
    "781068d5-f9ff-452e-8901-a5df247d0424",
  );

  assert.equal(
    output.external_identity.canonical_field_id,
    null,
  );

  assert.equal(
    output.external_identity.field_reconciliation_state,
    "UNRESOLVED",
  );

  assert.equal(
    output.provenance.source_fact_id,
    null,
  );

  assert.equal(
    output.provenance.retrieved_at,
    null,
  );

  assert.equal(
    output.provenance.available_to_runtime_at,
    null,
  );

  for (
    const value of
    Object.values(output.semantic_boundaries)
  ) {
    assert.equal(value, false);
  }

  assert.equal(
    "derived_comparison" in
      (output as unknown as Record<string, unknown>),
    false,
  );
});

test("Deere adapter keeps Target and Result distinct", () => {
  const output = adapt();

  const target = output.measurements.filter(
    (measurement) =>
      measurement.role === "TARGET",
  );

  const result = output.measurements.filter(
    (measurement) =>
      measurement.role === "RESULT",
  );

  assert.equal(target.length, 1);
  assert.equal(result.length, 1);

  assert.equal(
    target[0]?.source_measurement_name,
    "ApplicationRateTarget",
  );

  assert.equal(
    result[0]?.source_measurement_name,
    "ApplicationRateResult",
  );

  assert.deepEqual(
    target[0]?.quantities.map(
      (quantity) => quantity.quantity_kind,
    ),
    [
      "TASK_AREA",
      "AVERAGE_SPEED",
      "TOTAL_MATERIAL",
      "APPLICATION_RATE",
    ],
  );

  assert.deepEqual(
    result[0]?.quantities.map(
      (quantity) => quantity.quantity_kind,
    ),
    [
      "TASK_AREA",
      "APPLIED_AREA",
      "AVERAGE_SPEED",
      "TOTAL_MATERIAL",
      "APPLICATION_RATE",
    ],
  );
});

test("Deere adapter preserves exact Target and Result quantities", () => {
  const output = adapt();

  const target = output.measurements.find(
    (measurement) =>
      measurement.role === "TARGET",
  )!;

  const result = output.measurements.find(
    (measurement) =>
      measurement.role === "RESULT",
  )!;

  const targetTotal =
    target.quantities.find(
      (quantity) =>
        quantity.quantity_kind ===
        "TOTAL_MATERIAL",
    )!;

  const resultTotal =
    result.quantities.find(
      (quantity) =>
        quantity.quantity_kind ===
        "TOTAL_MATERIAL",
    )!;

  const targetRate =
    target.quantities.find(
      (quantity) =>
        quantity.quantity_kind ===
        "APPLICATION_RATE",
    )!;

  const resultRate =
    result.quantities.find(
      (quantity) =>
        quantity.quantity_kind ===
        "APPLICATION_RATE",
    )!;

  assert.equal(
    targetTotal.value,
    582.7427610445322,
  );

  assert.equal(
    targetTotal.unit,
    "l",
  );

  assert.equal(
    targetTotal.source_variable_representation,
    "vrTotalQuantityTargetVolume",
  );

  assert.equal(
    resultTotal.value,
    590.9000000000001,
  );

  assert.equal(
    resultTotal.source_variable_representation,
    "vrTotalQuantityAppliedVolume",
  );

  assert.equal(
    targetRate.value,
    120.9104702379268,
  );

  assert.equal(
    targetRate.source_variable_representation,
    "vrAppRateVolumeTarget",
  );

  assert.equal(
    resultRate.value,
    122.60297620090243,
  );

  assert.equal(
    resultRate.source_variable_representation,
    "vrAppRateVolumeMeasured",
  );
});

test("Deere adapter preserves provider-native nested product totals", () => {
  const output = adapt();

  const target = output.measurements.find(
    (measurement) =>
      measurement.role === "TARGET",
  )!;

  const result = output.measurements.find(
    (measurement) =>
      measurement.role === "RESULT",
  )!;

  assert.equal(
    target.source_product_totals.length,
    1,
  );

  assert.equal(
    result.source_product_totals.length,
    1,
  );

  assert.equal(
    target.source_product_totals[0]?.productId,
    "77421064-447c-4a2b-8dda-141d37cccf78",
  );

  assert.equal(
    result.source_product_totals[0]?.productId,
    "77421064-447c-4a2b-8dda-141d37cccf78",
  );
});

test("Deere adapter inventories discovered but unfetched measurement detail", () => {
  const output = adapt();

  assert.deepEqual(
    output.measurements_discovered_but_not_expanded,
    [{
      source_measurement_name:
        "ApplicationSpeedResult",
      source_measurement_category:
        "Result",
    }],
  );
});

test("Deere adapter rejects Target/Result semantic collapse", () => {
  const mutated =
    JSON.parse(fixtureRaw) as {
      target: {
        measurementCategory: string;
      };
    };

  mutated.target.measurementCategory =
    "Result";

  assert.throws(
    () =>
      adaptDeereFieldOperationV1({
        fixture: mutated,
        source_fixture_sha256:
          EXPECTED_FIXTURE_SHA256,
        source_data_class:
          "JOHN_DEERE_OFFICIAL_SAMPLE_DATA",
        provider_environment:
          "SANDBOX",
      }),
    /DEERE_TARGET_MEASUREMENT_CATEGORY_MISMATCH/,
  );
});

test("external operation contract rejects field authority promotion", () => {
  const output = adapt();

  const mutated = {
    ...output,
    external_identity: {
      ...output.external_identity,
      canonical_field_id:
        "field_c8_demo",
    },
  } as unknown as ExternalOperationSourceEvidenceV1;

  assert.throws(
    () =>
      validateExternalOperationSourceEvidenceV1(
        mutated,
      ),
    /EXTERNAL_OPERATION_FIELD_IDENTITY_PROMOTION_FORBIDDEN/,
  );
});
