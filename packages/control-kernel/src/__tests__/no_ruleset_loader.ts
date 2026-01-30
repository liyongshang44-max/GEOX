// Negative acceptance: @geox/control-kernel must not expose any runtime ruleset loader.
//
// This enforces the "fixture-only" constraint: ruleset assets must NOT be discoverable
// by scanning the repo at runtime in this phase.

import assert from "node:assert";

import * as pkg from "../index";

const forbiddenNamePatterns: RegExp[] = [
  /load.*ruleset/i,
  /read.*ruleset/i,
  /scan.*ruleset/i,
  /watch.*ruleset/i,
  /ruleset.*dir/i,
  /ruleset.*file/i,
  /ruleset.*path/i
];

for (const k of Object.keys(pkg)) {
  for (const re of forbiddenNamePatterns) {
    assert.ok(!re.test(k), `forbidden export found in @geox/control-kernel: ${k}`);
  }
}

console.log("control-kernel negative acceptance ok: no runtime ruleset loader exports");
