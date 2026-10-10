#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const FORMALIZATION = "apps/server/src/routes/v1/twin_kernel_formalization.ts";
const OPERATOR = "apps/server/src/routes/v1/twin_kernel_operator_workflow.ts";
const INVENTORY = "docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json";
const ACTIVE = "docs/architecture/semantic_convergence/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json";

const formalization = fs.readFileSync(FORMALIZATION, "utf8");
const operator = fs.readFileSync(OPERATOR, "utf8");
const inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
const active = JSON.parse(fs.readFileSync(ACTIVE, "utf8"));
const failures = [];

const fail = (code) => failures.push(code);
const need = (source, token, code) => { if (!source.includes(token)) fail(code); };
const forbid = (source, token, code) => { if (source.includes(token)) fail(code); };

forbid(formalization, "INSERT INTO field_memory_v1", "TK13_DIRECT_FIELD_MEMORY_INSERT");
forbid(operator, "INSERT INTO field_memory_v1", "TK14_DIRECT_FIELD_MEMORY_INSERT");

for (const [name, source] of [["TK13", formalization], ["TK14", operator]]) {
  need(source, "createFormalFieldMemoryFromAcceptanceV1", name + "_CANONICAL_MATERIALIZER_MISSING");
  need(source, "field_memory_record_ref", name + "_REVIEWED_PROMOTION_REF_MISSING");
  need(source, "CANONICAL_REVIEWED_PROMOTION_MATERIALIZER", name + "_AUTHORITY_DECLARATION_MISSING");
  need(source, "legacy_twin_direct_memory_write: false", name + "_NEGATIVE_BOUNDARY_MISSING");
}

const res39 = (inventory.surfaces || []).find((x) => x.surface_id === "RES-039");
const res40 = (inventory.surfaces || []).find((x) => x.surface_id === "RES-040");
for (const [id, row] of [["RES039", res39], ["RES040", res40]]) {
  if (!row) { fail(id + "_MISSING"); continue; }
  if ((row.writes || []).some((x) => /field_memory_v1/i.test(String(x)))) fail(id + "_STILL_DECLARES_DIRECT_FIELD_MEMORY_WRITE");
}

const ars38 = (active.surfaces || []).find((x) => x.surface_id === "ARS-038");
const ars39 = (active.surfaces || []).find((x) => x.surface_id === "ARS-039");
for (const [id, row] of [["ARS038", ars38], ["ARS039", ars39]]) {
  if (!row) { fail(id + "_MISSING"); continue; }
  if (!(row.delegates_to || []).includes("apps/server/src/services/field_memory_service.ts")) fail(id + "_CANONICAL_DELEGATE_MISSING");
}

console.log("BLINE_LEGACY_TWIN_NO_DIRECT_FORMAL_MEMORY_STATS " + JSON.stringify({
  failures: failures.length,
  tk13_direct_insert: formalization.includes("INSERT INTO field_memory_v1"),
  tk14_direct_insert: operator.includes("INSERT INTO field_memory_v1"),
  tk13_proof_gated: formalization.includes("field_memory_record_ref"),
  tk14_proof_gated: operator.includes("field_memory_record_ref"),
}));

for (const failure of failures) console.error("FAIL " + failure);
if (failures.length) {
  console.error("BLINE_LEGACY_TWIN_NO_DIRECT_FORMAL_MEMORY_FAIL count=" + failures.length);
  process.exit(1);
}
console.log("BLINE_LEGACY_TWIN_NO_DIRECT_FORMAL_MEMORY_PASS");
