import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import { PostCommitVisibleExternalFormalEvidenceIngressV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import {
  PostgresEvidenceProducerLeaseV1,
  PostgresEvidenceSupplyCursorV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import { PostgresEvidenceRuntimeGovernedIngressV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.js";
import { PostgresExternalFormalEvidenceVisibilityV1 } from "../../apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_EVIDENCE_REFETCH_IDEMPOTENCY_V1_RESULT.json",
);
const SCOPE = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
const EVENT_TIME = "2026-08-27T08:10:00.000Z";
const RAW_SHA = "sha256:" + "a".repeat(64);
const RETENTION_REF =
  "s3-private://phase5-idempotency/"
  + "mcft-cap09/formal/raw/sha256/"
  + "a".repeat(64);
const SOURCE_RECORD_ID =
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1 + ":" + EVENT_TIME;
const SOURCE_RECORD_HASH = "sha256:" + "b".repeat(64);

function record(input: {
  available_at: string;
  canonicalized_at: string;
  value?: number;
}): CanonicalizedExternalEvidenceResultV1 {
  const canonicalPayload = {
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    value: input.value ?? 0.31,
    unit: "fraction",
    measurement_depth_mm: 100,
    spatial_support: "NEAR_SITE_POINT_SUPPORT",
    direct_field_equivalence: false,
    direct_root_zone_equivalence: false,
    root_zone_representativeness: "PARTIAL",
    observation_operator_id:
      "MCFT_CAP09_KBS_VARIATE25_VWC_100MM_OBSERVATION_OPERATOR_V1",
  };
  const replayRecord = {
    ...SCOPE,
    dataset_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25_V1",
    source_record_id: SOURCE_RECORD_ID,
    source_record_hash: SOURCE_RECORD_HASH,
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "EXTERNAL_PUBLIC_RESEARCH_DATASET",
    origin_source_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: input.available_at,
    role_time: {
      observed_at: EVENT_TIME,
      ingested_at: input.available_at,
    },
    quality: {
      status: "PASS",
      canonical_payload_sha256: semanticHashV1(canonicalPayload),
      raw_source_sha256: RAW_SHA,
      raw_retention_ref: RETENTION_REF,
      raw_payload_embedded: false,
    },
    source_payload: {
      provider: "KBS_LTER",
      source_family: "CURRENT_WEATHER_VARIATE_JSON",
      endpoint_id: 25,
      source_version: "KBS_CURRENT_WEATHER_VARIATE_25_V1",
      raw_provenance: {
        provider_id: "KBS_LTER",
        source_family: "CURRENT_WEATHER_VARIATE_JSON",
        final_locator: "https://lter.kbs.msu.edu/datatables/25/rows",
        retrieved_at: input.available_at,
        available_at: input.available_at,
        raw_sha256: RAW_SHA,
        raw_bytes: 128,
        retention_ref: RETENTION_REF,
        retained_at: input.available_at,
        use_policy_ref:
          "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-DATA-USE-POLICY.md",
        decoder_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1",
        decoder_version: "1",
        raw_payload_embedded: false,
      },
    },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: {
      conversion_rule_id: "IDENTITY_VWC_FRACTION_V1",
      conversion_rule_version: "1",
      authority_ref:
        "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-DATA-USE-POLICY.md",
    },
    execution_metadata: {
      policy_id:
        "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
      source_binding_version: 1,
      conversion_rule_version: "1",
    },
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "KBS_RESTRICTED_USE_POLICY",
      "NEAR_SITE_POINT_SUPPORT",
    ],
  } as any;

  return {
    pipeline_version: "MCFT_CAP09_EXTERNAL_EVIDENCE_COLLECTOR_CANONICALIZER_V1",
    raw_provenance: {
      request_id: "phase5-idempotency",
      provider_id: "KBS_LTER",
      source_family: "CURRENT_WEATHER_VARIATE_JSON",
      source_locator: "https://lter.kbs.msu.edu/datatables/25/rows",
      final_locator: "https://lter.kbs.msu.edu/datatables/25/rows",
      content_type: "application/json",
      retrieved_at: input.available_at,
      available_at: input.available_at,
      raw_sha256: RAW_SHA,
      raw_bytes: 128,
      retention_ref: RETENTION_REF,
      retained_at: input.available_at,
      use_policy_ref:
        "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-DATA-USE-POLICY.md",
    },
    decoder: {
      decoder_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1",
      decoder_version: "1",
    },
    record: replayRecord,
    canonical_payload_sha256: semanticHashV1(canonicalPayload),
    record_semantic_sha256: semanticHashV1(replayRecord),
  };
}

async function main(): Promise<void> {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  assert(databaseUrl, "PHASE5_IDEMPOTENCY_DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  try {
    await pool.query(
      "DELETE FROM public.external_evidence_supply_event_v1 WHERE tenant_id=$1",
      [SCOPE.tenant_id],
    );
    await pool.query(
      "DELETE FROM public.external_evidence_supply_cursor_v1 WHERE tenant_id=$1",
      [SCOPE.tenant_id],
    );
    await pool.query(
      "DELETE FROM public.external_evidence_producer_lease_v1 WHERE tenant_id=$1",
      [SCOPE.tenant_id],
    );
    await pool.query(
      "DELETE FROM public.facts WHERE fact_id LIKE 'fact_external_evidence_%' AND record_json#>>'{payload,source_record_id}'=$1",
      [SOURCE_RECORD_ID],
    );

    const leaseRepo = new PostgresEvidenceProducerLeaseV1(pool, SCOPE);
    const claim = await leaseRepo.acquireLease({
      scope: SCOPE,
      lease_owner: "phase5-refetch-owner",
      lease_duration_seconds: 300,
    });
    assert(claim);

    const retention = {
      async verifyRetainedRawEvidence() {
        return;
      },
    };
    const cursor = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, claim);
    const committed = new PostgresEvidenceRuntimeGovernedIngressV1(
      pool,
      retention,
      SCOPE,
      claim,
    );
    const visible = new PostCommitVisibleExternalFormalEvidenceIngressV1(
      committed,
      new PostgresExternalFormalEvidenceVisibilityV1(pool),
      cursor,
    );

    const first = record({
      available_at: "2026-08-27T08:15:00.000Z",
      canonicalized_at: "2026-08-27T08:15:01.000Z",
    });
    const firstReceipt = await visible.appendCanonicalizedExternalEvidence(first);
    assert.equal(firstReceipt.status, "INSERTED");
    assert.equal(firstReceipt.canonical_fact_write_count, 1);

    const second = record({
      available_at: "2026-08-27T08:25:00.000Z",
      canonicalized_at: "2026-08-27T08:25:01.000Z",
    });
    assert.notEqual(
      first.record_semantic_sha256,
      second.record_semantic_sha256,
      "PHASE5_REFETCH_TEST_REQUIRES_DYNAMIC_RECORD_SEMANTIC_CHANGE",
    );
    const secondReceipt = await visible.appendCanonicalizedExternalEvidence(second);
    assert.equal(secondReceipt.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(secondReceipt.canonical_fact_write_count, 0);

    const facts = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.facts WHERE fact_id=$1",
      [firstReceipt.fact_id],
    );
    assert.equal(Number(facts.rows[0]?.count ?? "-1"), 1);

    const event = await pool.query<{
      publication_count: number;
      revision_count: number;
      first_publication_available_at: string | Date;
      last_publication_available_at: string | Date;
    }>(
      `SELECT publication_count,revision_count,
              first_publication_available_at,last_publication_available_at
         FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND binding_id=$7 AND origin_source_id=$8`,
      [
        SCOPE.tenant_id,
        SCOPE.project_id,
        SCOPE.group_id,
        SCOPE.field_id,
        SCOPE.season_id,
        SCOPE.zone_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
      ],
    );
    assert.equal(event.rows.length, 1);
    assert.equal(event.rows[0].publication_count, 2);
    assert.equal(event.rows[0].revision_count, 0);
    assert.equal(
      new Date(event.rows[0].first_publication_available_at).toISOString(),
      "2026-08-27T08:15:00.000Z",
    );
    assert.equal(
      new Date(event.rows[0].last_publication_available_at).toISOString(),
      "2026-08-27T08:25:00.000Z",
    );

    const cursorRow = await cursor.readSupplyCursor({
      scope: SCOPE,
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      origin_source_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
    });
    assert(cursorRow);
    assert.equal(cursorRow.publication_event_count, 2);
    assert.equal(cursorRow.revision_count, 0);
    assert.equal(
      cursorRow.publication_available_through,
      "2026-08-27T08:25:00.000Z",
    );
    assert.equal(cursorRow.fact_id, firstReceipt.fact_id);

    const changedCanonical = record({
      available_at: "2026-08-27T08:35:00.000Z",
      canonicalized_at: "2026-08-27T08:35:01.000Z",
      value: 0.32,
    });
    await assert.rejects(
      () => visible.appendCanonicalizedExternalEvidence(changedCanonical),
      /PHASE3_EVIDENCE_DB_INGRESS_FACT_IDENTITY_CONFLICT/,
    );

    const proof = {
      schema_version:
        "geox_mcft_cap09_phase5_evidence_refetch_idempotency_qualification_v1",
      status: "PASS",
      canonical_fact_count_after_refetch: 1,
      initial_fact_write_count: 1,
      refetch_fact_write_count: 0,
      refetch_status: secondReceipt.status,
      dynamic_publication_semantic_separated_from_canonical_fact: true,
      publication_count: event.rows[0].publication_count,
      revision_count: event.rows[0].revision_count,
      publication_available_through:
        cursorRow.publication_available_through,
      canonical_payload_change_fail_closed: true,
      production_activation: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
