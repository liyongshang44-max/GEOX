// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_MIGRATION_V1.cjs
// Purpose: verify Operator Twin source-index migration stays aligned with the DDL contract.
// Boundary: this acceptance is static; it does not connect to a database and does not execute SQL.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSql(sql) {
  return String(sql)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function extractCreateTableBlock(sql, tableName) {
  const pattern = new RegExp(
    "CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+" +
      escapeRegExp(tableName) +
      "\\s*\\([\\s\\S]*?\\n\\);",
    "i"
  );

  const match = normalizeSql(sql).match(pattern);

  assert(match && match[0], "missing CREATE TABLE block: " + tableName, { tableName });

  return normalizeSql(match[0]);
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), "missing required token: " + label, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), "forbidden token present: " + label, { needle });
}

const contractPath = "db/contracts/operator_twin_source_indexes_v1.sql";
const migrationPath = "apps/server/db/migrations/2026_06_18_operator_twin_source_indexes_v1.sql";
const packagePath = "package.json";

assert(fs.existsSync(path.join(ROOT, contractPath)), "source index contract SQL missing", { contractPath });
assert(fs.existsSync(path.join(ROOT, migrationPath)), "source index migration SQL missing", { migrationPath });

const contractSql = readText(contractPath);
const migrationSql = readText(migrationPath);
const pkg = JSON.parse(readText(packagePath));

const tables = [
  "field_index_v1",
  "water_state_estimate_index_v1",
  "soil_moisture_sensing_window_index_v1",
  "weather_forecast_index_v1",
  "irrigation_scenario_set_index_v1",
  "decision_recommendation_index_v1",
];

for (const table of tables) {
  const contractBlock = extractCreateTableBlock(contractSql, table);
  const migrationBlock = extractCreateTableBlock(migrationSql, table);

  assert(
    migrationBlock === contractBlock,
    "migration table block drifted from contract: " + table,
    { table, contractBlock, migrationBlock }
  );
}

[
  "tenant_id text NOT NULL",
  "project_id text NOT NULL",
  "group_id text NOT NULL",
  "field_id text NOT NULL",
  "suggested_action_json jsonb",
  "options_json jsonb",
  "PRIMARY KEY",
].forEach((token) => {
  assertIncludes(migrationSql, token, "migration token " + token);
});

[
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "DROP TABLE",
  "TRUNCATE",
  "ao_act_task",
  "approval_decision",
  "dispatch",
].forEach((token) => {
  assertNotIncludes(migrationSql, token, "migration must remain schema-only: " + token);
});

assert(
  pkg.scripts &&
    pkg.scripts["ci:governance:operator-twin-source-index-migration"] ===
      "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_MIGRATION_V1.cjs",
  "package script ci:governance:operator-twin-source-index-migration missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-source-index-migration"] }
);

console.log("[operator-twin-source-index-migration] PASS");