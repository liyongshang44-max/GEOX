import type { PoolClient } from "pg";

export const RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1 = "raw_sample_runtime_availability_v1" as const;
export const RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1 = "POST_COMMIT_READ" as const;

export type RawSampleRuntimeAvailabilityMarkerInputV1 = {
  sample_id: string;
  raw_sample_fact_id: string;
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string | null;
  sensor_id: string;
};

export function rawSampleRuntimeAvailabilityFactIdV1(sampleId: string): string {
  return `${RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1}:${sampleId}`;
}

/**
 * Persist a conservative post-COMMIT runtime visibility witness.
 *
 * Precondition: the caller has already COMMITted the raw_samples append.
 *
 * This statement starts from a fresh PostgreSQL snapshot, re-reads sample_id,
 * captures database clock_timestamp() only after that row is visible, and
 * appends an immutable fact carrying the same timestamp. The timestamp proves
 * "visible by this time"; it does not claim to be the earliest possible
 * visibility time.
 *
 * The caller intentionally treats absence/failure of this marker as missing
 * temporal authority rather than as failure of the already-durable raw append.
 */
export async function appendRawSampleRuntimeAvailabilityMarkerV1(
  conn: Pick<PoolClient, "query">,
  input: RawSampleRuntimeAvailabilityMarkerInputV1,
): Promise<{ recorded: boolean; fact_id: string }> {
  const factId = rawSampleRuntimeAvailabilityFactIdV1(input.sample_id);
  const result = await conn.query(
    `WITH visible_raw_sample AS (
       SELECT clock_timestamp() AS available_to_runtime_at
         FROM raw_samples
        WHERE sample_id = $1
        LIMIT 1
     )
     INSERT INTO facts (fact_id, occurred_at, source, record_json)
     SELECT
       $2,
       visible_raw_sample.available_to_runtime_at,
       $3,
       jsonb_build_object(
         'type', $3,
         'schema_version', '1.0.0',
         'sample_id', $1,
         'raw_sample_fact_id', $4::text,
         'available_to_runtime_at', visible_raw_sample.available_to_runtime_at,
         'visibility_proof', $5::text,
         'scope', jsonb_build_object(
           'tenant_id', $6::text,
           'project_id', $7::text,
           'group_id', $8::text,
           'field_id', $9::text,
           'sensor_id', $10::text
         )
       )
       FROM visible_raw_sample
     ON CONFLICT (fact_id) DO NOTHING
     RETURNING fact_id`,
    [
      input.sample_id,
      factId,
      RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1,
      input.raw_sample_fact_id,
      RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1,
      input.tenant_id,
      input.project_id,
      input.group_id,
      input.field_id,
      input.sensor_id,
    ],
  );

  return {
    recorded: Boolean(result.rows?.[0]?.fact_id),
    fact_id: factId,
  };
}
