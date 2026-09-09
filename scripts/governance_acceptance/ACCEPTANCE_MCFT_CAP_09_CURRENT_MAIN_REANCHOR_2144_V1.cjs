#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OLD_BASE = "ca56d60e3d927ccda5d1f28255e195575bf7a487";
const NEW_BASE = "2144d63477176f939a0d40d39b96ca97522af8db";
const NEW_TREE = "47ffe1a6ef479f101b548b6a0e3829f2ffa3a073";
const ARTIFACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-MAIN-REANCHOR-2144-V1.json";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const PLANNER = "scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs";
const DIST_WRITER = "apps/server/scripts/write_dist_entries.cjs";
const EXPECTED_FIRST_PARENT = [
  { pr: 3526, sha: "a56b419f6ddfc3ce2f2d957b0422bb8b4bd9d45c" },
  { pr: 3529, sha: "d19913c88b81b618507ff6da6fc4f3699123cdd6" },
  { pr: 3530, sha: NEW_BASE },
];
const ALLOWED_DEPENDENCY_OVERLAP = new Set([DIST_WRITER]);

function run(file, args, opts = {}) {
  const r = cp.spawnSync(file, args, {
    cwd: opts.cwd || ROOT,
    encoding: opts.encoding === null ? null : "utf8",
    input: opts.input,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: process.env,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !opts.allowFailure) {
    const err = new Error(`COMMAND_FAILED:${file} ${args.join(" ")}:exit=${r.status}`);
    err.stdout = r.stdout || "";
    err.stderr = r.stderr || "";
    throw err;
  }
  return r;
}
function text(file, args, opts = {}) { return String(run(file, args, opts).stdout || "").trim(); }
function gitShow(sha, rel) { return run("git", ["show", `${sha}:${rel}`], { encoding: null }).stdout; }
function sha256(data) { return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function diffNames(a, b) {
  const out = text("git", ["diff", "--name-only", `${a}..${b}`]);
  return out ? out.split(/\r?\n/).filter(Boolean).sort() : [];
}
function subject(sha) { return text("git", ["show", "-s", "--format=%s", sha]); }
function assert(condition, code, detail = null) {
  if (!condition) throw new Error(detail == null ? code : `${code}:${JSON.stringify(detail)}`);
}
function subsetOnly(values, allowed, code) {
  const unexpected = values.filter((value) => !allowed.has(value));
  assert(unexpected.length === 0, code, unexpected);
}

function mcftEntryBlocks(sourceBytes) {
  const source = Buffer.from(sourceBytes).toString("utf8");
  const blocks = {};
  const re = /\{\s*name:\s*path\.join\("([^"]+)",\s*"([^"]*mcft_cap09[^"]*)"\),[\s\S]*?\n\s*\},/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const key = `${m[1]}/${m[2]}`;
    if (blocks[key]) throw new Error(`REANCHOR_DUPLICATE_MCFT_DIST_ENTRY:${key}`);
    blocks[key] = sha256(Buffer.from(m[0], "utf8"));
  }
  assert(Object.keys(blocks).length >= 10, "REANCHOR_MCFT_DIST_ENTRY_SET_TOO_SMALL", Object.keys(blocks));
  return blocks;
}

const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, ARTIFACT), "utf8"));
assert(artifact.schema_version === "geox_mcft_cap09_current_main_reanchor_2144_v1", "REANCHOR_ARTIFACT_SCHEMA");
assert(artifact.status === "CANDIDATE_PROOF_BOUND_ADMISSION", "REANCHOR_ARTIFACT_STATUS");
assert(artifact.previous_accepted_mcft_base === OLD_BASE, "REANCHOR_ARTIFACT_OLD_BASE");
assert(artifact.current_protected_main === NEW_BASE, "REANCHOR_ARTIFACT_NEW_BASE");
assert(artifact.current_protected_main_tree === NEW_TREE, "REANCHOR_ARTIFACT_NEW_TREE");
assert(artifact.qcp_admission?.mode === "PROOF_BOUND_EXACT_BASE", "REANCHOR_ADMISSION_MODE");
assert(artifact.qcp_admission?.bare_sha_allowlist_admission_authorized === false, "REANCHOR_BARE_ALLOWLIST_FORBIDDEN");
for (const value of Object.values(artifact.non_effects || {})) assert(value === false, "REANCHOR_NON_EFFECT_MUST_BE_FALSE");

const liveMain = text("git", ["rev-parse", "origin/main"]);
assert(liveMain === NEW_BASE, "REANCHOR_PROTECTED_MAIN_DRIFT", { expected: NEW_BASE, actual: liveMain });
assert(text("git", ["rev-parse", `${NEW_BASE}^{tree}`]) === NEW_TREE, "REANCHOR_CURRENT_MAIN_TREE_DRIFT");
run("git", ["merge-base", "--is-ancestor", OLD_BASE, NEW_BASE]);
run("git", ["merge-base", "--is-ancestor", NEW_BASE, "HEAD"]);

const firstParent = text("git", ["rev-list", "--first-parent", "--reverse", `${OLD_BASE}..${NEW_BASE}`])
  .split(/\r?\n/).filter(Boolean);
assert(same(firstParent, EXPECTED_FIRST_PARENT.map((row) => row.sha)), "REANCHOR_FIRST_PARENT_LINEAGE_MISMATCH", firstParent);
for (const row of EXPECTED_FIRST_PARENT) {
  const message = text("git", ["show", "-s", "--format=%B", row.sha]);
  assert(message.includes(`Merge pull request #${row.pr}`), "REANCHOR_FIRST_PARENT_PR_IDENTITY_MISMATCH", row);
}

