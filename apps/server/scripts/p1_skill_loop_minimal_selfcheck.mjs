import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const target = path.resolve(process.cwd(), "apps/server/scripts/p1_skill_loop_minimal.mjs");
const source = fs.readFileSync(target, "utf8");

function count(pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function ensureUniqueFunction(name) {
  const n = count(new RegExp(`function\\s+${name}\\s*\\(`, "g"));
  assert.equal(n, 1, `function ${name} must be defined exactly once, got=${n}`);
}

ensureUniqueFunction("isSuccessMapped");
ensureUniqueFunction("resolveSuccessFinalStatus");
ensureUniqueFunction("buildMinimalDiagnostics");

const successSetLiteralCount = count(/\["PENDING_ACCEPTANCE",\s*"SUCCESS",\s*"SUCCEEDED",\s*"VALID"\]/g);
assert.equal(successSetLiteralCount, 1, `success status set literal should appear exactly once, got=${successSetLiteralCount}`);

const successSetConstCount = count(/const\s+SUCCESS_LANE_FINAL_STATUSES\s*=\s*Object\.freeze\(\["PENDING_ACCEPTANCE",\s*"SUCCESS",\s*"SUCCEEDED",\s*"VALID"\]\)/g);
assert.equal(successSetConstCount, 1, `SUCCESS_LANE_FINAL_STATUSES constant must exist exactly once, got=${successSetConstCount}`);

console.log("PASS p1_skill_loop_minimal_selfcheck", {
  target,
  checks: [
    "unique isSuccessMapped",
    "unique resolveSuccessFinalStatus",
    "unique buildMinimalDiagnostics",
    "single success-set literal",
    "single SUCCESS_LANE_FINAL_STATUSES constant",
  ],
});
