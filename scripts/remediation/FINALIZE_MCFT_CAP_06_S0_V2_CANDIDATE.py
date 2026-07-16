# scripts/remediation/FINALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.py
# Purpose: decode the CI-proven S0 v2 candidate bundle, harden its permanent runners, and atomically materialize the exact final file set.
# Boundary: one-time branch materialization only; no canonical Fact, Runtime, Candidate, Evaluation, activation, route, scheduler, or successor write.

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "acceptance-output/MCFT_CAP_06_S0_V2_CANDIDATE_BUNDLE.log"
WORKFLOW = ROOT / ".github/workflows/mcft-cap-06-s0-v2-finalize.yml"
MATERIALIZER = ROOT / "scripts/remediation/MATERIALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.cjs"
SELF = Path(__file__).resolve()
BASELINE_MAIN = "ca819ba51bdf3017dbefa96015f76bd3b66a647c"
BRANCH = "agent/mcft-cap-06-s0-v2-exact-qualification"

FINAL_FILES = sorted([
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "scripts/acceptance/run_acceptance.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs",
])


def replace_exactly(source: str, before: str, after: str, code: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{code}_MATCH_COUNT:{count}")
    return source.replace(before, after)


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def decode_bundle() -> None:
    if not BUNDLE.exists():
        raise RuntimeError("S0_CANDIDATE_BUNDLE_REQUIRED")
    bundle = json.loads(BUNDLE.read_text(encoding="utf-8"))
    if bundle.get("qualification_status") != "INSUFFICIENT_MATCHED_PAIRS":
        raise RuntimeError(f"S0_ACTUAL_QUALIFICATION_MISMATCH:{bundle.get('qualification_status')}")
    if sorted(bundle.get("exact_changed_file_boundary", [])) != FINAL_FILES:
        raise RuntimeError("S0_BUNDLE_CHANGED_FILE_BOUNDARY_MISMATCH")
    for item in bundle["files"]:
        relative = item["path"]
        if relative not in FINAL_FILES:
            raise RuntimeError(f"S0_BUNDLE_UNEXPECTED_FILE:{relative}")
        content = base64.b64decode(item["content_base64"])
        digest = "sha256:" + hashlib.sha256(content).hexdigest()
        if digest != item["sha256"]:
            raise RuntimeError(f"S0_BUNDLE_DIGEST_MISMATCH:{relative}")
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def reconcile_matrix() -> None:
    path = ROOT / "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    matrix = json.loads(path.read_text(encoding="utf-8"))
    matrix["schema_version"] = "geox_mcft_vertical_capability_line_matrix_v8"
    matrix["baseline"] = {
        "branch": "main",
        "commit": BASELINE_MAIN,
        "meaning": "MCFT-CAP-06 S0 v2 exact predecessor and dataset qualification candidate; repository history is graph-valid but INSUFFICIENT_MATCHED_PAIRS; Runtime remains unauthorized pending merged-main effectiveness",
    }
    write_json(path, matrix)


def reconcile_boundaries() -> None:
    for relative in [
        "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json",
        "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    ]:
        path = ROOT / relative
        value = json.loads(path.read_text(encoding="utf-8"))
        if "exact_changed_file_boundary" in value:
            value["exact_changed_file_boundary"] = FINAL_FILES
        if "exact_s0_candidate_changed_file_boundary" in value:
            value["exact_s0_candidate_changed_file_boundary"] = FINAL_FILES
        write_json(path, value)


def harden_exact_runner() -> None:
    path = ROOT / "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts"
    source = path.read_text(encoding="utf-8")
    source = replace_exactly(
        source,
        'const TEMP_RUNNER_INPUT_PATH = "acceptance-output/MCFT_CAP_06_S0_RUNNER_INPUT.json";\n',
        'const TEMP_RUNNER_INPUT_PATH = "acceptance-output/MCFT_CAP_06_S0_RUNNER_INPUT.json";\n'
        'const CI_WRAPPER_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs";\n'
        'const ACCEPTANCE_RUNNER_PATH = "scripts/acceptance/run_acceptance.cjs";\n',
        "S0_EXACT_CONSTANTS",
    )
    start = source.index("const EXACT_CHANGED_FILES = Object.freeze([")
    end = source.index("const PRESERVED_NONCLAIMS", start)
    source = source[:start] + '''const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  TASK_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  LOCK_PATH,
  QUALIFICATION_PATH,
  DELIVERY_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
  CI_WRAPPER_PATH,
  ACCEPTANCE_RUNNER_PATH,
].sort());

''' + source[end:]

    start = source.index("function assertRepositoryBoundary(): void {")
    end = source.index("\nfunction scopeValues()", start)
    source = source[:start] + r'''function assertRepositoryBoundary(): void {
  const executionRef = process.env.GITHUB_HEAD_REF
    || process.env.GITHUB_REF_NAME
    || git(["branch", "--show-current"]);
  const candidateMode = executionRef === BRANCH;
  const mainOrSuccessorMode = executionRef === "main"
    || executionRef.startsWith("agent/mcft-cap-06-");
  assert.equal(candidateMode || mainOrSuccessorMode, true, `S0_EXECUTION_REF_FORBIDDEN:${executionRef}`);

  const originMain = git(["rev-parse", "refs/remotes/origin/main"]);
  if (candidateMode) assert.equal(originMain, BASELINE_MAIN, "ORIGIN_MAIN_HEAD_MISMATCH");
  run(process.platform === "win32" ? "git.exe" : "git", ["merge-base", "--is-ancestor", BASELINE_MAIN, "HEAD"]);

  if (candidateMode) {
    const committed = git(["diff", "--name-only", BASELINE_MAIN, "HEAD"]).split(/\r?\n/).filter(Boolean);
    const workingTracked = git(["diff", "--name-only", "HEAD"]).split(/\r?\n/).filter(Boolean);
    const untracked = git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean);
    const generatedRuntimeArtifact = (file: string): boolean =>
      file === ".env.ci"
      || file === "docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md"
      || file === "docs/audit/FRONTEND_RUNTIME_PAGE_AUDIT_REPORT.md"
      || file.startsWith("docs/audit/frontend-runtime-page-audit/")
      || file.startsWith("acceptance-output/");
    const changed = [...new Set([
      ...committed,
      ...workingTracked.filter((file) => !generatedRuntimeArtifact(file)),
      ...untracked.filter((file) => !generatedRuntimeArtifact(file)),
    ])].sort();
    const forbidden = changed.filter((file) => !EXACT_CHANGED_FILES.includes(file));
    assert.deepEqual(forbidden, [], `S0_CHANGED_FILE_BOUNDARY_VIOLATION:${forbidden.join(",")}`);
  } else {
    for (const relativePath of EXACT_CHANGED_FILES) {
      assert.equal(fs.existsSync(absolute(relativePath)), true, `S0_PERMANENT_FILE_MISSING:${relativePath}`);
    }
  }
  ok(candidateMode
    ? "branch, reconciled main baseline, ancestry, and exact S0 candidate boundary are exact"
    : "post-S0 ancestry and permanent qualification files are present");
}
''' + source[end:]
    source = source.replace(
        '  fs.rmSync(absolute("acceptance-output"), { recursive: true, force: true });',
        '  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });',
    )
    for marker in [
        "CURRENT_REPOSITORY_HISTORY_EXPECTED_INSUFFICIENT",
        "CURRENT_REPOSITORY_HISTORY_GRAPH_MUST_PASS",
        "CURRENT_REPOSITORY_HISTORY_EXPECTS_NO_INVALID_GRAPH",
        "CAP05_TERMINAL_HISTORY_EXPECTS_ONE_CANONICAL_RESIDUAL",
    ]:
        if marker in source:
            raise RuntimeError(f"S0_OUTCOME_PRECONDITION_RETAINED:{marker}")
    path.write_text(source, encoding="utf-8")


def write_final_wrapper() -> None:
    path = ROOT / "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs"
    path.write_text(r'''// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs
// Purpose: execute the permanent S0 v2 exact qualification in existing CI against an isolated PostgreSQL database.
// Boundary: creates and destroys only the isolated acceptance database; no CAP-06 canonical write or Runtime authority change.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts';
const BASELINE_MAIN = 'ca819ba51bdf3017dbefa96015f76bd3b66a647c';
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s0_v2_ci';
const RESULT_LOG_PATH = path.join(ROOT, 'acceptance-output', 'MCFT_CAP_06_S0_V2_RESULT.log');

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccessful(result, label) {
  if (result.status === 0) return;
  throw new Error(`${label}_FAILED\n${String(result.stdout || '')}\n${String(result.stderr || '')}`);
}

function resolveBaseDatabaseUrl() {
  const explicit = String(process.env.DATABASE_URL || '').trim();
  if (explicit) return explicit;
  const user = String(process.env.POSTGRES_USER || '').trim();
  const password = String(process.env.POSTGRES_PASSWORD || '').trim();
  const database = String(process.env.POSTGRES_DB || '').trim();
  const host = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const port = String(process.env.POSTGRES_PORT || '5433').trim();
  if (!user || !password || !database || !host || !port) {
    throw new Error('MCFT_CAP_06_S0_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
  }
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

async function restoreGitAncestry() {
  if (fs.existsSync(path.join(ROOT, '.git', 'shallow'))) {
    requireSuccessful(run('git', ['fetch', '--no-tags', '--prune', '--unshallow', 'origin']), 'FETCH_UNSHALLOW');
  }
  requireSuccessful(run('git', ['fetch', 'origin', 'main:refs/remotes/origin/main']), 'FETCH_ORIGIN_MAIN');
  requireSuccessful(run('git', ['merge-base', '--is-ancestor', BASELINE_MAIN, 'HEAD']), 'S0_BASELINE_ANCESTRY');
}

async function recreateIsolatedDatabase(baseDatabaseUrl) {
  const adminUrl = new URL(baseDatabaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [ISOLATED_DATABASE_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE_NAME}`);
    await admin.query(`CREATE DATABASE ${ISOLATED_DATABASE_NAME}`);
  } finally {
    await admin.end();
  }
  const isolated = new URL(baseDatabaseUrl);
  isolated.pathname = `/${ISOLATED_DATABASE_NAME}`;
  return isolated.toString();
}

function persistResult(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('S0_V2_RESULT_JSON:'));
  if (!line) throw new Error('S0_V2_RESULT_JSON_REQUIRED');
  const parsed = JSON.parse(line.slice('S0_V2_RESULT_JSON:'.length));
  fs.mkdirSync(path.dirname(RESULT_LOG_PATH), { recursive: true });
  fs.writeFileSync(RESULT_LOG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

async function main() {
  await restoreGitAncestry();
  const databaseUrl = await recreateIsolatedDatabase(resolveBaseDatabaseUrl());
  const result = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
    '-w', 'exec', 'tsx', RUNNER_PATH,
  ], {
    env: {
      DATABASE_URL: databaseUrl,
      MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE: '1',
    },
  });
  process.stdout.write(String(result.stdout || ''));
  process.stderr.write(String(result.stderr || ''));
  requireSuccessful(result, 'MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION');
  persistResult(result.stdout);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
''', encoding="utf-8")


def wire_governance_gate() -> None:
    path = ROOT / "scripts/acceptance/run_acceptance.cjs"
    source = path.read_text(encoding="utf-8")
    needle = """    {
      id: 'MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION',
      command: 'node scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs',
      logFile: 'MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.log',
      notes: 'Reproduces the CAP-05 terminal chain in a separate database and reports the actual frozen S0 qualification status without presupposing the repository-history verdict.'
    }
"""
    replacement = needle.rstrip("\n") + ",\n    {\n      id: 'MCFT_CAP_06_S0_V2_GOVERNANCE',\n      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs',\n      logFile: 'MCFT_CAP_06_S0_V2_GOVERNANCE.log',\n      notes: 'Validates the formal S0 v2 predecessor lock, dataset qualification, exact changed-file boundary, and preserved non-authority claims.'\n    }\n"
    source = replace_exactly(source, needle, replacement, "S0_GATE_WIRING")
    path.write_text(source, encoding="utf-8")


def repair_generated_gate() -> None:
    path = ROOT / "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs"
    source = path.read_text(encoding="utf-8")
    source = source.replace(
        "assert.ok(task.includes('exact S0 v2 reproduced State fact count:\n33'));",
        "assert.ok(task.includes('exact S0 v2 reproduced State fact count:\\n33'));",
    )
    path.write_text(source, encoding="utf-8")


def remove_temporary_files() -> None:
    for path in [MATERIALIZER, WORKFLOW]:
        if path.exists():
            path.unlink()
    SELF.unlink()


def main() -> None:
    decode_bundle()
    reconcile_matrix()
    reconcile_boundaries()
    harden_exact_runner()
    write_final_wrapper()
    wire_governance_gate()
    repair_generated_gate()
    for relative in FINAL_FILES:
        if not (ROOT / relative).exists():
            raise RuntimeError(f"S0_FINAL_FILE_MISSING:{relative}")
    remove_temporary_files()
    print(f"PASS materialized exact S0 final candidate with {len(FINAL_FILES)} permanent files")


if __name__ == "__main__":
    main()