const qOld = gitShow(OLD_BASE, QCP);
const qNew = gitShow(NEW_BASE, QCP);
assert(Buffer.compare(qOld, qNew) === 0, "REANCHOR_QCP_BYTES_CHANGED_IN_SUCCESSOR_SEGMENT");
const pOld = gitShow(OLD_BASE, PLANNER);
const pNew = gitShow(NEW_BASE, PLANNER);
assert(Buffer.compare(pOld, pNew) === 0, "REANCHOR_PLANNER_BYTES_CHANGED_IN_SUCCESSOR_SEGMENT");

for (const rel of artifact.protected_anchor_paths || []) {
  const oldBytes = gitShow(OLD_BASE, rel);
  const newBytes = gitShow(NEW_BASE, rel);
  assert(Buffer.compare(oldBytes, newBytes) === 0, "REANCHOR_PROTECTED_ANCHOR_BYTES_CHANGED", rel);
}

const oldEntries = mcftEntryBlocks(gitShow(OLD_BASE, DIST_WRITER));
const newEntries = mcftEntryBlocks(gitShow(NEW_BASE, DIST_WRITER));
assert(same(oldEntries, newEntries), "REANCHOR_MCFT_DIST_ENTRY_BLOCK_DRIFT", { oldEntries, newEntries });

const changed = diffNames(OLD_BASE, NEW_BASE);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "geox-mcft-reanchor-"));
const wt = path.join(tmp, "main");
let resolverSummary;
try {
  run("git", ["worktree", "add", "--detach", wt, NEW_BASE]);
  const authority = JSON.parse(fs.readFileSync(path.join(wt, QCP), "utf8"));
  const planner = require(path.join(wt, PLANNER));
  const rr = planner.resolveDependencyResolvers(wt, authority);
  assert(rr.errors.length === 0, "REANCHOR_RESOLVER_MATERIALIZATION_ERRORS", rr.errors);

  const controlPaths = new Set(rr.resolved.CONTROL_PLANE_FILES?.paths || []);
  const authorityRefs = new Set((authority.checks || []).flatMap((row) => row.authority_refs || []));
  const allResolvedPaths = new Set(Object.values(rr.resolved).flatMap((row) => row.paths || []));
  const cpIntersection = changed.filter((item) => controlPaths.has(item));
  const authorityIntersection = changed.filter((item) => authorityRefs.has(item));
  const dependencyIntersection = changed.filter((item) => allResolvedPaths.has(item));

  assert(cpIntersection.length === 0, "REANCHOR_UNEXPECTED_CONTROL_PLANE_INTERSECTION", cpIntersection);
  assert(authorityIntersection.length === 0, "REANCHOR_UNEXPECTED_AUTHORITY_REF_INTERSECTION", authorityIntersection);
  subsetOnly(dependencyIntersection, ALLOWED_DEPENDENCY_OVERLAP, "REANCHOR_UNEXPECTED_DEPENDENCY_INTERSECTION");
  assert(dependencyIntersection.includes(DIST_WRITER), "REANCHOR_EXPECTED_SHARED_PACKAGING_OVERLAP_MISSING");

  const resolverRows = [];
  for (const [id, resolved] of Object.entries(rr.resolved).sort(([a], [b]) => a.localeCompare(b))) {
    const intersection = changed.filter((item) => (resolved.paths || []).includes(item));
    const oldDigest = planner.dependencyDigestForPaths(wt, OLD_BASE, resolved.paths || [], false);
    const newDigest = planner.dependencyDigestForPaths(wt, NEW_BASE, resolved.paths || [], false);
    assert(oldDigest.missing.length === 0 && newDigest.missing.length === 0, "REANCHOR_RESOLVER_DIGEST_MISSING", { id, old: oldDigest.missing, new: newDigest.missing });
    if (intersection.length === 0) {
      assert(oldDigest.digest === newDigest.digest, "REANCHOR_NONINTERSECTING_RESOLVER_DIGEST_DRIFT", id);
    } else {
      subsetOnly(intersection, ALLOWED_DEPENDENCY_OVERLAP, "REANCHOR_RESOLVER_UNEXPECTED_CHANGED_DEPENDENCY");
    }
    resolverRows.push({
      resolver_id: id,
      changed_dependencies: intersection,
      old_digest: oldDigest.digest,
      new_digest: newDigest.digest,
      digest_match: oldDigest.digest === newDigest.digest,
    });
  }
  resolverSummary = { cpIntersection, authorityIntersection, dependencyIntersection, resolverRows };
} finally {
  run("git", ["worktree", "remove", "--force", wt], { allowFailure: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}

const proof = {
  schema_version: "geox_mcft_cap09_current_main_reanchor_proof_v1",
  status: "PASS",
  previous_accepted_mcft_base: OLD_BASE,
  current_protected_main: NEW_BASE,
  current_protected_main_tree: NEW_TREE,
  exact_first_parent_successors: EXPECTED_FIRST_PARENT.map((row) => ({ ...row, subject: subject(row.sha) })),
  changed_path_count: changed.length,
  qcp_sha256_preserved: sha256(qNew),
  planner_sha256_preserved: sha256(pNew),
  mcft_dist_entry_blocks: newEntries,
  protected_anchor_count: (artifact.protected_anchor_paths || []).length,
  mcft_control_plane_path_intersection: resolverSummary.cpIntersection,
  mcft_authority_ref_intersection: resolverSummary.authorityIntersection,
  mcft_dependency_intersection: resolverSummary.dependencyIntersection,
  resolver_adjudication: resolverSummary.resolverRows,
  admission_mode: "PROOF_BOUND_EXACT_BASE",
  production_effect: false,
};
process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
