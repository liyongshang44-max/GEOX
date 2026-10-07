// apps/server/src/domain/operation_reconciliation/external_operation_source_evidence_v1.ts
//
// Purpose:
//   Vendor-neutral representation of an external operation source record.
//
// Boundary:
//   SOURCE EVIDENCE ONLY.
//
// This contract does NOT:
//   - reconcile provider field identity into GEOX field authority;
//   - create CanonicalObservation;
//   - create EvidenceQualification;
//   - create a GEOX Task;
//   - create a Receipt;
//   - create Acceptance;
//   - create Twin State;
//   - decide whether Target/Result deviation is acceptable.
//
// Target and Result remain source semantics.
// Reconciliation and acceptance are separate downstream authorities.

export const EXTERNAL_OPERATION_SOURCE_EVIDENCE_SCHEMA_VERSION_V1 =
  "external_operation_source_evidence_v1" as const;

export const EXTERNAL_OPERATION_SOURCE_EVIDENCE_AUTHORITY_V1 =
  "SOURCE_EVIDENCE_ONLY" as const;

export type ExternalOperationMeasurementRoleV1 =
  | "TARGET"
  | "RESULT";

export type ExternalOperationRetrievalTimeAuthorityV1 =
  | "EXACT"
  | "UNKNOWN";

export type ExternalOperationQuantityV1 = {
  quantity_kind: string;
  value: number;
  unit: string;
  source_variable_representation: string;
};

export type ExternalOperationMeasurementV1 = {
  role: ExternalOperationMeasurementRoleV1;
  source_measurement_name: string;
  external_application_product_id: string | null;
  product_name: string | null;
  quantities: ExternalOperationQuantityV1[];

  // Preserve provider-native nested product totals without
  // interpreting them as canonical product or quantity authority.
  source_product_totals: Record<string, unknown>[];
};

export type ExternalOperationProductV1 = {
  provider_product_guid: string | null;
  provider_product_id: string | null;
  name: string;
  product_type: string | null;
  tank_mix: boolean | null;

  // Source evidence cannot establish GEOX canonical product identity.
  canonical_product_id: null;
};

export type ExternalOperationMachineV1 = {
  name: string | null;
  vin: string | null;
  provider_machine_guid: string | null;
  provider_machine_erid: string | null;

  // Source evidence cannot establish GEOX canonical machine identity.
  canonical_machine_id: null;
};

export type ExternalOperationDiscoveredMeasurementV1 = {
  source_measurement_name: string;
  source_measurement_category: string;
};

export type ExternalOperationSourceEvidenceV1 = {
  schema_version:
    typeof EXTERNAL_OPERATION_SOURCE_EVIDENCE_SCHEMA_VERSION_V1;

  authority_state:
    typeof EXTERNAL_OPERATION_SOURCE_EVIDENCE_AUTHORITY_V1;

  source_data_class: string;

  provider: {
    provider_id: string;
    environment: string;
    external_organization_id: string | null;
  };

  provenance: {
    source_fixture_sha256: string | null;
    fixture_captured_at: string | null;
    source_modified_at: string | null;

    retrieved_at: string | null;
    retrieval_time_authority:
      ExternalOperationRetrievalTimeAuthorityV1;

    // Adapter output is pre-ledger source evidence.
    // A real GEOX source_fact_id must only appear after a
    // separate append/persistence authority step.
    source_fact_id: null;
    source_fact_state: "NOT_APPENDED";
    ingested_at: null;
    available_to_runtime_at: null;
  };

  external_identity: {
    external_operation_id: string;
    external_field_id: string;

    // External provider identity is never silently promoted.
    canonical_field_id: null;
    field_reconciliation_state: "UNRESOLVED";
  };

  operation: {
    operation_kind: string;
    execution_start: string;
    execution_end: string;
    crop_season: string | number | null;
  };

  products: ExternalOperationProductV1[];
  machines: ExternalOperationMachineV1[];

  measurements: ExternalOperationMeasurementV1[];

  measurements_discovered_but_not_expanded:
    ExternalOperationDiscoveredMeasurementV1[];

  limitations: string[];

  semantic_boundaries: {
    creates_canonical_observation: false;
    creates_evidence_qualification: false;
    creates_geox_task: false;
    creates_geox_receipt: false;
    creates_geox_acceptance: false;
    creates_twin_state: false;
    creates_business_closure: false;
  };
};

