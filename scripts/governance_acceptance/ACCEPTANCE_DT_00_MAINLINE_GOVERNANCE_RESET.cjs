// scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs
// Purpose: prove that DT-00 establishes one authoritative digital-twin mainline without changing runtime source.
// Boundary: this gate validates repository documents, classification data, and changed-file scope only.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const BASELINE_COMMIT = "97f5f5c108fb14404f75512b4ab775bd3dcefdeb";

const REQUIRED_FILES = Object.freeze({
  handoff: "docs/handoff/GEOX-COMPLETE-AGRICULTURAL-DIGITAL-TWIN-HANDOFF.md",
  master: "docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md",
  matrix: "docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json",
  record: "docs/digital_twin/GEOX-DT-00-MAINLINE-GOVERNANCE-RESET.md",
  pfaTaskLine: "docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md",
  pfaIssueRegister: "docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md",
  acceptance: "scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs",
});

const ALLOWED_CHANGED_FILES = new Set(Object.values(REQUIRED_FILES));
const ALLOWED_STATUSES = new Set([
  "ESTABLISHED",
  "ESTABLISHED_WITH_LIMITATIONS",
  "MISSING",
  "NOT_CLAIMED",
]);

const failures = [];
const passes = [];
const warnings = [];

function pass(message) {
  passes.push(message);
  process.stdout.write(`PASS: ${message}\n`);
}

function fail(message) {
  failures.push(message);
  process.stderr.write(`FAIL: ${message}\n`);
}

function warn(message) {
  warnings.push(message);
  process.stdout.write(`WARN: ${message}\n`);
}

function absolutePath(relativePath) {
  return path.join(REPOSITORY_ROOT, relativePath);
}

function requireFile(relativePath) {
  const target = absolutePath(relativePath);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    fail(`required file missing: ${relativePath}`);
    return false;
  }
  pass(`required file exists: ${relativePath}`);
  return true;
}

function readText(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), "utf8");
}

function requireIncludes(label, content, expected) {
  if (!content.includes(expected)) {
    fail(`${label} is missing required text: ${expected}`);
    return;
  }
  pass(`${label} contains: ${expected}`);
}

function requireExcludes(label, content, forbidden) {
  if (content.includes(forbidden)) {
    fail(`${label} contains forbidden active statement: ${forbidden}`);
    return;
  }
  pass(`${label} excludes forbidden active statement: ${forbidden}`);
}

for (const relativePath of Object.values(REQUIRED_FILES)) {
  requireFile(relativePath);
}

