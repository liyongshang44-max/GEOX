// scripts/audit/_db_v0.cjs // File path for audit DB helpers.
"use strict"; // Enforce strict mode for safer JavaScript semantics.

const { Pool } = require("pg"); // Postgres client pool used by server (reuse dependency).
const path = require("node:path"); // Path utilities for resolving repo root.
const { resolveDatabaseUrl, findRepoRoot } = require("./_env_v0.cjs"); // Import env helpers to resolve DB URL.

/**
 * Create a pg Pool using an explicit database URL or environment defaults. // Function contract comment.
 */
function createPool({ databaseUrl, repoRoot }) { // Define pool creator.
  const url = resolveDatabaseUrl(repoRoot, databaseUrl); // Resolve final connection string.
  const pool = new Pool({ connectionString: url }); // Create connection pool (defaults are fine for local).
  return { pool, url }; // Return pool and the resolved URL (for diagnostics if needed).
}

/**
 * Fetch the latest ao_act_task_v0 for an act_task_id. // Contract comment.
 * Matches server semantics: ORDER BY occurred_at DESC LIMIT 1. // Determinism note (task updates).
 */
async function fetchLatestAoActTaskByActTaskId(pool, actTaskId) { // Define task fetcher.
  const sql = `\
SELECT fact_id, occurred_at, source, record_json\
FROM facts\
WHERE record_json->>'type' = 'ao_act_task_v0'\
  AND record_json#>>'{payload,act_task_id}' = $1\
ORDER BY occurred_at DESC\
LIMIT 1`; // SQL matches apps/server/src/routes/control_ao_act.ts.
  const out = await pool.query(sql, [actTaskId]); // Run parameterized query to avoid injection.
  return out.rows[0] || null; // Return row or null if not found.
}

/**
 * Fetch all ao_act_receipt_v0 rows for an act_task_id. // Contract comment.
 * Ordering rule is frozen to fact_id ASC for audit export stability. // Ordering discipline.
 */
async function fetchAoActReceiptsByActTaskId(pool, actTaskId) { // Define receipt fetcher.
  const sql = `\
SELECT fact_id, occurred_at, source, record_json\
FROM facts\
WHERE record_json->>'type' = 'ao_act_receipt_v0'\
  AND record_json#>>'{payload,act_task_id}' = $1\
ORDER BY fact_id ASC`; // Stable lexicographic ordering by fact_id (UUID).
  const out = await pool.query(sql, [actTaskId]); // Execute query.
  return out.rows; // Return all matching rows.
}

/**
 * Check whether a fact_id exists in the ledger. // Contract comment.
 */
async function factIdExists(pool, factId) { // Define existence checker.
  const sql = "SELECT 1 AS one FROM facts WHERE fact_id = $1 LIMIT 1"; // Minimal existence query.
  const out = await pool.query(sql, [factId]); // Execute query.
  return out.rows.length > 0; // True if row exists.
}

/**
 * Resolve repo root and create pool in one call (used by scripts). // Convenience helper comment.
 */
function resolveRepoRootAndPool({ databaseUrl, cwd }) { // Define combined resolver.
  const repoRoot = findRepoRoot(cwd || process.cwd()); // Find repo root from current working directory.
  const { pool, url } = createPool({ databaseUrl, repoRoot }); // Create pool with resolved DB URL.
  return { repoRoot, pool, databaseUrl: url }; // Return objects for script use.
}

module.exports = { // Export all helpers.
  createPool, // Export pool creator.
  fetchLatestAoActTaskByActTaskId, // Export task fetcher.
  fetchAoActReceiptsByActTaskId, // Export receipt fetcher.
  factIdExists, // Export existence checker.
  resolveRepoRootAndPool // Export combined helper.
}; // End exports.
