-- GEOX · Sprint 10 · AO-ACT v0
-- Derived Action Index (VIEW). Governance index, not Ledger.
--
-- Invariants:
--   - Read-only, derived from facts (append-only)
--   - Deterministic selection for replay/audit
--   - MUST NOT be used as an execution trigger (governance rule)

CREATE OR REPLACE VIEW ao_act_index_v0 AS
WITH
  act_tasks AS (
    SELECT
      f.fact_id AS task_fact_id,
      f.occurred_at AS task_occurred_at,
      f.source AS task_source,
      (f.record_json::jsonb) AS task_record_json,
      ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
      ((f.record_json::jsonb)->'payload'->>'action_type') AS action_type
    FROM facts f
    WHERE (f.record_json::jsonb)->>'type' = 'ao_act_task_v0'
  ),
  act_receipts AS (
    SELECT
      f.fact_id AS receipt_fact_id,
      f.occurred_at AS receipt_occurred_at,
      f.source AS receipt_source,
      (f.record_json::jsonb) AS receipt_record_json,
      ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
      ((f.record_json::jsonb)->'payload'->>'status') AS status
    FROM facts f
    WHERE (f.record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
  ),
  latest_receipt AS (
    SELECT DISTINCT ON (r.act_task_id)
      r.act_task_id,
      r.receipt_fact_id,
      r.receipt_occurred_at,
      r.receipt_source,
      r.status,
      r.receipt_record_json
    FROM act_receipts r
    ORDER BY r.act_task_id, r.receipt_occurred_at DESC, r.receipt_fact_id DESC
  )
SELECT
  t.act_task_id,
  t.action_type,
  t.task_fact_id,
  t.task_occurred_at,
  t.task_source,
  lr.receipt_fact_id,
  lr.receipt_occurred_at,
  lr.receipt_source,
  lr.status,
  t.task_record_json AS task_record_json,
  lr.receipt_record_json AS receipt_record_json
FROM act_tasks t
LEFT JOIN latest_receipt lr
  ON lr.act_task_id = t.act_task_id
ORDER BY t.act_task_id;
