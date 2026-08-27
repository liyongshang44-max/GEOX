// apps/server/src/adapters/external_operations/john_deere/deere_field_operation_adapter_v1.ts
//
// John Deere Operations Center -> vendor-neutral external operation
// source evidence.
//
// Boundary:
//   Deere source semantics -> ExternalOperationSourceEvidenceV1 only.
//
// This adapter never creates:
//   CanonicalObservation / EvidenceQualification / Task / Receipt /
//   Acceptance / Twin State / Business Closure.
//
// It also never computes Target-vs-Result deviation.

import {
  validateExternalOperationSourceEvidenceV1,
  type ExternalOperationMeasurementV1,
  type ExternalOperationQuantityV1,
  type ExternalOperationSourceEvidenceV1,
} from "../../../domain/operation_reconciliation/external_operation_source_evidence_v1.js";

export const DEERE_OPERATIONS_CENTER_PROVIDER_ID_V1 =
  "JOHN_DEERE_OPERATIONS_CENTER" as const;

export type AdaptDeereFieldOperationInputV1 = {
  fixture: unknown;
  source_fixture_sha256: string;
  source_data_class: string;
  provider_environment: string;
};

function asRecordV1(
  value: unknown,
  code: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(code);
  }

  return value as Record<string, unknown>;
}

function asArrayV1(
  value: unknown,
  code: string,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(code);
  }

  return value;
}

function requiredTextV1(
  value: unknown,
  code: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(code);
  }

  return value.trim();
}

function nullableTextV1(
  value: unknown,
): string | null {
  if (value == null) return null;

  if (typeof value !== "string") {
    return String(value);
  }

  const text = value.trim();
  return text || null;
}

function nullableBooleanV1(
  value: unknown,
  code: string,
): boolean | null {
  if (value == null) return null;

  if (typeof value !== "boolean") {
    throw new Error(code);
  }

  return value;
}

function finiteNumberV1(
  value: unknown,
  code: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(code);
  }

  return value;
}

function cloneSourceRecordV1(
  value: unknown,
  code: string,
): Record<string, unknown> {
  const record = asRecordV1(value, code);

  return JSON.parse(
    JSON.stringify(record),
  ) as Record<string, unknown>;
}

function mapEventMeasurementV1(
  source: Record<string, unknown>,
  field: string,
  quantityKind: string,
): ExternalOperationQuantityV1[] {
  const raw = source[field];

  if (raw == null) {
    return [];
  }

  const measurement = asRecordV1(
    raw,
    `DEERE_${field.toUpperCase()}_MEASUREMENT_INVALID`,
  );

  return [{
    quantity_kind: quantityKind,
    value: finiteNumberV1(
      measurement.value,
      `DEERE_${field.toUpperCase()}_VALUE_INVALID`,
    ),
    unit: requiredTextV1(
      measurement.unitId,
      `DEERE_${field.toUpperCase()}_UNIT_REQUIRED`,
    ),
    source_variable_representation: requiredTextV1(
      measurement.variableRepresentation,
      `DEERE_${field.toUpperCase()}_VARIABLE_REPRESENTATION_REQUIRED`,
    ),
  }];
}

