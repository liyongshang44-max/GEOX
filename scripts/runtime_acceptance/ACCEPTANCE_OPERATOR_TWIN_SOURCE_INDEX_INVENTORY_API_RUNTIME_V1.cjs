// scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_API_RUNTIME_V1.cjs
// Purpose: verify the Operator Twin source-index inventory API is reachable and read-only at runtime.
// Boundary: runtime read acceptance only; no writes, no facts, no approvals, no dispatch, no AO-ACT task creation.

const BASE_URL = process.env.GEOX_BASE_URL || "http://127.0.0.1:3001";
const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 750;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(BASE_URL + path, {
        method: "GET",
        headers: {
          "x-tenant-id": "T_ACCEPTANCE",
          "x-project-id": "P_DEFAULT",
          "x-group-id": "G_CAF",
        },
      });

      if (!response.ok) {
        throw new Error("GET " + path + " failed with HTTP " + response.status + ": " + (await response.text()));
      }

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    "GEOX server is not reachable at " +
      BASE_URL +
      " after " +
      MAX_ATTEMPTS +
      " attempts. Start the server before running this runtime acceptance. " +
      (lastError && lastError.message ? lastError.message : "")
  );
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertFalse(value, label) {
  assert(value === false, label + " must be false", { actual: value });
}

async function main() {
  const payload = await fetchJson("/api/v1/operator/twin/source-indexes?field_id=FIELD_ACCEPTANCE");

  assert(payload.ok === true, "payload.ok must be true", payload);
  assert(payload.dataScope === "OFFICIAL_OPERATOR_TWIN_API", "dataScope must be OFFICIAL_OPERATOR_TWIN_API", payload);

  assertFalse(payload.writeReady, "writeReady");
  assertFalse(payload.dispatchReady, "dispatchReady");
  assertFalse(payload.approvalReady, "approvalReady");
  assertFalse(payload.taskCreationReady, "taskCreationReady");

  const inventory = payload.operator_twin_source_index_inventory_v1;

  assert(inventory && inventory.report_kind === "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY", "inventory report kind mismatch", inventory);
  assert(inventory.surface === "OPERATOR", "surface must be OPERATOR", inventory);
  assert(inventory.scope_policy && inventory.scope_policy.scope_applied === true, "scope must be applied", inventory.scope_policy);
  assert(Array.isArray(inventory.source_indexes), "source_indexes must be an array", inventory);
  assert(inventory.source_indexes.length >= 6, "source_indexes must include source-index tables", inventory.source_indexes);
  assert(inventory.summary && inventory.summary.write_ready === false, "summary write_ready must be false", inventory.summary);
  assert(inventory.summary && inventory.summary.dispatch_ready === false, "summary dispatch_ready must be false", inventory.summary);
  assert(Array.isArray(inventory.boundary_rules), "boundary_rules must be an array", inventory);

  const tableNames = inventory.source_indexes.map((row) => row.table_name);

  [
    "field_index_v1",
    "water_state_estimate_index_v1",
    "soil_moisture_sensing_window_index_v1",
    "weather_forecast_index_v1",
    "irrigation_scenario_set_index_v1",
    "decision_recommendation_index_v1",
  ].forEach((tableName) => {
    assert(tableNames.includes(tableName), "missing source index table " + tableName, tableNames);
  });

  console.log("[operator-twin-source-index-inventory-api-runtime] PASS");
}

main().catch((error) => {
  console.error("[operator-twin-source-index-inventory-api-runtime] FAIL");
  console.error(error);
  process.exit(1);
});
