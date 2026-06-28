// scripts/governance_acceptance/TK9_SOURCE_INDEX_AND_DECISION_STAGE_HOTFIX_V1.cjs
// Purpose: statically verify TK9 source-index compatibility and decision-stage semantic hotfix boundaries.
// Boundary: this script performs read-only file checks and does not connect to the database or mutate runtime state.

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`MISSING_FILE:${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function assertNoForbiddenDownstreamWrites(sql) {
  const forbidden = [
    /INSERT\s+INTO\s+decision_recommendation_index_v1/i,
    /INSERT\s+INTO\s+approval/i,
    /INSERT\s+INTO\s+operation_plan/i,
    /INSERT\s+INTO\s+ao_act/i,
    /INSERT\s+INTO\s+receipt/i,
    /INSERT\s+INTO\s+acceptance/i,
    /INSERT\s+INTO\s+roi/i,
    /INSERT\s+INTO\s+field_memory/i,
    /UPDATE\s+decision_recommendation_index_v1/i,
    /UPDATE\s+approval/i,
    /UPDATE\s+operation_plan/i,
    /UPDATE\s+ao_act/i,
    /UPDATE\s+receipt/i,
    /UPDATE\s+acceptance/i,
    /UPDATE\s+roi/i,
    /UPDATE\s+field_memory/i,
  ];
  return forbidden.filter((pattern) => pattern.test(sql)).map((pattern) => String(pattern));
}

const migrationPath = "apps/server/db/migrations/2026_06_28_tk9_source_index_and_decision_stage_hotfix_v1.sql";
const docPath = "docs/tasks/TK9-Source-Index-Compatibility-and-Decision-Stage-Hotfix-v1.md";

const migration = read(migrationPath);
const doc = read(docPath);

const sourceCompatibilityTokens = [
  "ALTER TABLE field_index_v1 ADD COLUMN IF NOT EXISTS project_id text",
  "ALTER TABLE field_index_v1 ADD COLUMN IF NOT EXISTS group_id text",
  "ALTER TABLE water_state_estimate_index_v1 ADD COLUMN IF NOT EXISTS computed_at timestamptz",
  "ALTER TABLE water_state_estimate_index_v1 ADD COLUMN IF NOT EXISTS soil_moisture_percent double precision",
  "root_zone_soil_moisture_percent",
  "COALESCE(computed_at, updated_at, created_at)",
  "COALESCE(soil_moisture_percent, root_zone_soil_moisture_percent)",
];

const stageTriggerTokens = [
  "CREATE OR REPLACE FUNCTION tk9_normalize_decision_cycle_current_stage_v1()",
  "last_contiguous_complete text := 'NOT_STARTED'",
  "IF stage_complete IS NOT TRUE THEN",
  "NEW.current_stage := last_contiguous_complete",
  "CREATE TRIGGER tk9_decision_cycle_current_stage_normalize_v1",
  "BEFORE INSERT OR UPDATE OF current_stage, state_machine_json ON decision_cycle_v1",
];

const docTokens = [
  "source-index compatibility",
  "current_stage",
  "last contiguous completed stage",
  "roi_entry_id is null",
  "does not create recommendations",
  "does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates",
];

const sourceCompatibilityPresent = hasAll(migration, sourceCompatibilityTokens);
const stageTriggerPresent = hasAll(migration, stageTriggerTokens);
const docPresent = hasAll(doc, docTokens);
const forbiddenWrites = assertNoForbiddenDownstreamWrites(migration);
const boundaryPreserved = forbiddenWrites.length === 0;

const ok = sourceCompatibilityPresent && stageTriggerPresent && docPresent && boundaryPreserved;

const result = {
  ok,
  acceptance: "TK9_SOURCE_INDEX_AND_DECISION_STAGE_HOTFIX_V1",
  migration: {
    file: migrationPath,
    source_compatibility_present: sourceCompatibilityPresent,
    stage_trigger_present: stageTriggerPresent,
  },
  doc: {
    file: docPath,
    token_count: docTokens.filter((token) => doc.includes(token)).length,
  },
  boundary: {
    downstream_write_boundary_preserved: boundaryPreserved,
    forbidden_write_matches: forbiddenWrites,
  },
  expected_runtime_effects: [
    "field_index_v1 project_id/group_id compatibility aliases are available",
    "water_state_estimate_index_v1 computed_at/soil_moisture_percent compatibility aliases are available",
    "decision_cycle_v1.current_stage is normalized to the last contiguous completed stage",
    "roi_entry_id=null no longer persists current_stage=ROI_FORMALIZED",
  ],
  next_step: "APPLY_TK9_MIGRATION_AND_RERUN_LOCAL_PERSISTED_TRACE_SMOKE",
};

console.log(JSON.stringify(result, null, 2));

if (!ok) {
  process.exit(1);
}
