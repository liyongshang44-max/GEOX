// apps/server/src/domain/twin_runtime/forecast_scenario_record_set_dispatch_v1.ts
// Purpose: explicitly dispatch immutable CAP-02, CAP-03 V1/V2 and CAP-04 A1/A2/B contracts without shape inference or fallback.
// Boundary: pure validation dispatch only; no persistence, projection, Runtime orchestration, filesystem, clock or network.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  validateVersionedContinuationRecordSetV1,
  type VersionedContinuationRecordSetV1,
} from "./continuation_record_set_dispatch_v1.js";
import {
  CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1,
  CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
} from "./forecast_scenario_contracts_v1.js";
import type {
  Cap04ARecordSetV1,
  Cap04ScenarioSetRecordV1,
} from "./forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "./forecast_scenario_record_set_validator_v1.js";
import {
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";

export type Cap04VersionedRecordSetV1 =
  | VersionedContinuationRecordSetV1
  | Cap04ARecordSetV1
  | Cap04ScenarioSetRecordV1;

export type Cap04DispatchResultV1 = {
  contract_id:
    | "MCFT_CAP_02_CONTINUATION_V1"
    | "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1"
    | "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2"
    | typeof CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1
    | typeof CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1
    | typeof CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1;
  config_purpose: string;
};

export function validateCap04VersionedRecordSetV1(input: {
  record_set: Cap04VersionedRecordSetV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  source_forecast?: CanonicalObjectEnvelopeV1;
}): Cap04DispatchResultV1 {
  const purpose = input.runtime_config.payload.config_purpose;
  if (purpose !== CAP04_RUNTIME_CONFIG_PURPOSE_V1) {
    return validateVersionedContinuationRecordSetV1({
      record_set: input.record_set as VersionedContinuationRecordSetV1,
      runtime_config: input.runtime_config,
    });
  }
  validateCap04RuntimeConfigPayloadV1(input.runtime_config.payload);
  const contractId = (input.record_set as { record_set_contract_id?: unknown }).record_set_contract_id;
  if (contractId === CAP04_COMPLETED_FORECAST_CONTRACT_ID_V1 || contractId === CAP04_BLOCKED_FORECAST_CONTRACT_ID_V1) {
    validateCap04ARecordSetV1(input.record_set as Cap04ARecordSetV1);
  } else if (contractId === CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1) {
    if (!input.source_forecast) throw new Error("CAP04_DISPATCH_SOURCE_FORECAST_REQUIRED");
    validateCap04ScenarioSetRecordV1(input.record_set as Cap04ScenarioSetRecordV1, input.source_forecast);
  } else {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
  return { contract_id: contractId, config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1 };
}
