#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const CURRENT = [
  "docker/postgres/init/001_schema.sql",
  "docker/postgres/init/004_field_memory_v1_full_contract.sql",
  "apps/server/src/services/flight_table/flight_table_skills_v1.ts",
];
const MIGRATION = "apps/server/db/migrations/2026_09_01_field_memory_scope_defaults_removed_v1.sql";
const SERVICE = "apps/server/src/services/field_memory_service.ts";
const INVENTORY = "docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json";

const failures = [];
for (const path of CURRENT) {
  const source = fs.readFileSync(path, "utf8");
  if (/project_id\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'projectA'/i.test(source)) failures.push("PROJECT_SCOPE_DEFAULT_ACTIVE:" + path);
  if (/group_id\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'groupA'/i.test(source)) failures.push("GROUP_SCOPE_DEFAULT_ACTIVE:" + path);
}

const migration = fs.readFileSync(MIGRATION, "utf8");
if (!migration.includes("ALTER COLUMN project_id DROP DEFAULT")) failures.push("PROJECT_DEFAULT_DROP_MISSING");
if (!migration.includes("ALTER COLUMN group_id DROP DEFAULT")) failures.push("GROUP_DEFAULT_DROP_MISSING");

const service = fs.readFileSync(SERVICE, "utf8");
for (const token of [
  'if (!projectId || !groupId) throw new Error("FORMAL_FIELD_MEMORY_SCOPE_REQUIRED")',
  "project_id: tenant.project_id",
  "group_id: tenant.group_id",
]) {
  if (!service.includes(token)) failures.push("FORMAL_SCOPE_GUARD_MISSING:" + token);
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
const migrationRegistered = (inventory.surfaces || []).some((x) => x.source_path === MIGRATION && x.authority_class === "FIELD_MEMORY_SCOPE_DEFAULT_REMOVAL_MIGRATION");
if (!migrationRegistered) failures.push("SCOPE_DEFAULT_REMOVAL_MIGRATION_UNREGISTERED");

console.log("BLINE_FORMAL_MEMORY_SCOPE_PROVENANCE_STATS " + JSON.stringify({
  failures: failures.length,
  current_surface_count: CURRENT.length,
  forward_default_removal: true,
  historical_migrations_rewritten: false,
}));

for (const failure of failures) console.error("FAIL " + failure);
if (failures.length) {
  console.error("BLINE_FORMAL_MEMORY_SCOPE_PROVENANCE_FAIL count=" + failures.length);
  process.exit(1);
}
console.log("BLINE_FORMAL_MEMORY_SCOPE_PROVENANCE_PASS");
