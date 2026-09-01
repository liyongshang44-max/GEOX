import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceTransportPortV1,
  type RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  PostgresExternalFormalEvidenceIngressV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  PostgresExternalEvidenceFactReplayProvenanceV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_external_evidence_fact_replay_provenance_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_V1_RESULT.json",
);
const DATABASE_URL = process.env.DATABASE_URL || "";
const ISSUED = "2026-08-31T18:00:00.000Z";
const AVAILABLE = "2026-08-31T18:04:00.000Z";
const RETRIEVED = "2026-08-31T18:05:00.000Z";
const RETAINED = "2026-08-31T18:07:00.000Z";
const INGESTED = "2026-08-31T18:08:00.000Z";
const CANONICALIZED = "2026-08-31T18:09:00.000Z";
const REQUEST_ID = "gfs-cycle-20260831t18z-focused";
const SOURCE_LOCATOR = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?focused=1";
const ORIGIN = "gfs_20260831t18z_pgrb2_0p25_kbs";
const SOURCE_RECORD = "gfs:20260831t18z:future-weather";

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
}

async function main(): Promise<void> {
  assert.match(DATABASE_URL, /^postgres(?:ql)?:\/\//);
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  let providerRequestCount = 0;
  let retentionCount = 0;
  let retentionVerifyCount = 0;
  try {
    await pool.query("DELETE FROM public.facts");

    const raw = new TextEncoder().encode("focused-gfs-retained-bundle");
    const transport: ExternalEvidenceTransportPortV1 = {
      async fetchRawEvidence(request) {
        providerRequestCount += 1;
        assert.equal(request.request_id, REQUEST_ID);
        assert.equal(request.locator, SOURCE_LOCATOR);
        return {
          status: 200,
          final_locator: SOURCE_LOCATOR,
          content_type: "application/x-tar",
          retrieved_at: RETRIEVED,
          available_at: AVAILABLE,
          bytes: raw,
        };
      },
    };
    const retention: RawEvidenceRetentionPortV1 = {
      async retainRawEvidence(input) {
        retentionCount += 1;
        return {
          retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
          retention_ref: "s3-private://qualification/replay-provenance/" + input.raw_sha256.slice(7),
          retained_sha256: input.raw_sha256,
          retained_bytes: input.raw_bytes,
          retained_at: RETAINED,
          externally_publishable: false,
        };
      },
    };
    const decoder: ExternalEvidenceDecoderPortV1 = {
      decoder_id: "MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_V1",
      decoder_version: "1",
      async decodeRetainedEvidence(input) {
        assert.equal(input.provenance.request_id, REQUEST_ID);
        assert.equal(input.provenance.source_locator, SOURCE_LOCATOR);
        return [{
          role: "FUTURE_WEATHER_ASSUMPTION",
          source_record_id: SOURCE_RECORD,
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
          origin_source_kind: "NOAA_NCEP_GFS_PGRB2_0P25",
          origin_source_id: ORIGIN,
          epistemic_class: "ASSUMED",
          available_to_runtime_at: AVAILABLE,
          role_time: { issued_at: ISSUED, ingested_at: INGESTED },
          quality: { status: "PASS" },
          source_payload: { cycle_key: "20260831T18Z", point_count: 72 },
          canonical_payload: { point_count: 72, values_embedded_in_public_result: false },
          source_unit: "governed_multi_variable_bundle",
          canonical_unit: "governed_multi_variable_bundle",
          conversion_rule: {
            conversion_rule_id: "FOCUSED_GFS_REPLAY_PROVENANCE_RULE_V1",
            conversion_rule_version: "1",
            authority_ref: "GEOX-MCFT-CAP-09-AMENDMENT-01",
          },
          source_binding_version: 1,
          limitations: ["FOCUSED_QUALIFICATION_ONLY"],
        }];
      },
    };

    const [canonical] = await collectRetainDecodeCanonicalizeExternalEvidenceV1(
      {
        dataset_id: "gfs_replay_provenance_focused_v1",
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: {
          request_id: REQUEST_ID,
          provider_id: "NOAA_NCEP_GFS",
          source_family: "GFS_BUNDLE",
          locator: SOURCE_LOCATOR,
          allowed_final_hosts: ["nomads.ncep.noaa.gov"],
          use_policy_ref: "FOCUSED_GFS_REPLAY_PROVENANCE_POLICY_V1",
          requested_at: RETRIEVED,
          source_issue_time: ISSUED,
          expected_content_type_prefixes: ["application/x-tar"],
          limitations: ["FOCUSED_QUALIFICATION_ONLY"],
        },
        canonicalized_at: CANONICALIZED,
      },
      { transport, retention, decoder },
    );
    assert(canonical);
    const rawPublic = canonical.record.source_payload.raw_provenance as Record<string, unknown>;
    assert.equal(rawPublic.request_id, undefined);
    assert.equal(rawPublic.source_locator, undefined);

    const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, {
      async verifyRetainedRawEvidence(input) {
        retentionVerifyCount += 1;
        assert.equal(input.retention_ref, canonical.raw_provenance.retention_ref);
        assert.equal(input.retained_sha256, canonical.raw_provenance.raw_sha256);
        assert.equal(input.retained_bytes, canonical.raw_provenance.raw_bytes);
      },
    });
    const committed = await ingress.appendCanonicalizedExternalEvidence(canonical);
    assert.equal(committed.status, "INSERTED");

    const reader = new PostgresExternalEvidenceFactReplayProvenanceV1(pool);
    const expected = {
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      fact_id: committed.fact_id,
      record_semantic_sha256: canonical.record_semantic_sha256,
      record_type: canonical.record.record_type,
      binding_id: canonical.record.binding_id,
      origin_source_id: canonical.record.origin_source_id,
      source_record_id: canonical.record.source_record_id,
    };
    const replay = await reader.readReplayProvenance(expected);
    assert.equal(replay.raw_provenance.request_id, "mcft-cap09-retained-replay:" + committed.fact_id);
    assert.equal(replay.raw_provenance.source_locator, SOURCE_LOCATOR);
    assert.equal(replay.dataset_id, canonical.record.dataset_id);
    assert.equal(replay.replay_request_id_derivation, "FACT_ID_V1");
    assert.equal(replay.replay_source_locator_derivation, "FINAL_LOCATOR_V1");
    assert.equal(replay.raw_provenance.retention_ref, canonical.raw_provenance.retention_ref);
    assert.equal(replay.raw_provenance.raw_sha256, canonical.raw_provenance.raw_sha256);
    assert.equal(replay.restored_ingested_at, INGESTED);
    assert.equal(replay.decoder.decoder_id, decoder.decoder_id);
    assert.equal(replay.decoder.decoder_version, decoder.decoder_version);
    assert.equal(replay.database_write_count, 0);
    assert.equal(replay.provider_request_count, 0);
    assert.equal(replay.cursor_mutation_count, 0);

    await assert.rejects(
      () => reader.readReplayProvenance({ ...expected, origin_source_id: "gfs_wrong_cycle" }),
      /FACT_REPLAY_ORIGIN_SOURCE_ID_MISMATCH/,
    );
    await assert.rejects(
      () => reader.readReplayProvenance({
        ...expected,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, zone_id: "wrong-zone" },
      }),
      /FACT_REPLAY_SCOPE_MISMATCH:zone_id/,
    );
    await assert.rejects(
      () => reader.readReplayProvenance({
        ...expected,
        record_semantic_sha256: "sha256:" + "0".repeat(64),
      }),
      /FACT_REPLAY_RECORD_SEMANTIC_HASH_MISMATCH/,
    );

    const result = {
      schema_version: "geox_mcft_cap09_external_evidence_fact_replay_provenance_acceptance_v1",
      status: "PASS",
      canonical_semantics_exclude_acquisition_attempt_request_id: true,
      canonical_semantics_exclude_source_locator_alias: true,
      deterministic_replay_request_id_from_fact_id: true,
      replay_source_locator_from_final_locator: true,
      exact_fact_identity_recomputed: true,
      exact_scope_binding_origin_source_record_semantic_verified: true,
      original_ingested_at_restored: true,
      provider_request_count: providerRequestCount,
      private_retention_count: retentionCount,
      retention_reverify_count: retentionVerifyCount,
      replay_reader_database_write_count: replay.database_write_count,
      replay_reader_provider_request_count: replay.provider_request_count,
      replay_reader_cursor_mutation_count: replay.cursor_mutation_count,
      runtime_process_start: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    };
    write(result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  write({
    schema_version: "geox_mcft_cap09_external_evidence_fact_replay_provenance_acceptance_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_start: false,
    production_owner_activation: false,
  });
  console.error(error);
  process.exitCode = 1;
});