function mapApplicationProductTotalsV1(
  measurementObject: Record<string, unknown>,
  role: "TARGET" | "RESULT",
): ExternalOperationMeasurementV1[] {
  const category = requiredTextV1(
    measurementObject.measurementCategory,
    `DEERE_${role}_MEASUREMENT_CATEGORY_REQUIRED`,
  );

  const expectedCategory =
    role === "TARGET" ? "Target" : "Result";

  if (category !== expectedCategory) {
    throw new Error(
      `DEERE_${role}_MEASUREMENT_CATEGORY_MISMATCH`,
    );
  }

  const measurementName = requiredTextV1(
    measurementObject.measurementName,
    `DEERE_${role}_MEASUREMENT_NAME_REQUIRED`,
  );

  const totals = asArrayV1(
    measurementObject.applicationProductTotals,
    `DEERE_${role}_APPLICATION_PRODUCT_TOTALS_REQUIRED`,
  );

  if (totals.length === 0) {
    throw new Error(
      `DEERE_${role}_APPLICATION_PRODUCT_TOTALS_EMPTY`,
    );
  }

  return totals.map((rawTotal, index) => {
    const total = asRecordV1(
      rawTotal,
      `DEERE_${role}_APPLICATION_PRODUCT_TOTAL_INVALID:${index}`,
    );

    const quantities: ExternalOperationQuantityV1[] = [
      ...mapEventMeasurementV1(
        total,
        "area",
        "TASK_AREA",
      ),
      ...mapEventMeasurementV1(
        total,
        "appliedArea",
        "APPLIED_AREA",
      ),
      ...mapEventMeasurementV1(
        total,
        "averageSpeed",
        "AVERAGE_SPEED",
      ),
      ...mapEventMeasurementV1(
        total,
        "totalMaterial",
        "TOTAL_MATERIAL",
      ),
      ...mapEventMeasurementV1(
        total,
        "averageMaterial",
        "APPLICATION_RATE",
      ),
    ];

    if (quantities.length === 0) {
      throw new Error(
        `DEERE_${role}_NO_SUPPORTED_QUANTITIES:${index}`,
      );
    }

    const sourceProductTotals =
      total.productTotals == null
        ? []
        : asArrayV1(
            total.productTotals,
            `DEERE_${role}_PRODUCT_TOTALS_INVALID:${index}`,
          ).map((item, componentIndex) =>
            cloneSourceRecordV1(
              item,
              `DEERE_${role}_PRODUCT_TOTAL_INVALID:${index}:${componentIndex}`,
            ),
          );

    return {
      role,
      source_measurement_name: measurementName,
      external_application_product_id:
        nullableTextV1(total.productId),
      product_name:
        nullableTextV1(total.name),
      quantities,
      source_product_totals: sourceProductTotals,
    };
  });
}

function cropSeasonV1(
  value: unknown,
): string | number | null {
  if (value == null) return null;

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }

  throw new Error(
    "DEERE_CROP_SEASON_SHAPE_UNSUPPORTED_V1",
  );
}

