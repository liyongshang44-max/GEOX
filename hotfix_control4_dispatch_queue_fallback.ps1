param(
  [string]$RepoRoot = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$target = Join-Path $RepoRoot "apps\server\src\routes\controlplane_v1.ts"
if (!(Test-Path $target)) { throw "Missing file: $target" }

$content = Get-Content $target -Raw

if ($content -match "projection-first hotfix") {
  Write-Host "Hotfix already applied: $target"
  exit 0
}

$pattern = '  // GET /api/v1/ao-act/dispatches[\s\S]*?\n  // POST /api/v1/ao-act/downlinks/published'
$replacement = @'
  // GET /api/v1/ao-act/dispatches
  // Explicit adapter queue: projection-first hotfix with facts-fallback.
  app.get("/api/v1/ao-act/dispatches", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Read-only queue scope.
    if (!auth) return; // Auth already responded.
    const tenant = queryTenantFromReq(req, auth); // Token-scoped tenant triple.
    if (!requireTenantMatchOr404(auth, tenant, reply)) return; // Cross-tenant stays non-enumerable.
    const q: any = (req as any).query ?? {}; // Raw query object.
    const limit = parseLimit(q); // Stable bounded limit.
    const actTaskId = typeof q.act_task_id === "string" ? q.act_task_id.trim() : ""; // Optional task-specific queue filter.

    let items = await listDispatchQueue(pool, tenant, limit); // First try the projection-backed queue read.
    if (actTaskId) {
      items = items.filter((x) => String(x?.outbox?.payload?.act_task_id ?? "") === actTaskId); // Apply task filter against projection rows.
    }

    if (items.length < 1) {
      const sql = `
        WITH latest_receipt AS (
          SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
            (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
            fact_id AS receipt_fact_id,
            occurred_at AS receipt_occurred_at,
            (record_json::jsonb) AS receipt_json
          FROM facts
          WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
          ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
        )
        SELECT o.fact_id AS outbox_fact_id,
               o.occurred_at AS outbox_occurred_at,
               (o.record_json::jsonb) AS outbox_json,
               t.fact_id AS task_fact_id,
               t.occurred_at AS task_occurred_at,
               (t.record_json::jsonb) AS task_json,
               r.receipt_fact_id,
               r.receipt_occurred_at,
               r.receipt_json
        FROM facts o
        JOIN facts t
          ON (t.record_json::jsonb->>'type') = 'ao_act_task_v0'
         AND (t.record_json::jsonb#>>'{payload,act_task_id}') = (o.record_json::jsonb#>>'{payload,act_task_id}')
         AND (t.record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (t.record_json::jsonb#>>'{payload,project_id}') = $2
         AND (t.record_json::jsonb#>>'{payload,group_id}') = $3
        LEFT JOIN latest_receipt r
          ON (o.record_json::jsonb#>>'{payload,act_task_id}') = r.act_task_id
        WHERE (o.record_json::jsonb->>'type') = 'ao_act_dispatch_outbox_v1'
          AND (o.record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (o.record_json::jsonb#>>'{payload,project_id}') = $2
          AND (o.record_json::jsonb#>>'{payload,group_id}') = $3
          AND ($4::text IS NULL OR (o.record_json::jsonb#>>'{payload,act_task_id}') = $4)
          AND r.receipt_fact_id IS NULL
        ORDER BY o.occurred_at ASC, o.fact_id ASC
        LIMIT $5
      `; // Fallback: derive the open queue directly from facts when the projection is empty/stale.
      const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId || null, limit]); // Query facts with the same tenant fence.
      items = (res.rows ?? []).map((row: any) => ({
        outbox_fact_id: String(row.outbox_fact_id),
        outbox_occurred_at: String(row.outbox_occurred_at),
        outbox: parseJsonMaybe(row.outbox_json) ?? row.outbox_json,
        task_fact_id: String(row.task_fact_id),
        task_occurred_at: String(row.task_occurred_at),
        task: parseJsonMaybe(row.task_json) ?? row.task_json,
        receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
        receipt_occurred_at: row.receipt_occurred_at ? String(row.receipt_occurred_at) : null,
        receipt: parseJsonMaybe(row.receipt_json)
      })); // Normalize fallback queue rows to the same response shape.
    }

    return reply.send({ ok: true, items }); // Stable queue payload regardless of projection freshness.
  });

  // POST /api/v1/ao-act/downlinks/published
'@

$newContent = [regex]::Replace($content, $pattern, $replacement, 1)
if ($newContent -eq $content) {
  throw "Hotfix failed: dispatch route block not found in $target"
}

$backup = "$target.bak_hotfix_dispatch_queue"
Copy-Item -Force $target $backup
Set-Content -Path $target -Value $newContent -Encoding utf8
Write-Host "Hotfix applied: $target"
Write-Host "Backup saved: $backup"
