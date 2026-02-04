// scripts/audit/_env_v0.cjs // File path for the audit tool environment helpers.
"use strict"; // Enforce strict mode for safer JavaScript semantics.

const fs = require("node:fs"); // Node filesystem module for reading .env files.
const path = require("node:path"); // Node path module for resolving repo-relative paths.

/**
 * Load key=value pairs from a .env file into process.env, without overriding existing variables. // Function contract comment.
 * This keeps behavior explicit and avoids surprising overrides in CI or shells. // Rationale comment.
 */
function loadDotEnvIfPresent(repoRoot) { // Define .env loader function.
  const envPath = path.join(repoRoot, ".env"); // Compute repo-root .env path.
  if (!fs.existsSync(envPath)) return; // If no .env exists, do nothing.
  const raw = fs.readFileSync(envPath, "utf8"); // Read .env file as UTF-8 text.
  for (const line of raw.split(/\r?\n/)) { // Iterate .env lines (Windows/Unix compatible).
    const trimmed = line.trim(); // Trim whitespace.
    if (trimmed.length === 0) continue; // Skip empty lines.
    if (trimmed.startsWith("#")) continue; // Skip comment lines.
    const eq = trimmed.indexOf("="); // Find first '=' delimiter.
    if (eq <= 0) continue; // Skip malformed lines without key.
    const key = trimmed.slice(0, eq).trim(); // Extract key part.
    let val = trimmed.slice(eq + 1).trim(); // Extract value part.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) { // Handle quoted values.
      val = val.slice(1, -1); // Remove surrounding quotes.
    }
    if (process.env[key] === undefined) process.env[key] = val; // Set env var only if absent.
  }
}

/**
 * Resolve a Postgres connection string for audit tools. // Function contract comment.
 * Priority: explicit --databaseUrl > DATABASE_URL > PG* env defaults (docker-compose compatible). // Priority rules comment.
 */
function resolveDatabaseUrl(repoRoot, explicitDatabaseUrl) { // Define DB URL resolver.
  loadDotEnvIfPresent(repoRoot); // Load .env once, without overriding existing env.
  if (explicitDatabaseUrl && explicitDatabaseUrl.length > 0) return explicitDatabaseUrl; // Respect explicit CLI override.
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) return process.env.DATABASE_URL; // Use DATABASE_URL if present.
  const host = process.env.PGHOST || "127.0.0.1"; // Default host for local docker-compose.
  const port = process.env.PGPORT || "5432"; // Default port for Postgres.
  const db = process.env.PGDATABASE || "landos"; // Default DB name from docker-compose.yml.
  const user = process.env.PGUSER || "landos"; // Default user from docker-compose.yml.
  const pass = process.env.PGPASSWORD || "landos_pwd"; // Default password from docker-compose.yml.
  const enc = (s) => encodeURIComponent(s); // Helper to URL-encode credentials safely.
  return `postgres://${enc(user)}:${enc(pass)}@${host}:${port}/${enc(db)}`; // Build a standard Postgres URL.
}

/**
 * Find repo root as the nearest directory containing package.json. // Repo root resolution comment.
 */
function findRepoRoot(startDir) { // Define repo root finder.
  let cur = startDir; // Initialize cursor at start directory.
  while (true) { // Walk upwards until root.
    const pj = path.join(cur, "package.json"); // Candidate marker file.
    if (fs.existsSync(pj)) return cur; // If marker exists, treat as repo root.
    const parent = path.dirname(cur); // Compute parent directory.
    if (parent === cur) return startDir; // If we reached filesystem root, fallback to startDir.
    cur = parent; // Move up one level.
  }
}

module.exports = { resolveDatabaseUrl, findRepoRoot }; // Export helpers for other audit scripts.
