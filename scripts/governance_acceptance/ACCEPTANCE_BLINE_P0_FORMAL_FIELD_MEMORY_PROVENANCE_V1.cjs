'use strict';

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fail = (message) => {
  console.error("ACCEPTANCE_BLINE_P0_FORMAL_FIELD_MEMORY_PROVENANCE_FAIL " + message);
  process.exit(1);
};

const acceptance = read("apps/server/src/routes/acceptance_v1.ts");
const service = read("apps/server/src/services/field_memory_service.ts");
const route = read("apps/server/src/routes/field_memory_v1.ts");
const contract = read("packages/contracts/src/field_memory/field_memory_v1.ts");
const schema001 = read("docker/postgres/init/001_schema.sql");
const schema004 = read("docker/postgres/init/004_field_memory_v1_full_contract.sql");
const flightTable = read("apps/server/src/services/flight_table/flight_table_skills_v1.ts");
const migration = read("apps/server/db/migrations/2026_09_01_field_memory_confidence_provenance_v1.sql");

if (/recordMemoryV1/.test(acceptance)) fail("Acceptance route must not create Field Memory");
if (/\b0\.18\b|\b0\.24\b/.test(acceptance)) fail("Acceptance route still contains fabricated soil-moisture defaults");
if (/\{\s*min:\s*0\.22\s*,\s*max:\s*0\.28\s*\}/.test(acceptance)) fail("Acceptance route still contains fabricated target range");

if (/loadDeviceObservationPairV1/.test(service)) fail("Formal Field Memory must not use field-wide latest observation fallback");
if (/ORDER\s+BY\s+observed_at_ts_ms\s+DESC[\s\S]{0,80}LIMIT\s+2/i.test(service)) fail("latest-two observation authority is forbidden");
if (/COALESCE\(record_json::jsonb#>>'\{payload,(?:tenant_id|project_id|group_id)\}',\s*\$[123]\)/.test(service)) fail("missing scope must not wildcard-match requested scope");
if (/\?\?\s*0\.8/.test(service)) fail("Field Memory service must not fabricate confidence=0.8");
if (/projectA|groupA/.test(service)) fail("Field Memory service must not fabricate project/group scope");
if (/\{\s*min:\s*0\.22\s*,\s*max:\s*0\.28\s*\}/.test(service)) fail("Formal Field Memory must not fabricate target range");

for (const token of [
  "ACCEPTANCE_AMBIGUOUS",
  "OBSERVATION_PAIR_AMBIGUOUS",
  "RECEIPT_AMBIGUOUS",
  "acceptance.payload?.receipt_id",
  "FIELD_MEMORY_PROJECT_ID_REQUIRED",
  "FIELD_MEMORY_GROUP_ID_REQUIRED"
]) {
  if (!service.includes(token)) fail("required fail-closed service token missing: " + token);
}

for (const token of ["ACCEPTANCE_AMBIGUOUS","OBSERVATION_PAIR_AMBIGUOUS","RECEIPT_AMBIGUOUS"]) {
  if (!route.includes(token)) fail("route must expose fail-closed provenance error: " + token);
}

if (!contract.includes("confidence?: number;")) fail("FieldMemoryV1 must represent unknown confidence");
for (const [name, text] of [["001_schema",schema001],["004_field_memory",schema004],["flight_table",flightTable]]) {
  if (/confidence\s+(?:NUMERIC|numeric)\s+NOT\s+NULL\s+DEFAULT\s+0\.8/.test(text)) {
    fail(name + " still recreates implicit confidence=0.8");
  }
}
if (!/ALTER\s+COLUMN\s+confidence\s+DROP\s+DEFAULT/i.test(migration) ||
    !/ALTER\s+COLUMN\s+confidence\s+DROP\s+NOT\s+NULL/i.test(migration)) {
  fail("successor migration must drop confidence default and NOT NULL");
}

console.log("ACCEPTANCE_BLINE_P0_FORMAL_FIELD_MEMORY_PROVENANCE_PASS");
console.log(JSON.stringify({
  acceptance_auto_memory: false,
  latest_two_fallback: false,
  null_scope_wildcard: false,
  exact_receipt_binding: true,
  fabricated_confidence: false,
  fabricated_target_range: false,
  unknown_confidence_supported: true
}));