export function adaptDeereFieldOperationV1(
  input: AdaptDeereFieldOperationInputV1,
): ExternalOperationSourceEvidenceV1 {
  const fixture = asRecordV1(
    input.fixture,
    "DEERE_FIXTURE_INVALID",
  );

  const operation = asRecordV1(
    fixture.operation,
    "DEERE_OPERATION_REQUIRED",
  );

  const target = asRecordV1(
    fixture.target,
    "DEERE_TARGET_MEASUREMENT_REQUIRED",
  );

  const result = asRecordV1(
    fixture.result,
    "DEERE_RESULT_MEASUREMENT_REQUIRED",
  );

  const measurementTypes = asRecordV1(
    fixture.measurement_types,
    "DEERE_MEASUREMENT_TYPES_REQUIRED",
  );

  const targetMeasurements =
    mapApplicationProductTotalsV1(
      target,
      "TARGET",
    );

  const resultMeasurements =
    mapApplicationProductTotalsV1(
      result,
      "RESULT",
    );

  const expandedNames = new Set([
    requiredTextV1(
      target.measurementName,
      "DEERE_TARGET_MEASUREMENT_NAME_REQUIRED",
    ),
    requiredTextV1(
      result.measurementName,
      "DEERE_RESULT_MEASUREMENT_NAME_REQUIRED",
    ),
  ]);

  const products =
    operation.products == null
      ? []
      : asArrayV1(
          operation.products,
          "DEERE_PRODUCTS_INVALID",
        ).map((rawProduct, index) => {
          const product = asRecordV1(
            rawProduct,
            `DEERE_PRODUCT_INVALID:${index}`,
          );

          return {
            provider_product_guid:
              nullableTextV1(product.guid),
            provider_product_id:
              nullableTextV1(product.productId),
            name: requiredTextV1(
              product.name,
              `DEERE_PRODUCT_NAME_REQUIRED:${index}`,
            ),
            product_type:
              nullableTextV1(product.productType),
            tank_mix: nullableBooleanV1(
              product.tankMix,
              `DEERE_PRODUCT_TANK_MIX_INVALID:${index}`,
            ),
            canonical_product_id: null,
          } as const;
        });

  const machines =
    operation.fieldOperationMachines == null
      ? []
      : asArrayV1(
          operation.fieldOperationMachines,
          "DEERE_MACHINES_INVALID",
        ).map((rawMachine, index) => {
          const machine = asRecordV1(
            rawMachine,
            `DEERE_MACHINE_INVALID:${index}`,
          );

          return {
            name: nullableTextV1(machine.name),
            vin: nullableTextV1(machine.vin),
            provider_machine_guid:
              nullableTextV1(machine.GUID),
            provider_machine_erid:
              nullableTextV1(machine.erid),
            canonical_machine_id: null,
          } as const;
        });

  const discovered =
    asArrayV1(
      measurementTypes.values,
      "DEERE_MEASUREMENT_TYPE_VALUES_REQUIRED",
    )
      .map((rawMeasurement, index) => {
        const measurement = asRecordV1(
          rawMeasurement,
          `DEERE_MEASUREMENT_TYPE_INVALID:${index}`,
        );

        return {
          source_measurement_name:
            requiredTextV1(
              measurement.measurementName,
              `DEERE_DISCOVERED_MEASUREMENT_NAME_REQUIRED:${index}`,
            ),
          source_measurement_category:
            requiredTextV1(
              measurement.measurementCategory,
              `DEERE_DISCOVERED_MEASUREMENT_CATEGORY_REQUIRED:${index}`,
            ),
        };
      })
      .filter(
        (measurement) =>
          !expandedNames.has(
            measurement.source_measurement_name,
          ),
      );

  const output: ExternalOperationSourceEvidenceV1 = {
    schema_version:
      "external_operation_source_evidence_v1",

    authority_state:
      "SOURCE_EVIDENCE_ONLY",

    source_data_class:
      requiredTextV1(
        input.source_data_class,
        "DEERE_SOURCE_DATA_CLASS_REQUIRED",
      ),

    provider: {
      provider_id:
        DEERE_OPERATIONS_CENTER_PROVIDER_ID_V1,
      environment:
        requiredTextV1(
          input.provider_environment,
          "DEERE_PROVIDER_ENVIRONMENT_REQUIRED",
        ),
      external_organization_id:
        nullableTextV1(fixture.organization_id),
    },

    provenance: {
      source_fixture_sha256:
        requiredTextV1(
          input.source_fixture_sha256,
          "DEERE_FIXTURE_SHA256_REQUIRED",
        ),
      fixture_captured_at:
        nullableTextV1(fixture.captured_at),
      source_modified_at:
        nullableTextV1(operation.modifiedTime),

      retrieved_at: null,
      retrieval_time_authority: "UNKNOWN",

      source_fact_id: null,
      source_fact_state: "NOT_APPENDED",

      ingested_at: null,
      available_to_runtime_at: null,
    },

    external_identity: {
      external_operation_id:
        requiredTextV1(
          operation.id,
          "DEERE_OPERATION_ID_REQUIRED",
        ),

      external_field_id:
        requiredTextV1(
          fixture.field_id,
          "DEERE_FIELD_ID_REQUIRED",
        ),

      canonical_field_id: null,
      field_reconciliation_state:
        "UNRESOLVED",
    },

    operation: {
      operation_kind:
        requiredTextV1(
          operation.fieldOperationType,
          "DEERE_OPERATION_KIND_REQUIRED",
        ).toUpperCase(),

      execution_start:
        requiredTextV1(
          operation.startDate,
          "DEERE_EXECUTION_START_REQUIRED",
        ),

      execution_end:
        requiredTextV1(
          operation.endDate,
          "DEERE_EXECUTION_END_REQUIRED",
        ),

      crop_season:
        cropSeasonV1(operation.cropSeason),
    },

    products,
    machines,

    measurements: [
      ...targetMeasurements,
      ...resultMeasurements,
    ],

    measurements_discovered_but_not_expanded:
      discovered,

    limitations: [
      "SANDBOX_SAMPLE_DATA_NOT_CUSTOMER_PRODUCTION",
      "FIELD_IDENTITY_UNRECONCILED",
      "PRODUCT_IDENTITY_UNRECONCILED",
      "MACHINE_IDENTITY_UNRECONCILED",
      "SOURCE_FACT_NOT_APPENDED",
      "EXACT_RETRIEVAL_TIME_NOT_ESTABLISHED",
      "RUNTIME_AVAILABILITY_NOT_ESTABLISHED",
      "PARTIAL_MEASUREMENT_DETAIL_CAPTURE",
      "NO_BUSINESS_ACCEPTANCE_AUTHORITY",
    ],

    semantic_boundaries: {
      creates_canonical_observation: false,
      creates_evidence_qualification: false,
      creates_geox_task: false,
      creates_geox_receipt: false,
      creates_geox_acceptance: false,
      creates_twin_state: false,
      creates_business_closure: false,
    },
  };

  validateExternalOperationSourceEvidenceV1(
    output,
  );

  return output;
}
