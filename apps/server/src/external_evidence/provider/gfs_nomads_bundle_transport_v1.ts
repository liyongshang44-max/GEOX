// MCFT-CAP-09 Phase 3 product GFS aggregate-bundle transport.
// It adapts the retained-member GFS composer into the canonical ExternalEvidenceTransportPort.
// Underlying NOMADS objects are retained before parsing/composition by the composer; the resulting
// deterministic tar is then retained by the generic Evidence pipeline before product decode.

import type {
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "./gfs_nomads_raw_bundle_composer_v1.js";

export const MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1 =
  "MCFT_CAP09_GFS_NOMADS_BUNDLE_PROVIDER_V1" as const;
export const MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1 =
  "GFS_RAW_BUNDLE_72H_V1" as const;
export const MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1 =
  "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/" as const;

function canonicalHourV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}

export function buildGfsNomadsBundleFetchRequestV1(input: {
  request_id: string;
  requested_at: string;
  target_logical_time: string;
}): ExternalEvidenceFetchRequestV1 {
  const requestId = input.request_id.trim();
  if (!requestId) throw new Error("PHASE3_GFS_BUNDLE_REQUEST_ID_REQUIRED");
  const requestedAtMs = Date.parse(input.requested_at);
  if (!Number.isFinite(requestedAtMs) || new Date(requestedAtMs).toISOString() !== input.requested_at) {
    throw new Error("PHASE3_GFS_BUNDLE_REQUESTED_AT_INVALID");
  }
  const target = canonicalHourV1(input.target_logical_time, "PHASE3_GFS_BUNDLE_TARGET_INVALID");
  return {
    request_id: requestId,
    provider_id: MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
    source_family: MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
    locator: MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,
    allowed_final_hosts: ["nomads.ncep.noaa.gov"],
    use_policy_ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    requested_at: input.requested_at,
    source_event_time: target,
    expected_content_type_prefixes: ["application/x-tar"],
    limitations: [
      "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      "DETERMINISTIC_AGGREGATE_OF_RETAINED_NOMADS_OBJECTS",
      "NO_PUBLIC_RAW_VALUE_EMISSION",
    ],
  };
}

export class GfsNomadsBundleTransportV1 implements ExternalEvidenceTransportPortV1 {
  readonly transport_id = "MCFT_CAP09_GFS_NOMADS_BUNDLE_TRANSPORT_V1" as const;
  provider_request_count = 0;

  constructor(
    private readonly composer: Pick<GfsNomadsRawBundleComposerV1, "compose">,
    private readonly targetLogicalTime: string,
    private readonly requestIdPrefix: string,
  ) {
    canonicalHourV1(targetLogicalTime, "PHASE3_GFS_BUNDLE_TRANSPORT_TARGET_INVALID");
    if (!requestIdPrefix.trim()) throw new Error("PHASE3_GFS_BUNDLE_TRANSPORT_REQUEST_PREFIX_REQUIRED");
  }

  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (request.provider_id !== MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1) {
      throw new Error("PHASE3_GFS_BUNDLE_PROVIDER_ID_MISMATCH");
    }
    if (request.source_family !== MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1) {
      throw new Error("PHASE3_GFS_BUNDLE_SOURCE_FAMILY_MISMATCH");
    }
    if (request.locator !== MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1) {
      throw new Error("PHASE3_GFS_BUNDLE_LOCATOR_MISMATCH");
    }
    if (request.source_event_time !== this.targetLogicalTime) {
      throw new Error("PHASE3_GFS_BUNDLE_TARGET_MISMATCH");
    }
    const result = await this.composer.compose({
      target_logical_time: this.targetLogicalTime,
      request_id_prefix: this.requestIdPrefix,
    });
    this.provider_request_count += result.provider_request_count;
    return {
      status: 200,
      final_locator: MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,
      content_type: "application/x-tar",
      retrieved_at: result.retrieved_at,
      available_at: result.retrieved_at,
      bytes: result.bundle_bytes,
    };
  }
}
