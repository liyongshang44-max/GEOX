#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const CORE = "apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts";
const SERVICE = "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";

function text(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`AM19_PERSISTED_READBACK_REQUIRED_FILE_MISSING:${rel}`);
  return fs.readFileSync(file, "utf8");
}

function requireToken(source, token, code) {
  if (!source.includes(token)) throw new Error(code);
}

function forbidToken(source, token, code) {
  if (source.includes(token)) throw new Error(code);
}

const core = text(CORE);
const service = text(SERVICE);
const runner = text(RUNNER);

requireToken(core, "export type ExternalFormalAmendment19EvidenceWindowV1", "AM19_PERSISTED_READBACK_CANONICAL_TYPE_REQUIRED");
requireToken(core, "base_continuation_window:", "AM19_PERSISTED_READBACK_CANONICAL_NESTED_WINDOW_REQUIRED");
requireToken(core, "current_interval_forcing:", "AM19_PERSISTED_READBACK_CANONICAL_FORCING_REQUIRED");

requireToken(service, "ExternalFormalAmendment19EvidenceWindowV1", "AM19_PERSISTED_READBACK_SERVICE_CANONICAL_TYPE_REQUIRED");
requireToken(service, "payload.base_continuation_window?.current_interval_forcing", "AM19_PERSISTED_READBACK_SERVICE_NESTED_PATH_REQUIRED");
requireToken(service, 'mode === "EXACT_PROVIDER_INTERVAL_PAIR"', "AM19_PERSISTED_READBACK_MODE_A_REQUIRED");
requireToken(service, 'mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"', "AM19_PERSISTED_READBACK_MODE_B_REQUIRED");
requireToken(service, 'throw new Error("EXTERNAL_FORMAL_V3_AM19_PERSISTED_FORCING_MODE_REQUIRED")', "AM19_PERSISTED_READBACK_FAIL_CLOSED_REQUIRED");
forbidToken(service, "payload.current_interval_forcing", "AM19_PERSISTED_READBACK_TOP_LEVEL_SERVICE_PATH_FORBIDDEN");

requireToken(runner, "payload?.base_continuation_window?.current_interval_forcing", "AM19_PERSISTED_READBACK_RUNNER_NESTED_PATH_REQUIRED");
requireToken(runner, "{payload,payload,base_continuation_window,current_interval_forcing,mode}", "AM19_PERSISTED_READBACK_SQL_NESTED_PATH_REQUIRED");
forbidToken(runner, "{payload,payload,current_interval_forcing,mode}", "AM19_PERSISTED_READBACK_TOP_LEVEL_SQL_PATH_FORBIDDEN");
requireToken(runner, 'const MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v3";', "AM19_PERSISTED_READBACK_FRESH_MAIN_V3_STORE_REQUIRED");
requireToken(runner, 'const BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v3";', "AM19_PERSISTED_READBACK_FRESH_BLOCKED_V3_STORE_REQUIRED");
forbidToken(runner, 'const MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v2";', "AM19_PERSISTED_READBACK_FAILED_MAIN_V2_REUSE_FORBIDDEN");
forbidToken(runner, 'const BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v2";', "AM19_PERSISTED_READBACK_FAILED_BLOCKED_V2_REUSE_FORBIDDEN");

const result = {
  schema_version: "geox_mcft_cap09_amendment19_persisted_forcing_readback_acceptance_v1",
  status: "PASS",
  canonical_nested_path_required: true,
  service_top_level_path_forbidden: true,
  runner_top_level_path_forbidden: true,
  final_sql_top_level_path_forbidden: true,
  failed_v2_store_reuse_forbidden: true,
  fresh_v3_store_binding_required: true,
  formal_effect: false,
};
console.log(JSON.stringify(result));
