import { createProductApiReadOnlyPoolV1 } from "./product_api_public_runtime_v1.js";

type Row = Record<string, unknown>;

const FIELD_ID = "field_kbs_mcse_t4r1";
const EXPECTED = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
} as const;

function iso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

async function main(): Promise<void> {
  const databaseUrl = String(process.env.GEOX_PRODUCT_DATABASE_URL ?? "").trim();
  if (!databaseUrl) throw new Error("GEOX_PRODUCT_DATABASE_URL_REQUIRED");

  const pool = createProductApiReadOnlyPoolV1(databaseUrl);
  try {
    const session = await pool.query(
      `SELECT current_user,
              pg_catalog.current_setting('transaction_read_only') AS transaction_read_only`,
    );

    const exactActive = await pool.query(
      `SELECT tenant_id, project_id, group_id, field_id, season_id, zone_id,
              active_lineage_ref, updated_at
         FROM public.twin_active_lineage_index_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
        ORDER BY season_id, zone_id`,
      [EXPECTED.tenant_id, EXPECTED.project_id, EXPECTED.group_id, FIELD_ID],
    );

    const anyScopeActive = await pool.query(
      `SELECT tenant_id, project_id, group_id, field_id, season_id, zone_id,
              active_lineage_ref, updated_at
         FROM public.twin_active_lineage_index_v1
        WHERE field_id = $1
        ORDER BY tenant_id, project_id, group_id, season_id, zone_id
        LIMIT 100`,
      [FIELD_ID],
    );

    const activeTableSummary = await pool.query(
      `SELECT COUNT(*)::int AS total_active_rows,
              COUNT(DISTINCT field_id)::int AS distinct_active_fields
         FROM public.twin_active_lineage_index_v1`,
    );

    const anyScopeHistory = await pool.query(
      `SELECT tenant_id, project_id, group_id, field_id, season_id, zone_id,
              COUNT(*)::int AS history_row_count,
              MAX(logical_time) AS latest_logical_time
         FROM public.twin_state_history_projection_v1
        WHERE field_id = $1
        GROUP BY tenant_id, project_id, group_id, field_id, season_id, zone_id
        ORDER BY latest_logical_time DESC NULLS LAST
        LIMIT 100`,
      [FIELD_ID],
    );

    const fieldIndex = await pool.query(
      `SELECT tenant_id, project_id, group_id, field_id
         FROM public.field_index_v1
        WHERE field_id = $1
        ORDER BY tenant_id, project_id, group_id
        LIMIT 100`,
      [FIELD_ID],
    );

    const normalizeActive = (row: Row) => ({
      tenant_id: String(row.tenant_id),
      project_id: String(row.project_id),
      group_id: String(row.group_id),
      field_id: String(row.field_id),
      season_id: String(row.season_id),
      zone_id: String(row.zone_id),
      active_lineage_ref: String(row.active_lineage_ref),
      updated_at: iso(row.updated_at),
    });

    const normalizeHistory = (row: Row) => ({
      tenant_id: String(row.tenant_id),
      project_id: String(row.project_id),
      group_id: String(row.group_id),
      field_id: String(row.field_id),
      season_id: String(row.season_id),
      zone_id: String(row.zone_id),
      history_row_count: Number(row.history_row_count ?? 0),
      latest_logical_time: iso(row.latest_logical_time),
    });

    const activeRows = anyScopeActive.rows.map(normalizeActive);
    const mismatchedActiveRows = activeRows.filter((row) =>
      row.tenant_id !== EXPECTED.tenant_id
      || row.project_id !== EXPECTED.project_id
      || row.group_id !== EXPECTED.group_id
    );

    console.log("PRODUCT_API_MCFT_SCOPE_INVENTORY_V1=" + JSON.stringify({
      schema_version: "product_api_mcft_scope_inventory_v1",
      authority_ceiling: "READ_ONLY_NON_AUTHORITATIVE_DIAGNOSTIC",
      production_mutation: false,
      target: {
        field_id: FIELD_ID,
        expected_scope: EXPECTED,
      },
      database_session: {
        current_user: String(session.rows[0]?.current_user ?? ""),
        transaction_read_only: String(session.rows[0]?.transaction_read_only ?? ""),
      },
      active_table_summary: activeTableSummary.rows[0] ?? null,
      exact_scope_active_count: exactActive.rows.length,
      exact_scope_active_rows: exactActive.rows.map(normalizeActive),
      any_scope_active_count_for_field: activeRows.length,
      any_scope_active_rows_for_field: activeRows,
      mismatched_active_scope_count_for_field: mismatchedActiveRows.length,
      mismatched_active_scope_rows_for_field: mismatchedActiveRows,
      any_scope_history_count_for_field: anyScopeHistory.rows.length,
      any_scope_history_for_field: anyScopeHistory.rows.map(normalizeHistory),
      field_index_bindings: fieldIndex.rows.map((row: Row) => ({
        tenant_id: String(row.tenant_id),
        project_id: String(row.project_id),
        group_id: String(row.group_id),
        field_id: String(row.field_id),
      })),
      adjudication_hint:
        activeRows.length === 0
          ? "NO_ACTIVE_RUNTIME_FOR_FIELD_ANY_SCOPE"
          : mismatchedActiveRows.length > 0 && exactActive.rows.length === 0
            ? "ACTIVE_RUNTIME_EXISTS_BUT_SCOPE_BINDING_MISMATCH"
            : exactActive.rows.length > 0
              ? "EXPECTED_SCOPE_ACTIVE_RUNTIME_EXISTS"
              : "REVIEW_REQUIRED",
    }));

    setInterval(() => undefined, 60_000);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error("PRODUCT_API_MCFT_SCOPE_INVENTORY_V1_FAILED", error);
  process.exit(1);
});