if (failures.length === 0) {
  const handoff = readText(REQUIRED_FILES.handoff);
  const master = readText(REQUIRED_FILES.master);
  const record = readText(REQUIRED_FILES.record);
  const pfaTaskLine = readText(REQUIRED_FILES.pfaTaskLine);
  const pfaIssueRegister = readText(REQUIRED_FILES.pfaIssueRegister);

  requireIncludes("handoff", handoff, "Minimum Complete Field Twin");
  requireIncludes("handoff", handoff, "Complete Agricultural Digital Twin");
  requireIncludes("handoff", handoff, "P50");
  requireIncludes("handoff", handoff, "P57");
  requireIncludes("handoff", handoff, "No new Twin runtime");

  requireIncludes("master task line", master, "primary mainline: Minimum Complete Field Twin");
  requireIncludes("master task line", master, "ultimate goal: Complete Agricultural Digital Twin");
  requireIncludes("master task line", master, "one governed zone");
  requireIncludes("master task line", master, "one root-zone definition");
  requireIncludes("master task line", master, "clock adapter");
  requireIncludes("master task line", master, "late evidence creates a revision");
  requireIncludes("master task line", master, "supersedes_ref");
  requireIncludes("master task line", master, "+1h through +72h, exactly 72 forecast points");
  requireIncludes("master task line", master, "CUSTOM_OPERATOR_OPTION` is an enhancement");
  requireIncludes("master task line", master, "The API prefix is proposed until DT-02");
  requireIncludes("master task line", master, "DT-01 Existing Capability Reconciliation");

  const semanticBoundaries = [
    "Evidence is not State.",
    "Sensor Reading is not Root-zone State.",
    "Forecast is not Scenario.",
    "Scenario is not Recommendation.",
    "Decision is not Approval.",
    "Approval is not Dispatch.",
    "Dispatch is not Execution.",
    "Executed is not Validated.",
    "Outcome Evidence is not Effect Attribution.",
    "Assimilation is not Calibration.",
    "Candidate is not Active Model.",
    "Replay Twin is not Production Twin.",
  ];

  for (const boundary of semanticBoundaries) {
    requireIncludes("master task line", master, boundary);
  }

  requireIncludes("DT-00 record", record, "PR #2298: CLOSED_WITHOUT_MERGE");
  requireIncludes("DT-00 record", record, "result: PASS");
  requireIncludes("DT-00 record", record, "next task: DT-01 Existing Capability Reconciliation");
  requireIncludes("DT-00 record", record, "No new Twin runtime capability is claimed by DT-00");

  const requiredPfaStatus = [
    "PFA-0: COMPLETE",
    "PFA-1: COMPLETE",
    "PFA-2: COMPLETE",
    "PFA-3: PAUSED; PR #2298 CLOSED_WITHOUT_MERGE",
    "PFA-4: PAUSED",
    "PFA-5: PAUSED",
    "PFA-6: PAUSED",
    "PFA-7: PAUSED",
  ];

  for (const status of requiredPfaStatus) {
    requireIncludes("PFA task line", pfaTaskLine, status);
  }

  requireIncludes("PFA task line", pfaTaskLine, "PFA-3 through PFA-7 do not globally block DT or MCFT.");
  requireIncludes("PFA task line", pfaTaskLine, "open findings: 16");
  requireIncludes("PFA task line", pfaTaskLine, "resolved PFA-2 findings: 3");
  requireIncludes("PFA task line", pfaTaskLine, "historical pre-PFA-2 baseline");
  requireIncludes("PFA task line", pfaTaskLine, "# Historical baseline definitions — PFA-3 through PFA-7");
  requireIncludes("PFA task line", pfaTaskLine, "# DT-00 Current authoritative closure");

  const historicalMarker = "# Historical baseline definitions — PFA-3 through PFA-7";
  const closureMarker = "# DT-00 Current authoritative closure";
  const currentBeforeHistory = pfaTaskLine.split(historicalMarker)[0] ?? "";
  const currentAfterHistory = pfaTaskLine.split(closureMarker)[1] ?? "";
  const currentPfaAuthority = `${currentBeforeHistory}\n${currentAfterHistory}`;

  requireExcludes("current PFA authority", currentPfaAuthority, "PFA-2: not started");
  requireExcludes("current PFA authority", currentPfaAuthority, "PFA-3: in progress");
  requireExcludes("current PFA authority", currentPfaAuthority, "Twin Runtime or production-readiness work remains blocked");
  requireExcludes("current PFA authority", currentPfaAuthority, "Subsequent Twin Runtime or production-readiness work remains blocked until");

  requireIncludes("PFA issue register", pfaIssueRegister, "open findings: 16");
  requireIncludes("PFA issue register", pfaIssueRegister, "resolved PFA-2 findings: 3");
  requireIncludes("PFA issue register", pfaIssueRegister, "OPEN_RETAINED_PRODUCT_DEBT");
  requireIncludes("PFA issue register", pfaIssueRegister, "NON_BLOCKING_UNLESS_TRIGGERED");
  requireIncludes("PFA issue register", pfaIssueRegister, "No finding is closed, downgraded, or reassigned by DT-00.");
  requireExcludes("PFA issue register", pfaIssueRegister, "continue to block subsequent runtime-kernel work");
}

let matrix;
if (failures.length === 0) {
  try {
    matrix = JSON.parse(readText(REQUIRED_FILES.matrix));
    pass("capability matrix JSON parses");
  } catch (error) {
    fail(`capability matrix JSON parse failed: ${error.message}`);
  }
}

