// Fixture-only negative acceptance for ControlRuleSet v0 admission.
//
// Contract: this test suite must NOT imply any runtime loading semantics.

import fs from "node:fs";
import path from "node:path";

import { validateControlRuleSetV0 } from "../ruleset/control_ruleset_v0_validator";

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .map((n) => path.join(dir, n))
    .sort();
}

function readJson(file: string): unknown {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as unknown;
}

function expectOk(name: string, obj: unknown): void {
  validateControlRuleSetV0(obj);
  console.log(`[OK] ${name}`);
}

function expectFail(name: string, obj: unknown): void {
  try {
    validateControlRuleSetV0(obj);
  } catch (e) {
    console.log(`[FAIL-AS-EXPECTED] ${name}: ${(e as Error).message}`);
    return;
  }
  throw new Error(`expected fail but passed: ${name}`);
}

// NOTE: fixtures are scoped under packages/control-constitution-validator/fixtures
// and must stay fixture-only.
const fixturesDir = path.resolve(__dirname, "../../fixtures/rulesets_v0");

for (const f of listJsonFiles(fixturesDir)) {
  const name = path.basename(f);
  const obj = readJson(f);

  if (name.startsWith("ruleset_ok_")) expectOk(name, obj);
  else if (name.startsWith("ruleset_bad_")) expectFail(name, obj);
  else throw new Error(`unexpected fixture filename (must be ruleset_ok_* or ruleset_bad_*): ${name}`);
}
