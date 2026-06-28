// scripts/frontend_acceptance/TK12_TWIN_TRACE_READBACK_PAGE_USABILITY_POLISH_V1.cjs
// Purpose: statically accept the TK12 readability polish for the Twin Trace readback page.
// Boundary: this acceptance preserves the TK11 read-only trace contract and verifies that usability changes do not introduce write actions.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const FILES = {
  doc: "docs/tasks/TK12-Twin-Trace-Readback-Page-Usability-Polish-v1.md",
  page: "apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx",
  tk11Acceptance: "scripts/frontend_acceptance/TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1.cjs",
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function hasForbiddenWriteSurface(content) {
  const forbidden = [
    "method: \"POST\"",
    "method: 'POST'",
    "method: `POST`",
    "method: \"PUT\"",
    "method: 'PUT'",
    "method: \"PATCH\"",
    "method: 'PATCH'",
    "method: \"DELETE\"",
    "method: 'DELETE'",
    "<button",
    "submitOperatorScenarioRecommendation",
    "createRecommendation",
    "createApproval",
    "createOperationPlan",
    "createTask",
    "dispatchTask",
    "createReceipt",
    "createAcceptance",
    "createRoi",
    "createFieldMemory",
  ];

  return forbidden.filter((token) => content.includes(token));
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_file_exists`, exists(file), { file });
  }

  const doc = read(FILES.doc);
  const page = read(FILES.page);
  const tk11Acceptance = read(FILES.tk11Acceptance);

  const requiredSystemDerived = [
    "field_state_snapshot_v1",
    "forecast_run_v1",
    "scenario_set_v1",
    "calibration_replay_v1",
    "forecast_error_v1",
    "field_learning_candidate_v1",
    "decision_cycle_v1",
  ];

  const requiredProvenance = [
    "entered_collected",
    "system_derived",
    "human_confirmed",
    "pointer_refs",
  ];

  const missingFormalization = [
    "ROI_FORMALIZATION_MISSING",
    "FORMAL_FIELD_MEMORY_MISSING",
    "H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL",
  ];

  assert("tk11_acceptance_still_present", tk11Acceptance.includes("TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1"), { file: FILES.tk11Acceptance });

  assert("tk12_polish_marker_present", page.includes("data-polish=\"tk12-usability-v1\""), { file: FILES.page });
  assert("collapsible_json_present", containsAll(page, ["<details", "<summary>查看 JSON</summary>", "data-polish=\"collapsible-json-card\"", "data-polish=\"json-details\""]), { file: FILES.page });
  assert("bounded_json_present", containsAll(page, ["data-polish=\"bounded-json-block\"", "maxHeight", "overflow: \"auto\"", "whiteSpace: \"pre-wrap\"", "wordBreak: \"break-word\""]), { file: FILES.page });
  assert("short_hash_present", containsAll(page, ["function shortHash", "title={row.determinismHash}", "{shortHash(row.determinismHash)}", "data-polish=\"short-hash-table\""]), { file: FILES.page });
  assert("boundary_summary_present", containsAll(page, ["AUTO_WRITE_FLAG_KEYS", "data-polish=\"boundary-flag-summary\"", "data-polish=\"boundary-json-details\""]), { file: FILES.page });

  assert("tk11_contract_preserved_provenance", containsAll(page, requiredProvenance), { requiredProvenance });
  assert("tk11_contract_preserved_system_derived", containsAll(page, requiredSystemDerived), { requiredSystemDerived });
  assert("tk11_contract_preserved_missing_formalization", containsAll(page, missingFormalization), { missingFormalization });
  assert("tk11_contract_preserved_boundaries", containsAll(page, [
    "current_stage",
    "read_only",
    "write_ready",
    "downstream_write_ready",
    "forbidden_auto_writes_absent",
    "boundary_flags",
    "data-boundary=\"read-only-no-post\"",
  ]), { file: FILES.page });

  assert("page_has_no_write_surface", hasForbiddenWriteSurface(page).length === 0, { matches: hasForbiddenWriteSurface(page) });
  assert("doc_states_polish_boundary", containsAll(doc, [
    "TK12 polishes the TK11 Twin Trace readback page",
    "Collapsing long JSON blocks by default",
    "Shortening long ids and hashes",
    "TK12 does not add API endpoints.",
  ]), { file: FILES.doc });

  const result = {
    ok: true,
    acceptance: "TK12_TWIN_TRACE_READBACK_PAGE_USABILITY_POLISH_V1",
    files: FILES,
    preserved_contract: {
      tk11_acceptance_still_present: true,
      read_only_boundary: true,
      provenance: requiredProvenance,
      system_derived: requiredSystemDerived,
      missing_formalization: missingFormalization,
    },
    polish: {
      collapsible_json: true,
      bounded_json: true,
      short_hash_table: true,
      boundary_flag_summary: true,
    },
    next_step: "RUN_TK11_AND_TK12_ACCEPTANCE_THEN_RUNTIME_PAGE_SMOKE",
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK12_TWIN_TRACE_READBACK_PAGE_USABILITY_POLISH_V1",
    error: error.message,
    details: error.details ?? null,
  }, null, 2));
  process.exit(1);
}
