#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const TARGET = path.join(ROOT, "apps/server/src/routes/operation_state_v1.ts");
const failures = [];

function fail(code) { failures.push(code); }
function assert(cond, code) { if (!cond) fail(code); }

const source = fs.readFileSync(TARGET, "utf8");

assert(source.includes('app.get("/api/v1/operations/:operationPlanId/detail"'), "DETAIL_GET_ROUTE_MISSING");
assert(source.includes("const skillTraceFacts = facts;"), "DETAIL_MUST_PROJECT_EXISTING_SKILL_FACTS_ONLY");
assert(!/app\.(?:post|put|patch|delete)\s*\(/.test(source), "OPERATION_STATE_MUTATING_HTTP_METHOD_FORBIDDEN");
assert(!/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_.\"']+\s+SET|DELETE\s+FROM)\s+facts\b/i.test(source), "OPERATION_STATE_FACT_DML_FORBIDDEN");
assert(!/\bensureSkillRunFact\s*\(/.test(source), "DETAIL_SKILL_RUN_SYNTHESIS_FORBIDDEN");
assert(!/\bupdateRulePerformance\s*\(/.test(source), "DETAIL_RULE_PERFORMANCE_UPDATE_FORBIDDEN");
assert(!/\brecordRulePerformance\s*\(/.test(source), "DETAIL_RULE_PERFORMANCE_WRITER_FORBIDDEN");
assert(!/\bappendSkillRunFact\s*\(/.test(source), "DETAIL_SKILL_RUN_WRITER_FORBIDDEN");
assert(!/from\s+["']\.\.\/domain\/skill_registry\/facts\.js["']/.test(source), "READ_MODEL_SKILL_FACT_WRITER_IMPORT_FORBIDDEN");

const detailStart = source.indexOf('app.get("/api/v1/operations/:operationPlanId/detail"');
const nextRoute = source.indexOf("\n  app.", detailStart + 20);
const detail = source.slice(detailStart, nextRoute > detailStart ? nextRoute : undefined);
assert(detail.includes("queryFactsForOperation"), "DETAIL_EXISTING_FACT_READ_MISSING");
assert(!/\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\b/i.test(detail), "DETAIL_SQL_MUTATION_FORBIDDEN");
assert(!/\b(?:append|record|write|insert|upsert)[A-Z][A-Za-z0-9_]*\s*\(/.test(detail), "DETAIL_SEMANTIC_WRITER_CALL_FORBIDDEN");

console.log("BLINE_OPERATION_STATE_READ_ONLY_STATS " + JSON.stringify({
  detail_route_present: detailStart >= 0,
  existing_fact_projection: detail.includes("const skillTraceFacts = facts;"),
  semantic_mutation_tokens: 0,
  failures: failures.length
}));

for (const code of failures) console.error("FAIL " + code);
if (failures.length) {
  console.error("BLINE_OPERATION_STATE_READ_ONLY_FAIL count=" + failures.length);
  process.exitCode = 1;
} else {
  console.log("BLINE_OPERATION_STATE_READ_ONLY_PASS");
}
