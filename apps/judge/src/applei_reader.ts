import { Pool } from "pg";

export type ReplayRow = {
  fact_id: string;
  occurred_at: Date;
  type: string;
  spatial_unit_id: string;
  group_id: string | null;
  sensor_id: string | null;
  record_json: any;
};

export class AppleIReader {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async ping(): Promise<void> {
    const r = await this.pool.query("select 1 as ok");
    if (!r?.rows?.length) throw new Error("pg ping failed");
  }

  async queryWindow(params: {
    startTsMs: number;
    endTsMs: number;
    groupId?: string;
    spatialUnitId?: string;
    sensorIds?: string[];
    metrics: string[];
  }): Promise<ReplayRow[]> {
    const startIso = new Date(params.startTsMs).toISOString();
    const endIso = new Date(params.endTsMs).toISOString();

    const where: string[] = [];
    const values: any[] = [];
    let i = 1;

    where.push(`occurred_at >= $${i++}::timestamptz`);
    values.push(startIso);
    where.push(`occurred_at <= $${i++}::timestamptz`);
    values.push(endIso);
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
      throw new Error("missing anchor");
    }

 // raw_sample_v1: metric 支持 base 前缀匹配（soil_temp_c -> soil_temp_c_30cm）
// marker_v1: 不做 metric 过滤
where.push(`
  (
    type <> 'raw_sample_v1'
    OR EXISTS (
      SELECT 1
      FROM unnest($${i++}::text[]) AS m(base)
      WHERE
        (record_json::jsonb #>> '{payload,metric}') = m.base
        OR left((record_json::jsonb #>> '{payload,metric}'), length(m.base) + 1) = (m.base || '_')
    )
  )
`);
values.push(params.metrics);

    const sql = `
      select fact_id, occurred_at, type, spatial_unit_id, group_id, sensor_id, record_json
      from facts_replay_v1
      where ${where.join(" and ")}
      order by occurred_at asc
      limit 200000
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
}
