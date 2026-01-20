import { Pool } from "pg";

export type ReplayRow = {
  fact_id: string;
  occurred_at: Date;
  type: string;
  spatial_unit_id: string;
  group_id: string | null;
  sensor_id: string | null;
  record_json: any; // parsed json
};

export class PgStore {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async ping(): Promise<void> {
    const r = await this.pool.query("select 1 as ok");
    if (!r?.rows?.length) throw new Error("pg ping failed");
  }

  async insertFact(args: {
    fact_id: string;
    occurred_at_iso: string; // must be ISO, UTC recommended
    source: "device" | "gateway" | "system" | "human";
    record_json_text: string; // JSON string
  }): Promise<void> {
    // NOTE: facts constraints already enforce envelope/type/metric/unit/quality.
    await this.pool.query(
      `insert into facts (fact_id, occurred_at, source, record_json)
       values ($1, $2::timestamptz, $3, $4)`,
      [args.fact_id, args.occurred_at_iso, args.source, args.record_json_text]
    );
  }

  async querySeries(params: {
    startTsMs: number;
    endTsMs: number;
    spatialUnitId?: string;
    groupId?: string;
    sensorIds?: string[]; // optional
    metrics: string[];
    maxPoints: number;
  }): Promise<ReplayRow[]> {
    const startIso = new Date(params.startTsMs).toISOString();
    const endIso = new Date(params.endTsMs).toISOString();

    // We read ONLY from replay view (frozen contract).
    // Filter preference: spatial_unit_id > group_id > sensor_id list.
    const where: string[] = [];
    const values: any[] = [];
    let i = 1;

    where.push(`occurred_at >= $${i++}::timestamptz`);
    values.push(startIso);
    where.push(`occurred_at <= $${i++}::timestamptz`);
    values.push(endIso);

    // Only facts types relevant to series assembly live here.
    where.push(`type in ('raw_sample_v1','marker_v1')`);

    if (params.spatialUnitId) {
      where.push(`spatial_unit_id = $${i++}`);
      values.push(params.spatialUnitId);
    } else if (params.groupId) {
      where.push(`group_id = $${i++}`);
      values.push(params.groupId);
    } else if (params.sensorIds && params.sensorIds.length) {
      where.push(`sensor_id = any($${i++}::text[])`);
      values.push(params.sensorIds);
    } else {
      // caller must provide at least one anchor
      throw new Error("spatialUnitId or groupId or sensorId required");
    }

    // metric filtering only applies to raw_sample_v1 (markers have no metric semantics).
    // We keep them in result; router will split.
    // For raw samples: record_json.payload.metric in allowlist.
    where.push(
      `(type <> 'raw_sample_v1' or (record_json::jsonb -> 'payload' ->> 'metric') = any($${i++}::text[]))`
    );
    values.push(params.metrics);

    // We return the raw evidence stream; downsample happens in router (keeps your old logic).
    const limit = Math.max(200, Math.min(params.maxPoints * 10, 200000));
    const sql = `
      select fact_id, occurred_at, type, spatial_unit_id, group_id, sensor_id, record_json
      from facts_replay_v1
      where ${where.join(" and ")}
      order by occurred_at asc
      limit ${limit}
    `;
    const r = await this.pool.query(sql, values);

    return r.rows.map((row: any) => ({
      fact_id: row.fact_id,
      occurred_at: row.occurred_at,
      type: row.type,
      spatial_unit_id: row.spatial_unit_id,
      group_id: row.group_id,
      sensor_id: row.sensor_id,
      record_json: typeof row.record_json === "string" ? JSON.parse(row.record_json) : row.record_json,
    }));
  }

  async getFactById(factId: string): Promise<ReplayRow | null> {
    const r = await this.pool.query(
      `select fact_id, occurred_at, type, spatial_unit_id, group_id, sensor_id, record_json
       from facts_replay_v1
       where fact_id = $1
       limit 1`,
      [factId]
    );
    if (!r.rows.length) return null;
    const row: any = r.rows[0];
    return {
      fact_id: row.fact_id,
      occurred_at: row.occurred_at,
      type: row.type,
      spatial_unit_id: row.spatial_unit_id,
      group_id: row.group_id,
      sensor_id: row.sensor_id,
      record_json: typeof row.record_json === "string" ? JSON.parse(row.record_json) : row.record_json,
    };
  }
}
