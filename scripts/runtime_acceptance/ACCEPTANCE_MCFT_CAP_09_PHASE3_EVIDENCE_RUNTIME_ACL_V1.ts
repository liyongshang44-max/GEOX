import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
  type CanonicalizedExternalEvidenceResultV1,
  type VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  PostCommitVisibleExternalFormalEvidenceIngressV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import {
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
  MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
  MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";
import { PostgresEvidenceRuntimeGovernedIngressV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.js";
import { PostgresExternalFormalEvidenceVisibilityV1 } from "../../apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.js";
import {
  PostgresEvidenceProducerLeaseV1,
  PostgresEvidenceSupplyCursorV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_ACL_V1_RESULT.json");
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

const ROLE = "geox_mcft_cap09_evidence_runtime_v1";
const WRITER_OWNER = "geox_mcft_cap09_evidence_writer_owner_v1";
const SCOPE = {
  tenant_id: "aclTenant",
  project_id: "aclProject",
  group_id: "aclGroup",
  field_id: "aclField",
  season_id: "aclSeason",
  zone_id: "aclZone",
};

const V13_EPOCH = "phase7-acl-v13-epoch";
const V13_SUBJECT = "a".repeat(40);

async function expectDenied(pool: Pool, sql: string, params: unknown[] = []): Promise<Error> {
  const client = await pool.connect();
  let caught: unknown = null;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE " + ROLE);
    await client.query(sql, params);
    await client.query("ROLLBACK");
  } catch (error) {
    caught = error;
    try { await client.query("ROLLBACK"); } catch {}
  } finally {
    client.release();
  }
  assert(caught instanceof Error, "ACL_EXPECTED_DENIAL:" + sql);
  assert.match(caught.message, /permission denied|must be owner|not allowed|PHASE3_EVIDENCE_DB_INGRESS/i);
  return caught;
}

async function withRole(pool: Pool, fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE " + ROLE);
    await fn(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function externalEvidenceEnvelope(sourceRecordId: string) {
  return {
    type: "soil_moisture_observation_v1",
    payload: {
      tenant_id: SCOPE.tenant_id,
      project_id: SCOPE.project_id,
      group_id: SCOPE.group_id,
      field_id: SCOPE.field_id,
      season_id: SCOPE.season_id,
      zone_id: SCOPE.zone_id,
      record_type: "soil_moisture_observation_v1",
      binding_id: "kbs_lter_variate25_vwc_100mm_v1",
      source_record_id: sourceRecordId,
    },
  };
}

function twinCanonicalEnvelope() {
  return {
    type: "twin_state_estimate_v1",
    payload: {
      tenant_id: SCOPE.tenant_id,
      project_id: SCOPE.project_id,
      group_id: SCOPE.group_id,
      field_id: SCOPE.field_id,
      season_id: SCOPE.season_id,
      zone_id: SCOPE.zone_id,
      record_type: "twin_state_estimate_v1",
      binding_id: "forbidden_twin_binding",
    },
  };
}

function soilRepublicationResultV1(input: {
  observed_at: string;
  retrieved_at: string;
  retained_at: string;
  raw_sha256?: string;
  retention_ref?: string;
  value?: number;
}): CanonicalizedExternalEvidenceResultV1 {
  const rawSha256 = input.raw_sha256 ?? ("sha256:" + "7".repeat(64));
  const retentionRef = input.retention_ref
    ?? ("s3-private://phase3-republication/mcft-cap09-formal-raw-v1/sha256/" + "7".repeat(64));
  const value = input.value ?? 0.271;
  const sourceRecordId = `${MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1}:${input.observed_at}`;
  const sourcePayloadBase = {
    provider: "KBS_LTER",
    source_family: "CURRENT_WEATHER_VARIATE_JSON",
    endpoint_id: 25,
    endpoint_url: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    source_version: "KBS_CURRENT_WEATHER_VARIATE_25_V1",
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    unit: "fraction",
    measurement_depth_mm: 100,
    use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
    raw_values_embedded: false,
  };
  const canonicalPayload = {
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    value,
    unit: "fraction",
    measurement_depth_mm: 100,
    spatial_support: "NEAR_SITE_POINT_SUPPORT",
    direct_field_equivalence: false,
    direct_root_zone_equivalence: false,
    root_zone_representativeness: "PARTIAL",
    observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
  };
  const canonicalPayloadHash = semanticHashV1(canonicalPayload);
  const sourceRecordHash = semanticHashV1({
    source_record_id: sourceRecordId,
    raw_sha256: rawSha256,
    retention_ref: retentionRef,
    decoder_id: MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
    decoder_version: MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
    source_payload: sourcePayloadBase,
  });
  const publicRawProvenance = {
    provider_id: "KBS_LTER",
    source_family: "CURRENT_WEATHER_VARIATE_JSON",
    final_locator: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    content_type: "application/json",
    source_issue_time: null,
    source_event_time: null,
    retrieved_at: input.retrieved_at,
    available_at: input.retrieved_at,
    raw_sha256: rawSha256,
    raw_bytes: 512,
    retention_ref: retentionRef,
    retained_at: input.retained_at,
    use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
    decoder_id: MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
    decoder_version: MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
    raw_payload_embedded: false,
  };
  const record: CanonicalReplayEvidenceRecordV1 = {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    dataset_id: MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "EXTERNAL_PUBLIC_RESEARCH_DATASET",
    origin_source_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: input.retrieved_at,
    role_time: {
      observed_at: input.observed_at,
      ingested_at: input.retrieved_at,
    },
    quality: {
      status: "PASS",
      continuity_window_hours: 24,
      distinct_point_count: 48,
      distinct_hour_bucket_count: 24,
      span_minutes: 1435,
      maximum_gap_minutes: 30,
      timestamp_chain_sha256: "sha256:" + "8".repeat(64),
      raw_value_publication_authorized: false,
      canonical_payload_sha256: canonicalPayloadHash,
      raw_source_sha256: rawSha256,
      raw_retention_ref: retentionRef,
      raw_payload_embedded: false,
    },
    source_payload: { ...sourcePayloadBase, raw_provenance: publicRawProvenance },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: {
      conversion_rule_id: "IDENTITY_VWC_FRACTION_V1",
      conversion_rule_version: "1",
      id: "IDENTITY_VWC_FRACTION_V1",
      version: "1",
      authority_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
    },
    execution_metadata: {
      policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
      source_binding_version: 1,
      conversion_rule_version: "1",
    },
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "KBS_RESTRICTED_USE_POLICY",
      "NEAR_SITE_POINT_SUPPORT",
      "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
      "DIRECT_FIELD_EQUIVALENCE_FALSE",
      "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
      "NO_PUBLIC_RAW_VALUE_EMISSION",
    ],
  };
  const rawProvenance: VerifiedRawEvidenceProvenanceV1 = {
    request_id: "phase3-republication-" + input.retrieved_at,
    provider_id: "KBS_LTER",
    source_family: "CURRENT_WEATHER_VARIATE_JSON",
    source_locator: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    final_locator: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    content_type: "application/json",
    retrieved_at: input.retrieved_at,
    available_at: input.retrieved_at,
    raw_sha256: rawSha256,
    raw_bytes: 512,
    retention_ref: retentionRef,
    retained_at: input.retained_at,
    use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
  };
  return {
    pipeline_version: MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
    raw_provenance: rawProvenance,
    decoder: {
      decoder_id: MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
      decoder_version: MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
    },
    record,
    canonical_payload_sha256: canonicalPayloadHash,
    record_semantic_sha256: semanticHashV1(record),
  };
}

async function callGovernedFactFunction(
  client: PoolClient,
  input: {
    lease_owner: string;
    fencing_token: number;
    fact_id: string;
    occurred_at: string;
    record_json: unknown;
  },
) {
  return client.query(
    `SELECT status,canonical_fact_write_count
       FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10::timestamptz,$11::jsonb
       )`,
    [
      SCOPE.tenant_id,
      SCOPE.project_id,
      SCOPE.group_id,
      SCOPE.field_id,
      SCOPE.season_id,
      SCOPE.zone_id,
      input.lease_owner,
      input.fencing_token,
      input.fact_id,
      input.occurred_at,
      JSON.stringify(input.record_json),
    ],
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: "mcft-cap09-phase3-evidence-acl-qualification" });
  try {
    const roles = await pool.query<{
      rolname: string;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolcanlogin: boolean;
    }>(
      `SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin
         FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
      [[ROLE, WRITER_OWNER]],
    );
    assert.equal(roles.rows.length, 2);
    for (const row of roles.rows) {
      assert.equal(row.rolsuper, false);
      assert.equal(row.rolcreatedb, false);
      assert.equal(row.rolcreaterole, false);
      assert.equal(row.rolreplication, false);
      assert.equal(row.rolcanlogin, false);
    }

    const proc = await pool.query<{
      prosecdef: boolean;
      owner_name: string;
      proconfig: string[] | null;
    }>(
      `SELECT p.prosecdef,
              r.rolname AS owner_name,
              p.proconfig
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid=p.pronamespace
         JOIN pg_roles r ON r.oid=p.proowner
        WHERE n.nspname='public'
          AND p.proname='mcft_cap09_evidence_runtime_append_fact_v1'`,
    );
    assert.equal(proc.rows.length, 1);
    assert.equal(proc.rows[0].prosecdef, true);
    assert.equal(proc.rows[0].owner_name, WRITER_OWNER);
    assert((proc.rows[0].proconfig ?? []).some((value) => value.replace(/\s/g, "") === "search_path=pg_catalog,public"));

    // Real-clock P0 regression: repeated KBS soil polling can rediscover the exact
    // same source observation with a later transport/ingestion time. The immutable fact
    // must remain first-seen while the Evidence supply ledger records republication.
    const productionScope = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } as EvidenceRuntimeScopeV1;
    await pool.query(
      `DELETE FROM public.external_evidence_supply_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(productionScope),
    );
    await pool.query(
      `DELETE FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(productionScope),
    );
    await pool.query(
      `DELETE FROM public.external_evidence_producer_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(productionScope),
    );

    const productionLeaseRepo = new PostgresEvidenceProducerLeaseV1(pool, productionScope);
    const productionClaim = await productionLeaseRepo.acquireLease({
      scope: productionScope,
      lease_owner: "phase3-republication-owner",
      lease_duration_seconds: 300,
    });
    assert(productionClaim, "PHASE3_REPUBLICATION_LEASE_REQUIRED");
    assert.equal(productionClaim.lease_contract_id, MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1);

    let rawVerificationCount = 0;
    const governedIngress = new PostgresEvidenceRuntimeGovernedIngressV1(
      pool,
      {
        async verifyRetainedRawEvidence() {
          rawVerificationCount += 1;
        },
      },
      productionScope,
      productionClaim,
    );
    const visibleIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
      governedIngress,
      new PostgresExternalFormalEvidenceVisibilityV1(pool),
      new PostgresEvidenceSupplyCursorV1(pool, productionScope, productionClaim),
    );

    const observedAt = "2026-09-22T09:30:00.000Z";
    const firstPublicationAt = "2026-09-22T09:48:40.000Z";
    const secondPublicationAt = "2026-09-22T09:53:40.000Z";
    const retainedAt = "2026-09-22T09:48:41.000Z";
    const firstPublication = soilRepublicationResultV1({
      observed_at: observedAt,
      retrieved_at: firstPublicationAt,
      retained_at: retainedAt,
    });
    const secondPublication = soilRepublicationResultV1({
      observed_at: observedAt,
      retrieved_at: secondPublicationAt,
      retained_at: retainedAt,
    });

    const firstPublicationReceipt = await visibleIngress.appendCanonicalizedExternalEvidence(firstPublication);
    assert.equal(firstPublicationReceipt.status, "INSERTED");
    assert.equal(firstPublicationReceipt.canonical_fact_write_count, 1);

    const secondPublicationReceipt = await visibleIngress.appendCanonicalizedExternalEvidence(secondPublication);
    assert.equal(secondPublicationReceipt.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(secondPublicationReceipt.canonical_fact_write_count, 0);
    assert.equal(secondPublicationReceipt.republication_reused_immutable_fact, true);

    const immutable = await pool.query<{
      n: number;
      available_to_runtime_at: string | Date;
      ingested_at: string | Date;
    }>(
      `SELECT count(*)::int AS n,
              min(record_json#>>'{payload,available_to_runtime_at}')::timestamptz AS available_to_runtime_at,
              min(record_json#>>'{payload,role_time,ingested_at}')::timestamptz AS ingested_at
         FROM public.facts
        WHERE fact_id=$1`,
      [firstPublicationReceipt.fact_id],
    );
    assert.equal(immutable.rows[0].n, 1);
    assert.equal(new Date(immutable.rows[0].available_to_runtime_at).toISOString(), firstPublicationAt);
    assert.equal(new Date(immutable.rows[0].ingested_at).toISOString(), firstPublicationAt);

    const publication = await pool.query<{
      first_publication_available_at: string | Date;
      last_publication_available_at: string | Date;
      publication_count: number;
      revision_count: number;
    }>(
      `SELECT first_publication_available_at,last_publication_available_at,publication_count,revision_count
         FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz`,
      [
        ...Object.values(productionScope),
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
        observedAt,
      ],
    );
    assert.equal(publication.rows.length, 1);
    assert.equal(new Date(publication.rows[0].first_publication_available_at).toISOString(), firstPublicationAt);
    assert.equal(new Date(publication.rows[0].last_publication_available_at).toISOString(), secondPublicationAt);
    assert.equal(Number(publication.rows[0].publication_count), 2);
    assert.equal(Number(publication.rows[0].revision_count), 0);
    assert.equal(rawVerificationCount, 2);

    const revisionAvailableAt = "2026-09-22T09:54:40.000Z";
    const revisionRawSha = "sha256:" + "9".repeat(64);
    const revisionRetentionRef =
      "s3-private://phase3-republication/mcft-cap09-formal-raw-v1/sha256/" + "9".repeat(64);
    const trueRevision = soilRepublicationResultV1({
      observed_at: observedAt,
      retrieved_at: revisionAvailableAt,
      retained_at: "2026-09-22T09:54:41.000Z",
      raw_sha256: revisionRawSha,
      retention_ref: revisionRetentionRef,
      value: 0.299,
    });
    const trueRevisionReceipt = await visibleIngress.appendCanonicalizedExternalEvidence(trueRevision);
    assert.equal(trueRevisionReceipt.status, "INSERTED");
    assert.equal(trueRevisionReceipt.canonical_fact_write_count, 1);
    assert.equal(trueRevisionReceipt.revision_fact_identity_used, true);
    assert.equal(trueRevisionReceipt.base_fact_id, firstPublicationReceipt.fact_id);
    assert.notEqual(trueRevisionReceipt.fact_id, firstPublicationReceipt.fact_id);

    const afterRevision = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM public.facts
        WHERE record_json#>>'{payload,source_record_id}'=$1`,
      [firstPublication.record.source_record_id],
    );
    assert.equal(afterRevision.rows[0].n, 2);

    const revisedPublication = await pool.query<{
      fact_id: string;
      last_publication_available_at: string | Date;
      publication_count: number;
      revision_count: number;
    }>(
      `SELECT fact_id,last_publication_available_at,publication_count,revision_count
         FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz`,
      [
        ...Object.values(productionScope),
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
        observedAt,
      ],
    );
    assert.equal(revisedPublication.rows.length, 1);
    assert.equal(revisedPublication.rows[0].fact_id, trueRevisionReceipt.fact_id);
    assert.equal(
      new Date(revisedPublication.rows[0].last_publication_available_at).toISOString(),
      revisionAvailableAt,
    );
    assert.equal(Number(revisedPublication.rows[0].publication_count), 3);
    assert.equal(Number(revisedPublication.rows[0].revision_count), 1);

    const revisionRepublicationAt = "2026-09-22T09:55:40.000Z";
    const revisionRepublication = soilRepublicationResultV1({
      observed_at: observedAt,
      retrieved_at: revisionRepublicationAt,
      retained_at: "2026-09-22T09:54:41.000Z",
      raw_sha256: revisionRawSha,
      retention_ref: revisionRetentionRef,
      value: 0.299,
    });
    const revisionRepublicationReceipt =
      await visibleIngress.appendCanonicalizedExternalEvidence(revisionRepublication);
    assert.equal(revisionRepublicationReceipt.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(revisionRepublicationReceipt.canonical_fact_write_count, 0);
    assert.equal(revisionRepublicationReceipt.revision_fact_identity_used, true);
    assert.equal(revisionRepublicationReceipt.republication_reused_immutable_fact, true);
    assert.equal(revisionRepublicationReceipt.fact_id, trueRevisionReceipt.fact_id);

    const republishedRevision = await pool.query<{
      publication_count: number;
      revision_count: number;
      last_publication_available_at: string | Date;
    }>(
      `SELECT publication_count,revision_count,last_publication_available_at
         FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz`,
      [
        ...Object.values(productionScope),
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
        observedAt,
      ],
    );
    assert.equal(Number(republishedRevision.rows[0].publication_count), 4);
    assert.equal(Number(republishedRevision.rows[0].revision_count), 1);
    assert.equal(
      new Date(republishedRevision.rows[0].last_publication_available_at).toISOString(),
      revisionRepublicationAt,
    );

    // Same raw/source identity cannot silently produce a different canonical observation.
    // That remains an exact fact-identity conflict and must fail closed.
    const impossibleSameRawRevision = soilRepublicationResultV1({
      observed_at: observedAt,
      retrieved_at: "2026-09-22T09:56:40.000Z",
      retained_at: "2026-09-22T09:54:41.000Z",
      raw_sha256: revisionRawSha,
      retention_ref: revisionRetentionRef,
      value: 0.333,
    });
    await assert.rejects(
      () => visibleIngress.appendCanonicalizedExternalEvidence(impossibleSameRawRevision),
      /PHASE3_EVIDENCE_DB_INGRESS_FACT_IDENTITY_CONFLICT/,
    );

    await productionLeaseRepo.releaseLease({ claim: productionClaim });

    // Direct arbitrary facts INSERT is denied at the database boundary.
    await expectDenied(
      pool,
      "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES ('forbidden-direct','2026-08-27T02:30:00Z','forbidden','{}'::jsonb)",
    );

    await withRole(pool, async (client) => {
      await client.query(
        `INSERT INTO public.external_evidence_producer_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
         VALUES ($1,$2,$3,$4,$5,$6,'acl-owner-A',1,
                 transaction_timestamp(),transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
        Object.values(SCOPE),
      );

      const allowed = await callGovernedFactFunction(client, {
        lease_owner: "acl-owner-A",
        fencing_token: 1,
        fact_id: "phase3_acl_external_fact_1",
        occurred_at: "2026-08-27T02:30:00.000Z",
        record_json: externalEvidenceEnvelope("acl-source-1"),
      });
      assert.deepEqual(allowed.rows, [{ status: "INSERTED", canonical_fact_write_count: 1 }]);

      const visible = await client.query(
        "SELECT source,record_json FROM public.facts WHERE fact_id='phase3_acl_external_fact_1'",
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0].source, "mcft_cap09_external_formal_evidence_v1");

      await client.query(
        `INSERT INTO public.external_evidence_supply_event_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,event_time,
          source_record_id,fact_id,record_semantic_sha256,
          first_publication_available_at,last_publication_available_at,
          first_post_commit_db_readback_at,last_post_commit_db_readback_at,
          revision_count,publication_count,lease_owner,fencing_token)
         VALUES ($1,$2,$3,$4,$5,$6,
                 'acl-binding','acl-source','2026-08-27T02:30:00.000Z',
                 'acl-source-record','phase3_acl_external_fact_1',$7,
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:01.000Z','2026-08-27T02:30:01.000Z',
                 0,1,'acl-owner-A',1)`,
        [...Object.values(SCOPE), "sha256:" + "a".repeat(64)],
      );
      await client.query(
        `INSERT INTO public.external_evidence_supply_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,
          fact_id,record_semantic_sha256,available_to_runtime_at,publication_available_through,
          latest_event_time,latest_source_record_id,event_time_contiguous_from,event_time_contiguous_through,
          event_time_max_seen,event_gap_count,revision_count,publication_event_count,cadence_profile_id,
          role_time,post_commit_db_readback_at,lease_owner,fencing_token)
         VALUES ($1,$2,$3,$4,$5,$6,
                 'acl-binding','acl-source','phase3_acl_external_fact_1',$7,
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:00.000Z','acl-source-record',
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:00.000Z',0,0,1,'ACL_QUALIFICATION_PROFILE',
                 '{}'::jsonb,'2026-08-27T02:30:01.000Z','acl-owner-A',1)`,
        [...Object.values(SCOPE), "sha256:" + "a".repeat(64)],
      );

      // Phase7: forcing-base continuity is Evidence-plane operational state.
      // The Evidence role must own it without gaining Twin Runtime state authority.
      await client.query(
        `INSERT INTO public.twin_external_formal_forcing_base_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,
          first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                 date_trunc('hour',transaction_timestamp())+interval '2 hours',
                 date_trunc('hour',transaction_timestamp())+interval '2 hours',
                 date_trunc('hour',transaction_timestamp())+interval '1 hour',
                 date_trunc('hour',transaction_timestamp())+interval '2 hours',false)`,
        [...Object.values(SCOPE), V13_EPOCH, V13_SUBJECT],
      );
      await client.query(
        `INSERT INTO public.twin_external_formal_forcing_base_target_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,
          base_target_t,causal_deadline,state,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                 date_trunc('hour',transaction_timestamp())+interval '2 hours',
                 date_trunc('hour',transaction_timestamp())+interval '2 hours',
                 'REQUIRED','phase7-acl-v13-target')`,
        [...Object.values(SCOPE), V13_EPOCH, V13_SUBJECT],
      );
      await client.query(
        `INSERT INTO public.twin_external_formal_forcing_controller_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,
          lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE','phase7-evidence-controller',1,
                 transaction_timestamp()+interval '5 minutes',
                 transaction_timestamp(),transaction_timestamp())`,
        [...Object.values(SCOPE), V13_EPOCH, V13_SUBJECT],
      );
      await client.query(
        `UPDATE public.twin_external_formal_forcing_base_target_v1
            SET failure_class='PHASE7_ACL_WRITE_PROBE',updated_at=clock_timestamp()
          WHERE epoch_id=$1`,
        [V13_EPOCH],
      );
      const v13Rows = await client.query(
        `SELECT
           (SELECT count(*)::int FROM public.twin_external_formal_forcing_base_cursor_v1 WHERE epoch_id=$1) AS cursor_n,
           (SELECT count(*)::int FROM public.twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1) AS target_n,
           (SELECT count(*)::int FROM public.twin_external_formal_forcing_controller_lease_v1 WHERE epoch_id=$1) AS controller_n`,
        [V13_EPOCH],
      );
      assert.deepEqual(v13Rows.rows[0], { cursor_n: 1, target_n: 1, controller_n: 1 });
    });

    // Even the governed function cannot be used to manufacture a Twin canonical fact.
    const twinDenied = await expectDenied(
      pool,
      `SELECT * FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,'acl-owner-A',1,'forbidden-twin-fact',
         '2026-08-27T02:31:00.000Z'::timestamptz,$7::jsonb)`,
      [...Object.values(SCOPE), JSON.stringify(twinCanonicalEnvelope())],
    );
    assert.match(twinDenied.message, /RECORD_TYPE_NOT_AUTHORIZED/);

    // Simulate ownership takeover. Old token must fail before any canonical fact is inserted.
    await pool.query(
      `UPDATE public.external_evidence_producer_lease_v1
          SET lease_owner='acl-owner-B',
              fencing_token=2,
              acquired_at=transaction_timestamp(),
              expires_at=transaction_timestamp()+interval '5 minutes',
              heartbeat_at=transaction_timestamp()
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(SCOPE),
    );

    const staleDenied = await expectDenied(
      pool,
      `SELECT * FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,'acl-owner-A',1,'stale-owner-fact',
         '2026-08-27T02:32:00.000Z'::timestamptz,$7::jsonb)`,
      [...Object.values(SCOPE), JSON.stringify(externalEvidenceEnvelope("stale-source"))],
    );
    assert.match(staleDenied.message, /STALE_FENCE/);
    const staleFact = await pool.query("SELECT 1 FROM public.facts WHERE fact_id='stale-owner-fact'");
    assert.equal(staleFact.rows.length, 0);

    await withRole(pool, async (client) => {
      const current = await callGovernedFactFunction(client, {
        lease_owner: "acl-owner-B",
        fencing_token: 2,
        fact_id: "phase3_acl_external_fact_2",
        occurred_at: "2026-08-27T02:33:00.000Z",
        record_json: externalEvidenceEnvelope("acl-source-2"),
      });
      assert.deepEqual(current.rows, [{ status: "INSERTED", canonical_fact_write_count: 1 }]);
    });

    await expectDenied(pool, "UPDATE public.facts SET source='mutated' WHERE fact_id='phase3_acl_external_fact_1'");
    await expectDenied(pool, "DELETE FROM public.facts WHERE fact_id='phase3_acl_external_fact_1'");
    await expectDenied(pool, "SELECT * FROM public.twin_runtime_lease_v1");
    await expectDenied(pool, "INSERT INTO public.twin_runtime_lease_v1(id) VALUES (1)");
    await expectDenied(pool, "UPDATE public.twin_runtime_checkpoint_latest_index_v1 SET value='x' WHERE id=1");
    await expectDenied(pool, "INSERT INTO public.twin_shadow_online_scheduler_cursor_v1(id) VALUES (1)");
    await expectDenied(pool, "INSERT INTO public.approvals(id) VALUES (1)");
    await expectDenied(pool, "INSERT INTO public.actions(id) VALUES (1)");
    await expectDenied(pool, "CREATE TABLE public.phase3_acl_escape(id integer)");
    await expectDenied(pool, "CREATE FUNCTION public.phase3_acl_escape_fn() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$");

    const grants = await pool.query<{ table_name: string; privilege_type: string }>(
      `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE grantee=$1
        ORDER BY table_name, privilege_type`,
      [ROLE],
    );
    const actual = grants.rows.map((row) => row.table_name + ":" + row.privilege_type);
    assert.deepEqual(actual, [
      "external_evidence_producer_lease_v1:INSERT",
      "external_evidence_producer_lease_v1:SELECT",
      "external_evidence_producer_lease_v1:UPDATE",
      "external_evidence_supply_cursor_v1:INSERT",
      "external_evidence_supply_cursor_v1:SELECT",
      "external_evidence_supply_cursor_v1:UPDATE",
      "external_evidence_supply_event_v1:INSERT",
      "external_evidence_supply_event_v1:SELECT",
      "external_evidence_supply_event_v1:UPDATE",
      "facts:SELECT",
      "twin_external_formal_forcing_base_cursor_v1:INSERT",
      "twin_external_formal_forcing_base_cursor_v1:SELECT",
      "twin_external_formal_forcing_base_cursor_v1:UPDATE",
      "twin_external_formal_forcing_base_target_v1:INSERT",
      "twin_external_formal_forcing_base_target_v1:SELECT",
      "twin_external_formal_forcing_base_target_v1:UPDATE",
      "twin_external_formal_forcing_controller_lease_v1:INSERT",
      "twin_external_formal_forcing_controller_lease_v1:SELECT",
      "twin_external_formal_forcing_controller_lease_v1:UPDATE",
    ]);

    const routineGrant = await pool.query<{ privilege_type: string }>(
      `SELECT privilege_type
         FROM information_schema.role_routine_grants
        WHERE grantee=$1
          AND routine_schema='public'
          AND routine_name='mcft_cap09_evidence_runtime_append_fact_v1'`,
      [ROLE],
    );
    assert.deepEqual(routineGrant.rows.map((row) => row.privilege_type), ["EXECUTE"]);

    const proof = {
      schema_version: "geox_mcft_cap09_phase3_evidence_runtime_acl_qualification_v2",
      status: "PASS",
      arbitrary_facts_insert_denied: true,
      governed_external_evidence_function_execute_allowed: true,
      twin_canonical_fact_through_function_denied: true,
      stale_owner_rejected_before_fact_insert: true,
      stale_owner_fact_count: 0,
      current_owner_external_evidence_insert_allowed: true,
      same_semantic_republication_reuses_immutable_fact: true,
      republication_advances_supply_publication_ledger: true,
      later_semantic_revision_gets_distinct_deterministic_fact_id: true,
      revision_advances_same_event_time_ledger: true,
      repeated_same_revision_is_idempotent_publication: true,
      same_raw_identity_canonical_divergence_remains_fail_closed: true,
      security_definer_owner_no_login: true,
      security_definer_fixed_search_path: true,
      exact_table_grants: actual,
      facts_insert_table_grant: false,
      evidence_runtime_v13_forcing_cursor_mutation: true,
      evidence_runtime_v13_forcing_target_mutation: true,
      evidence_runtime_v13_forcing_controller_lease_mutation: true,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
      production_cadence_activation: false,
      formal_v5_armed: false,
      graduation_effect: false,
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
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
