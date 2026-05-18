#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const steps = [
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FERTILIZATION_CONTRACT_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../governance_acceptance", file: "ACCEPTANCE_FERTILIZATION_NO_PROJECTION_WRITE_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../governance_acceptance", file: "ACCEPTANCE_FERTILIZATION_SKILL_BOUNDARY_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FERTILIZATION_API_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FERTILIZATION_VARIABLE_BRIDGE_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FORMAL_FERTILIZATION_E2E_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FERTILIZATION_REPORT_PROJECTION_V1.cjs", label: "fertilization-release" },
  { kind: "node", dir: "../frontend_acceptance", file: "ACCEPTANCE_CUSTOMER_FERTILIZATION_REPORT_V1.cjs", label: "fertilization-release" },
  { kind: "command", cmd: ["pnpm", "--filter", "@geox/server", "typecheck"], display: "pnpm --filter @geox/server typecheck", label: "fertilization-release" },
  { kind: "command", cmd: ["pnpm", "--filter", "@geox/web", "typecheck"], display: "pnpm --filter @geox/web typecheck", label: "fertilization-release" },
];

const root = resolve(__dirname);
const repoRoot = resolve(root, "../..");
let failed = false;

for (const step of steps) {
  if (step.kind === "node") {
    const fullPath = resolve(root, step.dir, step.file);
    if (!existsSync(fullPath)) {
      console.error(`[${step.label}] missing: ${fullPath}`);
      failed = true;
      continue;
    }
    console.log(`[${step.label}] running: node ${fullPath}`);
    const ret = spawnSync("node", [fullPath], { stdio: "inherit", cwd: repoRoot });
    if (ret.status !== 0) {
      console.error(`[${step.label}] failed: ${step.file} (exit=${ret.status})`);
      failed = true;
    }
    continue;
  }

  const [command, ...args] = step.cmd;
  console.log(`[${step.label}] running: ${step.display}`);
  const ret = spawnSync(command, args, { stdio: "inherit", cwd: repoRoot });
  if (ret.status !== 0) {
    console.error(`[${step.label}] failed: ${step.display} (exit=${ret.status})`);
    failed = true;
  }
}

if (failed) {
  console.error("[fertilization-release] release gate failed.");
  process.exit(1);
}

console.log("[fertilization-release] release gate passed.");