if (matrix) {
  if (matrix.schema_version !== "geox_digital_twin_capability_matrix_v1") {
    fail("capability matrix schema_version is invalid");
  } else {
    pass("capability matrix schema_version is valid");
  }

  if (matrix.phase !== "DT-00") {
    fail("capability matrix phase must be DT-00");
  } else {
    pass("capability matrix phase is DT-00");
  }

  if (matrix.primary_mainline !== "MINIMUM_COMPLETE_FIELD_TWIN") {
    fail("capability matrix primary_mainline is invalid");
  } else {
    pass("capability matrix primary_mainline is correct");
  }

  if (matrix.ultimate_goal !== "COMPLETE_AGRICULTURAL_DIGITAL_TWIN") {
    fail("capability matrix ultimate_goal is invalid");
  } else {
    pass("capability matrix ultimate_goal is correct");
  }

  const capabilities = Array.isArray(matrix.capabilities) ? matrix.capabilities : [];
  if (capabilities.length === 0) {
    fail("capability matrix has no capability rows");
  } else {
    pass(`capability matrix contains ${capabilities.length} capability rows`);
  }

  const ids = new Set();
  for (const capability of capabilities) {
    const id = capability.capability_id;
    if (typeof id !== "string" || id.length === 0) {
      fail("capability row has no capability_id");
      continue;
    }

    if (ids.has(id)) {
      fail(`duplicate capability_id: ${id}`);
    }
    ids.add(id);

    if (!ALLOWED_STATUSES.has(capability.current_status)) {
      fail(`${id} has invalid current_status: ${capability.current_status}`);
    }

    if (typeof capability.next_owner !== "string" || capability.next_owner.length === 0) {
      fail(`${id} has no next_owner`);
    }

    if (!Array.isArray(capability.forbidden_claims)) {
      fail(`${id} has no forbidden_claims array`);
    }

    if (capability.current_status === "ESTABLISHED" || capability.current_status === "ESTABLISHED_WITH_LIMITATIONS") {
      if (!Array.isArray(capability.evidence_refs) || capability.evidence_refs.length === 0) {
        fail(`${id} is established but has no evidence_refs`);
      }
    }

    if (capability.current_status === "MISSING" && capability.runtime_entry !== "none") {
      fail(`${id} is MISSING but claims runtime_entry=${capability.runtime_entry}`);
    }
  }

  const byId = new Map(capabilities.map((capability) => [capability.capability_id, capability]));
  const expectedStatuses = new Map([
    ["DT-CAP-HOURLY-STATE-TRANSITION", "MISSING"],
    ["DT-CAP-OBSERVATION-ASSIMILATION", "MISSING"],
    ["DT-CAP-CHECKPOINT-RECOVERY", "MISSING"],
    ["DT-CAP-P50-REPLAY-LOOP", "ESTABLISHED_WITH_LIMITATIONS"],
    ["DT-CAP-P57-REPLAY-FREEZE", "ESTABLISHED_WITH_LIMITATIONS"],
    ["DT-CAP-LIVE-PRODUCTION-FIELD-TWIN", "NOT_CLAIMED"],
  ]);

  for (const [id, expectedStatus] of expectedStatuses) {
    const capability = byId.get(id);
    if (!capability) {
      fail(`required capability row missing: ${id}`);
      continue;
    }
    if (capability.current_status !== expectedStatus) {
      fail(`${id} must be ${expectedStatus}, got ${capability.current_status}`);
      continue;
    }
    pass(`${id} is correctly classified as ${expectedStatus}`);
  }
}

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const skipGitScope = process.env.DT00_ACCEPTANCE_SKIP_GIT_SCOPE === "1";
if (skipGitScope) {
  warn("git changed-file scope check skipped by DT00_ACCEPTANCE_SKIP_GIT_SCOPE=1");
} else {
  try {
    gitOutput(["cat-file", "-e", `${BASELINE_COMMIT}^{commit}`]);
    const changedOutput = gitOutput(["diff", "--name-only", `${BASELINE_COMMIT}...HEAD`]);
    const changedFiles = changedOutput.length === 0 ? [] : changedOutput.split(/\r?\n/).filter(Boolean);

    if (changedFiles.length === 0) {
      fail("no changed files found relative to DT-00 baseline");
    }

    for (const changedFile of changedFiles) {
      if (!ALLOWED_CHANGED_FILES.has(changedFile)) {
        fail(`DT-00 changed forbidden path: ${changedFile}`);
      }
    }

    if (changedFiles.length > 0 && changedFiles.every((changedFile) => ALLOWED_CHANGED_FILES.has(changedFile))) {
      pass(`changed-file scope contains only ${changedFiles.length} allowed DT-00 files`);
    }
  } catch (error) {
    fail(`git changed-file scope check failed: ${error.message}`);
  }
}

process.stdout.write(`\nDT-00 acceptance summary: ${passes.length} PASS, ${warnings.length} WARN, ${failures.length} FAIL\n`);

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write("DT-00 MAINLINE GOVERNANCE RESET: PASS\n");
}
