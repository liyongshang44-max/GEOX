#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const ACCEPTANCE = "apps/server/src/routes/acceptance_v1.ts";
const FIELD_MEMORY_ROUTE = "apps/server/src/routes/field_memory_v1.ts";
const RESIDUAL = "docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json";
const ACTIVE = "docs/architecture/semantic_convergence/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json";
const MIGRATION = "README_MIGRATION.md";

const failures = [];
const read = (p) => fs.readFileSync(p, "utf8");
const acceptance = read(ACCEPTANCE);
const fieldMemoryRoute = read(FIELD_MEMORY_ROUTE);
const residual = JSON.parse(read(RESIDUAL));
const active = JSON.parse(read(ACTIVE));
const migration = read(MIGRATION);

function fail(code) { failures.push(code); }
function has(s, token) { return s.includes(token); }

if (has(acceptance, 'from "../services/field_memory_service.js"')) fail("ACCEPTANCE_IMPORTS_FIELD_MEMORY_SERVICE");
if (has(acceptance, "recordMemoryV1(")) fail("ACCEPTANCE_DIRECT_MEMORY_WRITE");
if (has(acceptance, "extractFormalFieldObservationPairV1(")) fail("ACCEPTANCE_DERIVES_FORMAL_MEMORY_OBSERVATION_PAIR");
if (has(acceptance, 'memory_lane: "FORMAL_FIELD_MEMORY"')) fail("ACCEPTANCE_MINTS_FORMAL_MEMORY_LANE");
if (has(acceptance, "learning_eligible: true")) fail("ACCEPTANCE_MINTS_LEARNING_ELIGIBILITY");
if (!has(acceptance, "Acceptance PASS is necessary provenance, never sufficient memory authority.")) {
  fail("ACCEPTANCE_BOUNDARY_DECLARATION_MISSING");
}

if (!has(fieldMemoryRoute, '/api/v1/field-memory/from-acceptance')) fail("EXPLICIT_FIELD_MEMORY_ROUTE_MISSING");

const res018 = (residual.surfaces || []).find((x) => x.surface_id === "RES-018");
if (!res018) fail("RES018_MISSING");
else {
  if ((res018.semantic_family || []).includes("field_memory")) fail("RES018_STILL_GRANTS_FIELD_MEMORY_AUTHORITY");
  if ((res018.writes || []).some((x) => /field memory/i.test(String(x)))) fail("RES018_STILL_DECLARES_MEMORY_WRITE");
}

const res252 = (residual.surfaces || []).find((x) => x.surface_id === "RES-252");
if (!res252) fail("RES252_MISSING");
else if ((res252.underlying_semantic_families || []).includes("field_memory")) {
  fail("RES252_LEDGER_SCOPE_STILL_INCLUDES_FIELD_MEMORY");
}

const ars031 = (active.surfaces || []).find((x) => x.surface_id === "ARS-031");
if (!ars031) fail("ARS031_MISSING");
else if ((ars031.semantic_family || []).includes("field_memory")) {
  fail("ARS031_STILL_CLASSIFIED_AS_FIELD_MEMORY_AUTHORITY");
}

for (const token of [
  "P26 Formal Acceptance / Outcome Boundary Gate v0 Freeze Closure",
  "Outcome/ROI evidence creates no automatic Field Memory",
  "P29 Policy-Controlled Field Memory Candidate Gate v0 Freeze Closure",
  "Candidate is not committed Field Memory",
  "P30 Field Memory Promotion / Commit Gate v0 Freeze Closure",
  "Explicit reviewed Field Memory promotion/commit gate"
]) {
  if (!has(migration, token)) fail("FROZEN_BOUNDARY_MISSING:" + token);
}

console.log("BLINE_ACCEPTANCE_NO_FORMAL_MEMORY_SIDE_EFFECT_STATS " + JSON.stringify({
  failures: failures.length,
  acceptance_direct_memory_write: has(acceptance, "recordMemoryV1("),
  acceptance_field_memory_service_import: has(acceptance, 'from "../services/field_memory_service.js"'),
  remaining_explicit_field_memory_route: has(fieldMemoryRoute, '/api/v1/field-memory/from-acceptance'),
}));

for (const failure of failures) console.error("FAIL " + failure);
if (failures.length) {
  console.error("BLINE_ACCEPTANCE_NO_FORMAL_MEMORY_SIDE_EFFECT_FAIL count=" + failures.length);
  process.exit(1);
}
console.log("BLINE_ACCEPTANCE_NO_FORMAL_MEMORY_SIDE_EFFECT_PASS");
