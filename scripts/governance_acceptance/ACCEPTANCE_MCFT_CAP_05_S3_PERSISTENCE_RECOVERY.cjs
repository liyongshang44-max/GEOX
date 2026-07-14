// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S3_PERSISTENCE_RECOVERY.cjs
// Purpose: verify the bounded MCFT-CAP-05 S3 persistence, idempotency, projection and canonical-recovery slice without granting S4 business-flow authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1";
const S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1";
const expectedFiles = [
  "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
  "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
  "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S3-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S3_PERSISTENCE_RECOVERY.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
].sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}
function read(path) { return fs.readFileSync(path, "utf8"); }
function json(path) { return JSON.parse(read(path)); }

const migration = read(expectedFiles[0]);
const repository = read(expectedFiles[1]);
const projection = read(expectedFiles[2]);
const map = read(expectedFiles[3]);
const matrix = json(expectedFiles[4]);
const authorization = json(expectedFiles[5]);
const delivery = json(expectedFiles[6]);
const persistence = json(expectedFiles[7]);
const status = json(expectedFiles[8]);
const task = read(expectedFiles[9]);
const dbAcceptance = read(expectedFiles[11]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s2Delivery = delivery.slices.find((slice) => slice.delivery_slice_id.includes("CONTRACTS-PROJECTION-MATH-CONFIG"));
const s3Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S3);

check(status.delivery_slice_id === S3 && status.status === "IMPLEMENTATION_CANDIDATE", "S3 candidate status is explicit");
check(status.s2_effectiveness?.effective === true && status.s2_effectiveness?.merged_main_gate === "PASS", "S2 merged-main effectiveness is prerequisite authority");
check(status.migration?.count === 1 && status.migration?.second_canonical_store_created === false, "exactly one additive migration and no second canonical store");
check(status.validation?.repository_typecheck === "PASS" && status.validation?.postgresql_acceptance === "PASS", "S3 typecheck and PostgreSQL acceptance are recorded");
check(status.next_delivery_slice_authorized === false, "S4 remains unauthorized in S3 candidate");

check(persistence.canonical_store === "public.facts" && persistence.canonical_store_count === 1, "public.facts remains sole canonical store");
check(persistence.canonical_object_persistence.length === 3, "G/H/C canonical persistence set has exactly three object types");
check(persistence.rebuildable_projection_tables.length === 6, "six bounded rebuildable support tables are declared");
check(persistence.feedback_cycle?.partial_cycle_projection_forbidden === true, "partial feedback-cycle inference is forbidden");
check(persistence.transaction_atomicity?.fact_guard_projection_same_transaction === true, "fact guard and projection share one transaction");

check((migration.match(/CREATE TABLE IF NOT EXISTS public\./g) || []).length === 6, "migration creates exactly six rebuildable support tables");
check(!/CREATE TABLE IF NOT EXISTS public\.facts/i.test(migration), "migration does not create another facts table");
for (const kind of ["G_DECISION_RECORD", "H_ACTION_FEEDBACK", "C_FORECAST_RESIDUAL"]) {
  check(migration.includes(`'${kind}'`), `migration authorizes bounded identity kind ${kind}`);
}
check(migration.includes("Rebuildable projection only") && migration.includes("not approval authority") && migration.includes("not canonical truth"), "projection-table comments preserve authority boundaries");

check(repository.includes("INSERT INTO facts") && !repository.includes("UPDATE facts"), "repository appends canonical facts and never updates them");
check(repository.includes("CAP05_IDEMPOTENCY_CONFLICT") && repository.includes("EXISTING_IDEMPOTENT_SUCCESS") && repository.includes("EXISTING_RECOVERED"), "idempotency and canonical-first recovery outcomes are explicit");
check(repository.includes("rebuildAllSupportState") && repository.includes("DELETE FROM twin_object_idempotency_index_v1"), "guard and projection rebuild entrypoint exists");
check(repository.includes("BEGIN") && repository.includes("ROLLBACK") && repository.includes("COMMIT"), "repository has explicit atomic transaction control");
check(repository.includes("buildCap05FeedbackCycleProjectionV1") && repository.includes("action_feedback_refs"), "complete cycle rebuild traces the canonical graph");
check(projection.includes("buildCap05ApprovedPlanBindingProjectionRowV1") && projection.includes("buildCap05FeedbackCycleProjectionRowV1"), "Plan binding and lifecycle projection row builders are pure and explicit");

check(dbAcceptance.includes("MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE") && dbAcceptance.includes("rebuildAllSupportState"), "isolated PostgreSQL recovery acceptance exists");
check(dbAcceptance.includes("INJECTED_S3_FAILURE") && dbAcceptance.includes("CAP05_IDEMPOTENCY_CONFLICT"), "fault rollback and semantic conflict are tested");
check(dbAcceptance.includes("SUMMARY") && dbAcceptance.includes("duplicate canonical facts"), "acceptance reports summary and no-duplicate proof");

check(cap05?.active_delivery_slice_id === S3 && cap05?.implementation_status === "S3_IMPLEMENTATION_CANDIDATE", "global Matrix activates only S3 candidate");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix does not authorize S4");
check(s2Delivery?.status === "MERGED_EFFECTIVE" && s2Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S2 effective");
check(s3Delivery?.status === "IMPLEMENTATION_CANDIDATE" && s3Delivery?.runtime_source_authorized === true, "Delivery Status records S3 candidate");
check(delivery.active_delivery_slice_id === S3 && delivery.status === "S3_IMPLEMENTATION_CANDIDATE", "Delivery Status top-level points to S3");
check(authorization.active_delivery_slice_id === S3 && authorization.next_authorized_slice_id_after_effectiveness === S4, "Authorization status advances to S3 and names S4 successor");
check(authorization.s2_effectiveness?.effective === true, "Authorization status records S2 effectiveness");
check(task.includes(S3) && /S3 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S3 implementation candidate");
check(/S4 authorized:\s*false/s.test(task), "task preserves S4 block");
check(map.includes("MCFT-CAP-05 S3 Persistence / Idempotency / Recovery Candidate"), "Implementation Map records S3 candidate");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate file remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 12-file S3 boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web")), "S3 boundary excludes routes and web");
check(!repository.includes("recommendation") && !repository.includes("model_activation"), "persistence source introduces no Recommendation or model activation path");
check(status.preserved_nonclaims.includes("NO_RECEIPT_CONSUMING_STATE_TICK") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "State Tick and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
