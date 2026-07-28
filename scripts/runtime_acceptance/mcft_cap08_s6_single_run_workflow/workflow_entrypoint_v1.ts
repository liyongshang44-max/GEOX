import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { validateExecutionAuthorityV1 } = require("./execution_authority_gate_v1.cjs") as {
  validateExecutionAuthorityV1(authority: Record<string, unknown>, input: Record<string, string>): { module_path: string };
};
const { validatePortBundleV1, validateCreatedPortsV1 } = require("./workflow_port_bundle_contract_v1.cjs") as {
  validatePortBundleV1(bundle: unknown): (input: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
  validateCreatedPortsV1(ports: unknown): Record<string, unknown>;
};
const { executeSingleRunDatabaseHarnessV1 } = require("../mcft_cap08_s6_single_run_db/harness_v1.cjs") as {
  executeSingleRunDatabaseHarnessV1(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const exactSubjectSha = String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA ?? "").trim();
const runLabel = String(process.env.MCFT_CAP08_RUN_LABEL ?? "").trim();
const operationalRunInstanceId = String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID ?? "").trim();
const authorityPath = String(process.env.MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY ?? "").trim();
if (!authorityPath) throw new Error("NORMALIZED_EXECUTION_AUTHORITY_REQUIRED");
const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), "utf8")) as Record<string, any>;
const validated = validateExecutionAuthorityV1(authority, { exactSubjectSha, runLabel, operationalRunInstanceId });
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(), exactSubjectSha, "EXECUTION_SUBJECT_CHECKOUT");
assert.equal(execFileSync("git", ["rev-parse", `HEAD:${validated.module_path}`], { cwd: ROOT, encoding: "utf8" }).trim(), authority.port_bundle_blob_sha, "PORT_BUNDLE_BLOB_DRIFT");
assert.equal(execFileSync("git", ["rev-parse", "HEAD:.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml"], { cwd: ROOT, encoding: "utf8" }).trim(), authority.workflow_blob_sha, "WORKFLOW_BLOB_DRIFT");
const imported = await import(pathToFileURL(path.join(ROOT, validated.module_path)).href);
const createPortsV1 = validatePortBundleV1(imported);
const ports = validateCreatedPortsV1(await createPortsV1({ authority, exactSubjectSha, runLabel, operationalRunInstanceId, root: ROOT }));
const result = await executeSingleRunDatabaseHarnessV1({ input: { exactSubjectSha, runLabel, operationalRunInstanceId }, ports, executionAuthority: authority });
const out = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${runLabel}_DATABASE_EXECUTION_RESULT.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, run_label: runLabel, exact_subject_sha: exactSubjectSha }, null, 2));
