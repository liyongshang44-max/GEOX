// Purpose: expose the minimum authenticated GET-only Field/Season scope options required by the MCFT-CAP-07 Runtime navigator.
// Boundary: read projections only; no polygon aggregation, device/telemetry joins, read-model refresh, canonical write, Runtime source authority, or CAP-08 authority.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js";

function normalizedFieldId(value: unknown): string | null {
  const fieldId = typeof value === "string" ? value.trim() : "";
  if (!fieldId || fieldId.length > 128 || !/^[A-Za-z0-9_\-:.]+$/.test(fieldId)) return null;
  return fieldId;
}

export function registerFieldRuntimeScopeOptionsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/fields/:field_id/runtime-scope-options", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;

    const fieldId = normalizedFieldId((req.params as { field_id?: unknown } | undefined)?.field_id);
    if (!fieldId) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const field = await pool.query<{
      field_id: string;
      name: string | null;
      status: string | null;
    }>(
      `SELECT field_id, name, status
         FROM public.field_index_v1
        WHERE tenant_id = $1
          AND field_id = $2
        LIMIT 1`,
      [auth.tenant_id, fieldId],
    );
    if (field.rowCount !== 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const seasons = await pool.query<{
      season_id: string;
      name: string;
      crop: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
      updated_ts_ms: string | number;
    }>(
      `SELECT season_id, name, crop, start_date, end_date, status, updated_ts_ms
         FROM public.field_season_index_v1
        WHERE tenant_id = $1
          AND field_id = $2
        ORDER BY updated_ts_ms DESC, season_id ASC`,
      [auth.tenant_id, fieldId],
    );

    return reply.send({
      ok: true,
      exact_scope_prefix: {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        field_id: fieldId,
      },
      field: field.rows[0],
      seasons: seasons.rows,
      zone_discovery: {
        status: "UNAVAILABLE",
        zone_id_required: true,
      },
      boundary: {
        get_only: true,
        field_detail_aggregate_consumed: false,
        canonical_write_authorized: false,
        runtime_source_authorized: false,
        mcft_cap_08_authorized: false,
      },
    });
  });
}
