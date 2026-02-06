#!/usr/bin/env node
/* Delivery acceptance runner v0.
   Purpose: run frozen acceptance scripts (Sprint19-22) as a productized, auditable checklist.
   Design: invoke the *PS1* acceptance entrypoints (not the internal .cjs runners) to reuse their
   stable environment assumptions and avoid drift.
*/
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

function sha256File(p) {
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function tryGit(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) return null;
  return (r.stdout || "").trim();
}

function parseArgs(argv) {
  const out = { baseUrl: "http://localhost:3000", repoRoot: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--baseUrl") out.baseUrl = argv[++i];
    else if (a === "--repoRoot") out.repoRoot = argv[++i];
  }
  return out;
}

function runPS1(ps1Path, args, cwd, stdoutPath, stderrPath) {
  const psArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ps1Path,
    ...args,
  ];

  const r = spawnSync("powershell", psArgs, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });

  fs.writeFileSync(stdoutPath, r.stdout || "", "utf8");
  fs.writeFileSync(stderrPath, r.stderr || "", "utf8");

  return r.status === null ? (r.error ? -1 : -1) : r.status;
}

function main() {
  const { baseUrl, repoRoot } = parseArgs(process.argv);

  const exportRoot = path.join(repoRoot, "_exports", "delivery");
  const casesRoot = path.join(exportRoot, "cases");
  ensureDir(casesRoot);

  const repoCommit = tryGit(["rev-parse", "HEAD"], repoRoot) || "UNKNOWN";
  const repoTags = (tryGit(["tag", "--points-at", "HEAD"], repoRoot) || "")
    .split(/\r?\n/)
    .filter(Boolean);

  console.log(`[INFO] Delivery acceptance v0 (baseUrl=${baseUrl})`);
  console.log(`[INFO] repo_commit=${repoCommit}`);
  console.log(`[INFO] repo_tags=${repoTags.join(",")}`);

  // Frozen acceptance entrypoints (PS1). Keep list explicit to prevent discovery drift.
  const cases = [
    { case_id: "ACCEPTANCE_AO_ACT_AUTHZ_V0", ps1: path.join(repoRoot, "scripts", "ACCEPTANCE_AO_ACT_AUTHZ_V0.ps1") },
    { case_id: "ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0", ps1: path.join(repoRoot, "scripts", "ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0.ps1") },
    { case_id: "ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0", ps1: path.join(repoRoot, "scripts", "ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1") },
    { case_id: "ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0", ps1: path.join(repoRoot, "scripts", "ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0.ps1") },
  ];

  const results = [];
  let allOk = true;

  for (const c of cases) {
    const caseDir = path.join(casesRoot, c.case_id);
    ensureDir(caseDir);
    const stdoutPath = path.join(caseDir, "stdout.txt");
    const stderrPath = path.join(caseDir, "stderr.txt");

    if (!fs.existsSync(c.ps1)) {
      // Hard fail: delivery checklist must be explicit and complete.
      fs.writeFileSync(stderrPath, `MISSING_PS1:${c.case_id}:${c.ps1}\n`, "utf8");
      console.log(`[FAIL] ${c.case_id} (missing PS1)`);
      results.push({
        case_id: c.case_id,
        ok: false,
        stdout_path: path.relative(repoRoot, stdoutPath),
        stderr_path: path.relative(repoRoot, stderrPath),
        artifacts: [],
        sha256: {
          stdout: fs.existsSync(stdoutPath) ? sha256File(stdoutPath) : null,
          stderr: sha256File(stderrPath),
        },
      });
      allOk = false;
      continue;
    }

    // Pass baseUrl through; repoRoot is implicitly the working dir.
    const exitCode = runPS1(c.ps1, ["-BaseUrl", baseUrl], repoRoot, stdoutPath, stderrPath);
    const ok = exitCode === 0;

    console.log(`${ok ? "[OK]" : "[FAIL]"} ${c.case_id} (exit=${exitCode})`);
    if (!ok) {
      console.log(`       stdout: ${path.relative(repoRoot, stdoutPath)}`);
      console.log(`       stderr: ${path.relative(repoRoot, stderrPath)}`);
    }

    results.push({
      case_id: c.case_id,
      ok,
      stdout_path: path.relative(repoRoot, stdoutPath),
      stderr_path: path.relative(repoRoot, stderrPath),
      artifacts: [],
      sha256: {
        stdout: sha256File(stdoutPath),
        stderr: sha256File(stderrPath),
      },
    });

    if (!ok) allOk = false;
  }

  // Write SSOT reports (always write, even on failure).
  const reportJsonPath = path.join(exportRoot, "acceptance_report_v0.json");
  const reportTxtPath = path.join(exportRoot, "acceptance_report_v0.txt");
  ensureDir(path.dirname(reportJsonPath));

  const report = {
    timestamp: nowIso(),
    repo_commit: repoCommit,
    repo_tags: repoTags,
    baseUrl,
    cases: results,
  };

  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  const lines = [];
  lines.push(`Delivery acceptance v0`);
  lines.push(`timestamp=${report.timestamp}`);
  lines.push(`repo_commit=${report.repo_commit}`);
  lines.push(`repo_tags=${repo_tags_to_str(repoTags)}`);
  lines.push(`baseUrl=${baseUrl}`);
  lines.push("");
  for (const r of results) {
    lines.push(`${r.ok ? "OK" : "FAIL"} ${r.case_id}`);
    lines.push(`  stdout=${r.stdout_path}`);
    lines.push(`  stderr=${r.stderr_path}`);
    lines.push(`  sha256.stdout=${r.sha256.stdout}`);
    lines.push(`  sha256.stderr=${r.sha256.stderr}`);
  }
  fs.writeFileSync(reportTxtPath, lines.join("\n") + "\n", "utf8");

  console.log(`[INFO] report.json=${path.relative(repoRoot, reportJsonPath)}`);
  console.log(`[INFO] report.txt=${path.relative(repoRoot, reportTxtPath)}`);

  process.exit(allOk ? 0 : 2);
}

function repo_tags_to_str(tags) {
  return Array.isArray(tags) ? tags.join(",") : "";
}

main();
