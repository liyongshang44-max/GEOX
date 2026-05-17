#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const steps = [
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_SAMPLING_CONTRACT_V1.cjs", label: "sampling-release" },
  { kind: "node", dir: "../governance_acceptance", file: "ACCEPTANCE_SAMPLING_NO_PROJECTION_WRITE_V1.cjs", label: "sampling-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_SAMPLING_API_V1.cjs", label: "sampling-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_FORMAL_SAMPLING_E2E_V1.cjs", label: "sampling-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_SAMPLING_REPORT_PROJECTION_V1.cjs", label: "sampling-release" },
  { kind: "node", dir: "../agronomy_acceptance", file: "ACCEPTANCE_CUSTOMER_SAMPLING_REPORT_V1.cjs", label: "sampling-release" },
  { kind: "command", cmd: ["pnpm", "run", "typecheck:server"], display: "pnpm run typecheck:server", label: "sampling-release" },
  { kind: "command", cmd: ["pnpm", "run", "typecheck:web"], display: "pnpm run typecheck:web", label: "sampling-release" },
];

const root = resolve(__dirname);
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
    const ret = spawnSync("node", [fullPath], { stdio: "inherit" });
    if (ret.status !== 0) {
      console.error(`[${step.label}] failed: ${step.file} (exit=${ret.status})`);
      failed = true;
    }
    continue;
  }

  const [command, ...args] = step.cmd;
  console.log(`[${step.label}] running: ${step.display}`);
  const ret = spawnSync(command, args, { stdio: "inherit", cwd: resolve(root, "../..") });
  if (ret.status !== 0) {
    console.error(`[${step.label}] failed: ${step.display} (exit=${ret.status})`);
    failed = true;
  }
}

if (failed) {
  console.error("[sampling-release] release gate failed.");
  process.exit(1);
}

console.log("[sampling-release] release gate passed.");
