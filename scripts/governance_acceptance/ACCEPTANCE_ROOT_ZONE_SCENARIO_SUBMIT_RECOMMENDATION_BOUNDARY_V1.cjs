// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SCENARIO_SUBMIT_RECOMMENDATION_BOUNDARY_V1.cjs
const fs = require("node:fs");
const path = require("node:path");

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_SCENARIO_SUBMIT_RECOMMENDATION_BOUNDARY_V1";
const ROUTE_FILE = "apps/server/src/routes/v1/operator_twin.ts";
const BUILDER_FILE = "apps/server/src/domain/soil_water/root_zone_scenario_recommendation_submission_builder_v1.ts";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}
function assert(condition, message, detail) { if (!condition) fail(message, detail); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const route = read(ROUTE_FILE);
const builder = read(BUILDER_FILE);
assert(builder.startsWith(`// ${BUILDER_FILE}`), "builder must start with path comment");
assert(route.includes("/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation"), "route file contains root-zone submit route");
assert(route.includes("root_zone_irrigation_scenario_set_index_v1"), "route reads root_zone_irrigation_scenario_set_index_v1");
assert(route.includes("operator_root_zone_scenario_recommendation_submission_v1"), "route writes root-zone submission fact type");
assert(route.includes("decision_recommendation_v1"), "route writes decision recommendation candidate fact type");
assert(!/UPDATE\s+irrigation_scenario_set_index_v1|INSERT\s+INTO\s+irrigation_scenario_set_index_v1|DELETE\s+FROM\s+irrigation_scenario_set_index_v1/i.test(route), "route does not mutate old irrigation_scenario_set_index_v1");
for (const forbidden of ["approval_request_v1", "approval_decision_v1", "operation_plan_v1", "ao_act_task_v0", "roi_ledger_v1", "field_memory_v1"]) {
  assert(!route.includes(`type: "${forbidden}"`) && !route.includes(`type: '${forbidden}'`), `route does not create ${forbidden}`);
}
for (const flag of ["approval_created", "operation_plan_created", "task_created", "dispatch_created", "roi_created", "field_memory_created"]) {
  assert(builder.includes(`${flag}: false`), `${flag} boundary flag is present and false`);
}
for (const token of ["from \"pg\"", "require(\"pg\")", "process.env", "Date.now", "new Date", "randomUUID", "Fastify", "INSERT INTO facts", "approval_request_v1", "operation_plan_v1", "ao_act_task_v0", "dispatch_created: true", "roi_created: true", "field_memory_created: true"]) {
  assert(!builder.includes(token), `builder forbidden token absent: ${token}`);
}
const customerFiles = [...filesUnder("apps/server/src/routes"), ...filesUnder("apps/web")].filter((file) => /customer/i.test(file));
for (const file of customerFiles) {
  const text = read(file);
  assert(!text.includes("operator_root_zone_scenario_recommendation_submission_v1"), "customer files do not expose root-zone operator submission", file);
  assert(!text.includes("ROOT_ZONE_SCENARIO_SELECTION"), "customer files do not expose unconfirmed root-zone recommendation candidate", file);
}
console.log(`[${ACCEPTANCE_NAME}] PASS`);