function requiredTextV1(
  value: unknown,
  code: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(code);
  }
  return value.trim();
}

function validInstantV1(
  value: unknown,
  code: string,
): string {
  const text = requiredTextV1(value, code);
  if (!Number.isFinite(Date.parse(text))) {
    throw new Error(code);
  }
  return text;
}

function nullableInstantV1(
  value: unknown,
  code: string,
): string | null {
  if (value == null) return null;
  return validInstantV1(value, code);
}

function assertFalseV1(
  value: unknown,
  code: string,
): void {
  if (value !== false) {
    throw new Error(code);
  }
}

/**
 * Runtime hard-boundary validation.
 *
 * This validates source-evidence semantics only.
 * It deliberately does not calculate Target/Result delta
 * and does not adjudicate operation success.
 */
export function validateExternalOperationSourceEvidenceV1(
  value: ExternalOperationSourceEvidenceV1,
): void {
  if (
    value.schema_version !==
    EXTERNAL_OPERATION_SOURCE_EVIDENCE_SCHEMA_VERSION_V1
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_SOURCE_SCHEMA_VERSION_MISMATCH",
    );
  }

  if (
    value.authority_state !==
    EXTERNAL_OPERATION_SOURCE_EVIDENCE_AUTHORITY_V1
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_SOURCE_AUTHORITY_ESCALATION",
    );
  }

  requiredTextV1(
    value.source_data_class,
    "EXTERNAL_OPERATION_SOURCE_DATA_CLASS_REQUIRED",
  );

  requiredTextV1(
    value.provider.provider_id,
    "EXTERNAL_OPERATION_PROVIDER_ID_REQUIRED",
  );

  requiredTextV1(
    value.provider.environment,
    "EXTERNAL_OPERATION_PROVIDER_ENVIRONMENT_REQUIRED",
  );

  if (value.provenance.source_fixture_sha256 != null) {
    if (
      !/^[0-9a-f]{64}$/.test(
        value.provenance.source_fixture_sha256,
      )
    ) {
      throw new Error(
        "EXTERNAL_OPERATION_SOURCE_FIXTURE_SHA256_INVALID",
      );
    }
  }

  nullableInstantV1(
    value.provenance.fixture_captured_at,
    "EXTERNAL_OPERATION_FIXTURE_CAPTURED_AT_INVALID",
  );

  nullableInstantV1(
    value.provenance.source_modified_at,
    "EXTERNAL_OPERATION_SOURCE_MODIFIED_AT_INVALID",
  );

  if (
    value.provenance.retrieval_time_authority === "UNKNOWN"
  ) {
    if (value.provenance.retrieved_at !== null) {
      throw new Error(
        "EXTERNAL_OPERATION_UNKNOWN_RETRIEVAL_TIME_MUST_BE_NULL",
      );
    }
  } else if (
    value.provenance.retrieval_time_authority === "EXACT"
  ) {
    validInstantV1(
      value.provenance.retrieved_at,
      "EXTERNAL_OPERATION_EXACT_RETRIEVAL_TIME_REQUIRED",
    );
  } else {
    throw new Error(
      "EXTERNAL_OPERATION_RETRIEVAL_TIME_AUTHORITY_INVALID",
    );
  }

  if (
    value.provenance.source_fact_id !== null ||
    value.provenance.source_fact_state !== "NOT_APPENDED"
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_SOURCE_FACT_FABRICATION_FORBIDDEN",
    );
  }

  if (
    value.provenance.ingested_at !== null ||
    value.provenance.available_to_runtime_at !== null
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_RUNTIME_TIME_FABRICATION_FORBIDDEN",
    );
  }

  requiredTextV1(
    value.external_identity.external_operation_id,
    "EXTERNAL_OPERATION_ID_REQUIRED",
  );

  requiredTextV1(
    value.external_identity.external_field_id,
    "EXTERNAL_OPERATION_FIELD_ID_REQUIRED",
  );

  if (
    value.external_identity.canonical_field_id !== null ||
    value.external_identity.field_reconciliation_state !==
      "UNRESOLVED"
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_FIELD_IDENTITY_PROMOTION_FORBIDDEN",
    );
  }

  const executionStart = validInstantV1(
    value.operation.execution_start,
    "EXTERNAL_OPERATION_EXECUTION_START_INVALID",
  );

  const executionEnd = validInstantV1(
    value.operation.execution_end,
    "EXTERNAL_OPERATION_EXECUTION_END_INVALID",
  );

  if (
    Date.parse(executionStart) >
    Date.parse(executionEnd)
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_EXECUTION_INTERVAL_INVALID",
    );
  }

  requiredTextV1(
    value.operation.operation_kind,
    "EXTERNAL_OPERATION_KIND_REQUIRED",
  );

  for (const product of value.products) {
    requiredTextV1(
      product.name,
      "EXTERNAL_OPERATION_PRODUCT_NAME_REQUIRED",
    );

    if (product.canonical_product_id !== null) {
      throw new Error(
        "EXTERNAL_OPERATION_PRODUCT_IDENTITY_PROMOTION_FORBIDDEN",
      );
    }
  }

  for (const machine of value.machines) {
    if (machine.canonical_machine_id !== null) {
      throw new Error(
        "EXTERNAL_OPERATION_MACHINE_IDENTITY_PROMOTION_FORBIDDEN",
      );
    }
  }

  for (const measurement of value.measurements) {
    if (
      measurement.role !== "TARGET" &&
      measurement.role !== "RESULT"
    ) {
      throw new Error(
        "EXTERNAL_OPERATION_MEASUREMENT_ROLE_INVALID",
      );
    }

    requiredTextV1(
      measurement.source_measurement_name,
      "EXTERNAL_OPERATION_MEASUREMENT_NAME_REQUIRED",
    );

    if (!Array.isArray(measurement.quantities)) {
      throw new Error(
        "EXTERNAL_OPERATION_QUANTITIES_REQUIRED",
      );
    }

    if (!Array.isArray(measurement.source_product_totals)) {
      throw new Error(
        "EXTERNAL_OPERATION_SOURCE_PRODUCT_TOTALS_REQUIRED",
      );
    }

    for (const quantity of measurement.quantities) {
      requiredTextV1(
        quantity.quantity_kind,
        "EXTERNAL_OPERATION_QUANTITY_KIND_REQUIRED",
      );

      if (!Number.isFinite(quantity.value)) {
        throw new Error(
          "EXTERNAL_OPERATION_QUANTITY_VALUE_INVALID",
        );
      }

      requiredTextV1(
        quantity.unit,
        "EXTERNAL_OPERATION_QUANTITY_UNIT_REQUIRED",
      );

      requiredTextV1(
        quantity.source_variable_representation,
        "EXTERNAL_OPERATION_SOURCE_VARIABLE_REPRESENTATION_REQUIRED",
      );
    }
  }

  if (
    !Array.isArray(value.limitations) ||
    value.limitations.length === 0 ||
    value.limitations.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim(),
    )
  ) {
    throw new Error(
      "EXTERNAL_OPERATION_LIMITATIONS_REQUIRED",
    );
  }

  assertFalseV1(
    value.semantic_boundaries.creates_canonical_observation,
    "EXTERNAL_OPERATION_CANONICAL_OBSERVATION_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_evidence_qualification,
    "EXTERNAL_OPERATION_EVIDENCE_QUALIFICATION_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_geox_task,
    "EXTERNAL_OPERATION_TASK_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_geox_receipt,
    "EXTERNAL_OPERATION_RECEIPT_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_geox_acceptance,
    "EXTERNAL_OPERATION_ACCEPTANCE_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_twin_state,
    "EXTERNAL_OPERATION_TWIN_STATE_CREATION_FORBIDDEN",
  );

  assertFalseV1(
    value.semantic_boundaries.creates_business_closure,
    "EXTERNAL_OPERATION_BUSINESS_CLOSURE_CREATION_FORBIDDEN",
  );

  const forbiddenTopLevelKeys = [
    "receipt",
    "acceptance",
    "decision_eligibility",
    "twin_state",
    "business_closure",
    "derived_comparison",
  ];

  const record =
    value as unknown as Record<string, unknown>;

  for (const key of forbiddenTopLevelKeys) {
    if (key in record) {
      throw new Error(
        `EXTERNAL_OPERATION_FORBIDDEN_SEMANTIC_SURFACE:${key}`,
      );
    }
  }
}
