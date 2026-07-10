// apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts
// Purpose: fail-closed dispatch between immutable MCFT-CAP-02 continuation records and MCFT-CAP-03 assimilated continuation records using Runtime Config purpose plus the CAP-03 tick discriminator.
// Boundary: pure validator dispatch only; no payload-shape guessing, insertion-order inference, persistence, filesystem, clock, network, or Runtime orchestration.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "./canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
} from "./assimilated_continuation_contracts_v1.js";
import type { AssimilatedContinuationRecordSetV1 } from "./assimilated_continuation_record_set_identity_v1.js";
import { validateAssimilatedContinuationRecordSetV1 } from "./assimilated_continuation_record_set_validator_v1.js";
import {
  ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1,
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
} from "./assimilated_continuation_runtime_config_v1.js";
import { validateContinuationRecordSetV1 } from "./continuation_cross_ref_validator_v1.js";
import type { ContinuationRecordSetV1 } from "./continuation_record_set_identity_v1.js";
import {
  CONTINUATION_CONFIG_PURPOSE_V1,
  validateContinuationRuntimeConfigPayloadV1,
} from "./continuation_runtime_config_v1.js";

export type VersionedContinuationRecordSetV1 =
  | ContinuationRecordSetV1
  | AssimilatedContinuationRecordSetV1;

export type ContinuationRecordSetDispatchResultV1 = {
  contract_id:
    | "MCFT_CAP_02_CONTINUATION_V1"
    | typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1;
  config_purpose:
    | typeof CONTINUATION_CONFIG_PURPOSE_V1
    | typeof ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1;
};

function runtimeTickV1(recordSet: VersionedContinuationRecordSetV1): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === "twin_runtime_tick_v1");
  if (matches.length !== 1) throw new Error("VALIDATOR_DISPATCH_TICK_CARDINALITY");
  return matches[0];
}

export function validateVersionedContinuationRecordSetV1(input: {
  record_set: VersionedContinuationRecordSetV1;
  runtime_config: CanonicalObjectEnvelopeV1;
}): ContinuationRecordSetDispatchResultV1 {
  validateCanonicalObjectV1(input.runtime_config);
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("VALIDATOR_DISPATCH_RUNTIME_CONFIG_TYPE_MISMATCH");
  if (input.runtime_config.object_id !== input.record_set.aggregate_identity_input.runtime_config_ref) throw new Error("VALIDATOR_DISPATCH_RUNTIME_CONFIG_REF_MISMATCH");
  if (input.runtime_config.determinism_hash !== input.record_set.aggregate_identity_input.runtime_config_hash) throw new Error("VALIDATOR_DISPATCH_RUNTIME_CONFIG_HASH_MISMATCH");

  const purpose = input.runtime_config.payload.config_purpose;
  const tick = runtimeTickV1(input.record_set);
  const discriminator = tick.payload.record_set_contract_id;
  const topLevelDiscriminator = "record_set_contract_id" in input.record_set
    ? input.record_set.record_set_contract_id
    : undefined;

  if (purpose === CONTINUATION_CONFIG_PURPOSE_V1) {
    if (discriminator !== undefined || topLevelDiscriminator !== undefined) throw new Error("VALIDATOR_DISPATCH_MISMATCH");
    validateContinuationRuntimeConfigPayloadV1(input.runtime_config.payload);
    validateContinuationRecordSetV1(input.record_set as ContinuationRecordSetV1);
    return {
      contract_id: "MCFT_CAP_02_CONTINUATION_V1",
      config_purpose: CONTINUATION_CONFIG_PURPOSE_V1,
    };
  }

  if (purpose === ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1) {
    if (discriminator !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
    if (topLevelDiscriminator !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) throw new Error("VALIDATOR_DISPATCH_MISMATCH");
    validateAssimilatedContinuationRuntimeConfigPayloadV1(input.runtime_config.payload);
    validateAssimilatedContinuationRecordSetV1(input.record_set as AssimilatedContinuationRecordSetV1);
    return {
      contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
      config_purpose: ASSIMILATED_CONTINUATION_CONFIG_PURPOSE_V1,
    };
  }

  throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
}
