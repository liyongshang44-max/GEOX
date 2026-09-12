import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
const SOURCE = path.resolve(SOURCE_PATH);
const GENERATED = path.resolve("scripts/runtime_acceptance/.generated_RUN_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts");
const SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9";
const SOURCE_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3";
const TARGET_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4";
const SOURCE_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3";
const TARGET_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function exactReplaceCount(source: string, oldValue: string, newValue: string, expectedCount: number, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, expectedCount, `${code}:${count}`);
  return source.split(oldValue).join(newValue);
}

function buildCompatibilitySubject(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "AM19_PHASE2_HISTORICAL_RUNNER_BLOB_DRIFT");
  let generated = fs.readFileSync(SOURCE, "utf8");
  generated = exactReplaceCount(
    generated,
    SOURCE_AUTHORITY_BLOB_SYMBOL,
    TARGET_AUTHORITY_BLOB_SYMBOL,
    2,
    "AM19_PHASE2_AUTHORITY_BLOB_SYMBOL_REPLACEMENT_CARDINALITY",
  );
  generated = exactReplaceCount(
    generated,
    SOURCE_AUTHORITY_REF_SYMBOL,
    TARGET_AUTHORITY_REF_SYMBOL,
    2,
    "AM19_PHASE2_AUTHORITY_REF_SYMBOL_REPLACEMENT_CARDINALITY",
  );
  assert(!generated.includes(SOURCE_AUTHORITY_BLOB_SYMBOL), "AM19_PHASE2_V3_AUTHORITY_BLOB_SYMBOL_SURVIVED");
  assert(!generated.includes(SOURCE_AUTHORITY_REF_SYMBOL), "AM19_PHASE2_V3_AUTHORITY_REF_SYMBOL_SURVIVED");
  assert.equal(generated.split(TARGET_AUTHORITY_BLOB_SYMBOL).length - 1, 2, "AM19_PHASE2_V4_AUTHORITY_BLOB_SYMBOL_REQUIRED");
  assert.equal(generated.split(TARGET_AUTHORITY_REF_SYMBOL).length - 1, 2, "AM19_PHASE2_V4_AUTHORITY_REF_SYMBOL_REQUIRED");
  return generated;
}

function cleanup(): void {
  try { fs.unlinkSync(GENERATED); } catch {}
}

function selftest(): void {
  fs.writeFileSync(GENERATED, buildCompatibilitySubject());
  try {
    execFileSync("pnpm", [
      "exec", "tsc", "--noEmit", "--pretty", "false", "--skipLibCheck",
      "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
      "--esModuleInterop", "--types", "node", GENERATED,
    ], { stdio: "inherit", env: process.env });
    execFileSync("pnpm", ["exec", "tsx", GENERATED, "selftest"], { stdio: "inherit", env: process.env });
    console.log(JSON.stringify({
      status: "PASS",
      schema_version: "geox_mcft_cap09_am19_phase2_authority_symbol_compatibility_v1",
      historical_runner_blob: SOURCE_BLOB,
      generated_file_committed: false,
      authority_ref_symbol_replacement_count: 2,
      authority_blob_symbol_replacement_count: 2,
      database_identity_changed: false,
      candidate_gate_changed: false,
      persistence_semantics_changed: false,
      provider_access: false,
      database_access: false,
      production_workflow_activation: false,
      formal_database_mutation: false,
      graduation_effect: false,
      mcft_cap09_completed: false,
    }));
  } finally {
    cleanup();
  }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") selftest();
else throw new Error("AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_MODE_REQUIRED");
