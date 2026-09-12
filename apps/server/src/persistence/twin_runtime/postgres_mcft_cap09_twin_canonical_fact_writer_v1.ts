import type { PoolClient } from "pg";
import type { RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

export type TwinCanonicalFactAppendV1 = {
  scope: TwinScopeKeyV1;
  lease: RuntimeLeaseClaimV1;
  fact_id: string;
  occurred_at: string;
  record_json: string;
};
export type TwinCanonicalFactAppendResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  canonical_fact_write_count: 0 | 1;
};
export interface TwinCanonicalFactWriterV1 {
  readonly writer_id: string;
  appendCanonicalFact(client: PoolClient,input: TwinCanonicalFactAppendV1): Promise<TwinCanonicalFactAppendResultV1>;
}
export class DirectPostgresTwinCanonicalFactWriterV1 implements TwinCanonicalFactWriterV1 {
  readonly writer_id = "MCFT_CAP09_DIRECT_TWIN_CANONICAL_FACT_WRITER_V1";
  async appendCanonicalFact(client: PoolClient,input: TwinCanonicalFactAppendV1): Promise<TwinCanonicalFactAppendResultV1> {
    await client.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
      [input.fact_id,input.occurred_at,input.record_json],
    );
    return { status:"INSERTED", canonical_fact_write_count:1 };
  }
}
export class PostgresMcftCap09TwinCanonicalFactWriterV1 implements TwinCanonicalFactWriterV1 {
  readonly writer_id = "MCFT_CAP09_FENCED_TWIN_CANONICAL_FACT_WRITER_V1";
  async appendCanonicalFact(client: PoolClient,input: TwinCanonicalFactAppendV1): Promise<TwinCanonicalFactAppendResultV1> {
    const s=input.scope;
    const result=await client.query<{status:"INSERTED"|"EXISTING_IDEMPOTENT_SUCCESS";canonical_fact_write_count:number}>(
      `SELECT status,canonical_fact_write_count
         FROM public.mcft_cap09_twin_runtime_append_fact_v1(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::jsonb)`,
      [s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id,
       input.lease.lease_owner,input.lease.fencing_token.toString(),input.fact_id,input.occurred_at,input.record_json],
    );
    if(result.rows.length!==1) throw new Error("PHASE5_TWIN_DB_WRITER_RESULT_CARDINALITY");
    const row=result.rows[0]!;
    if(!["INSERTED","EXISTING_IDEMPOTENT_SUCCESS"].includes(row.status)||![0,1].includes(row.canonical_fact_write_count))
      throw new Error("PHASE5_TWIN_DB_WRITER_RESULT_INVALID");
    return {status:row.status,canonical_fact_write_count:row.canonical_fact_write_count as 0|1};
  }
}
