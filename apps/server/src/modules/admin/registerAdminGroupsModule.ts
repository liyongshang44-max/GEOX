import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

function occurredAtToMs(occurred_at: unknown): number {
  if (occurred_at instanceof Date) return occurred_at.getTime();
  const ms = Date.parse(String(occurred_at ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

async function fetchGroupConfig(pool: Pool, params: { projectId?: string | null; groupId?: string | null }) {
  const projectId = params.projectId ?? null;
  const groupId = params.groupId ?? null;

  const sql = `
    SELECT
      sg.group_id,
      sg.project_id,
      sg.plot_id,
      sg.block_id,
      sg.created_at,
      ARRAY_AGG(DISTINCT sgm.sensor_id)
        FILTER (WHERE sgm.sensor_id IS NOT NULL) AS sensors
    FROM sensor_groups sg
    LEFT JOIN sensor_group_members sgm ON sgm.group_id = sg.group_id
    WHERE 1=1
      ${projectId ? "AND sg.project_id = $1" : ""}
      ${groupId ? (projectId ? "AND sg.group_id = $2" : "AND sg.group_id = $1") : ""}
    GROUP BY sg.group_id, sg.project_id, sg.plot_id, sg.block_id, sg.created_at
    ORDER BY sg.group_id ASC
  `;

  const args: any[] = [];
  if (projectId) args.push(projectId);
  if (groupId) args.push(groupId);

  const { rows } = await pool.query(sql, args);

  return (rows as any[]).map((r) => ({
    groupId: String(r.group_id),
    projectId: String(r.project_id),
    plotId: r.plot_id == null ? null : String(r.plot_id),
    blockId: r.block_id == null ? null : String(r.block_id),
    createdAt: occurredAtToMs(r.created_at),
    sensors: (Array.isArray(r.sensors) ? r.sensors : [])
      .filter((s: any) => typeof s === "string" && s.trim())
      .map((s: string) => s.trim())
      .sort(),
  }));
}

export function registerAdminGroupsModule(app: FastifyInstance, pool: Pool): void {
  app.get("/api/admin/groups", async (req, reply) => {
    const q = req.query as Record<string, unknown>;
    const projectId = typeof q.projectId === "string" ? q.projectId.trim() : null;
    const groups = await fetchGroupConfig(pool, { projectId });
    return reply.send({ groups });
  });

  app.post("/api/admin/groups", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "P_DEFAULT";
    const plotId = typeof body.plotId === "string" ? body.plotId.trim() : null;
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : null;
    if (!groupId) return reply.code(400).send({ error: "groupId required" });

    await pool.query(
      `INSERT INTO sensor_groups (group_id, project_id, plot_id, block_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (group_id) DO NOTHING`,
      [groupId, projectId, plotId, blockId]
    );

    const [g] = await fetchGroupConfig(pool, { groupId, projectId: null });
    return reply.send({ ok: true, group: g ?? null });
  });

  app.post("/api/admin/groups/:groupId/members", async (req, reply) => {
    const p = req.params as Record<string, unknown>;
    const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : "";
    if (!groupId) return reply.code(400).send({ error: "groupId required" });
    if (!sensorId) return reply.code(400).send({ error: "sensorId required" });

    const g0 = await pool.query(`SELECT 1 FROM sensor_groups WHERE group_id = $1`, [groupId]);
    if (g0.rowCount === 0) return reply.code(404).send({ error: `group not found: ${groupId}` });

    await pool.query(
      `INSERT INTO sensor_group_members (group_id, sensor_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [groupId, sensorId]
    );

    const [g] = await fetchGroupConfig(pool, { groupId, projectId: null });
    return reply.send({ ok: true, group: g ?? null });
  });

  app.delete("/api/admin/groups/:groupId/members/:sensorId", async (req, reply) => {
    const p = req.params as Record<string, unknown>;
    const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
    const sensorId = typeof p.sensorId === "string" ? p.sensorId.trim() : "";
    if (!groupId) return reply.code(400).send({ error: "groupId required" });
    if (!sensorId) return reply.code(400).send({ error: "sensorId required" });

    await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1 AND sensor_id = $2`, [groupId, sensorId]);

    const [g] = await fetchGroupConfig(pool, { groupId, projectId: null });
    return reply.send({ ok: true, group: g ?? null });
  });

  app.delete("/api/admin/groups/:groupId", async (req, reply) => {
    const p = req.params as Record<string, unknown>;
    const groupId = typeof p.groupId === "string" ? p.groupId.trim() : "";
    if (!groupId) return reply.code(400).send({ error: "groupId required" });

    await pool.query(`DELETE FROM sensor_group_members WHERE group_id = $1`, [groupId]);
    await pool.query(`DELETE FROM sensor_groups WHERE group_id = $1`, [groupId]);

    return reply.send({ ok: true, deleted: { groupId } });
  });
}
