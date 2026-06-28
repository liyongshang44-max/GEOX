# docs/tasks/TK12-Twin-Trace-Readback-Page-Usability-Polish-v1.md

## Purpose

TK12 polishes the TK11 Twin Trace readback page for human readability without changing its contract.

The page remains a read-only trace readback surface for:

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

## Boundary

TK12 does not add API endpoints.

TK12 does not add database schema.

TK12 does not create or modify Twin Kernel objects.

TK12 does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

TK12 does not add ranking, severity coloring, prioritization, suggestions, or task generation.

## Polish scope

The page should improve readability by:

1. Collapsing long JSON blocks by default.
2. Bounding JSON block height with scrollable containers.
3. Shortening long ids and hashes in tables while preserving full values in `title` attributes.
4. Showing automatic write flags as a plain list before the raw `boundary_flags` JSON.
5. Keeping provenance, pointer refs, and raw readback available for audit use.

## Preserved TK11 contract

The page must still show:

1. `object_type = twin_trace_v1_read_model`.
2. `read_only = true`.
3. `write_ready = false`.
4. `downstream_write_ready = false`.
5. `entered_collected` provenance.
6. `system_derived` provenance.
7. `human_confirmed` provenance.
8. `pointer_refs` provenance.
9. All seven system-derived objects.
10. `decision_cycle_v1.current_stage`.
11. `missing_formalization` tokens.
12. `forbidden_auto_writes_absent`.

## Acceptance command

```powershell
node scripts/frontend_acceptance/TK12_TWIN_TRACE_READBACK_PAGE_USABILITY_POLISH_V1.cjs
```

## Runtime smoke URL

```text
http://127.0.0.1:5173/operator/twin/traces/dc_65e118bfa18dbf5dd3bce8b9
```

Expected visual result:

```text
Raw Readback no longer dominates the page.
Provenance and pointer refs are available but folded.
System-derived table shows shortened ids/hashes.
Boundary flags are readable before the raw JSON.
Read-only boundary remains explicit.
```
