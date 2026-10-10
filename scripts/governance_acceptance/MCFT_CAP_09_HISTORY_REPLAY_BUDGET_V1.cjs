"use strict";
// Engineering historical replay only. Never loaded by the qualification runner.
const assert = require("node:assert/strict");
const path = require("node:path");
const cp = require("node:child_process");
const TOTAL_MS = 20 * 60 * 1000;
const KEY = "MCFT_CAP09_HISTORY_DEADLINE_MS";
const VERIFIERS = new Set([
  "VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
  "VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
  "VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",
]);
function isVerifier(file) {
  return typeof file === "string" &&
    file.replace(/\\/g, "/").includes("scripts/governance_acceptance/") &&
    VERIFIERS.has(path.win32.basename(file));
}
function childOptions(command, args, options, deadline, now = Date.now()) {
  if (command !== process.execPath || !Array.isArray(args) || args.length !== 1 ||
      !isVerifier(args[0]) || options?.timeout !== 240000) return options;
  assert(Number.isSafeInteger(deadline) && deadline > now && deadline - now <= TOTAL_MS,
    "HISTORY_DEADLINE_INVALID_OR_EXPIRED");
  const remaining = deadline - now - 2000;
  assert(remaining > 0, "HISTORY_CLEANUP_BUDGET_EXHAUSTED");
  // Each enclosing call retains time to propagate errors and clean its clone.
  return {...options, timeout: remaining,
    env: {...(options.env || process.env), [KEY]: String(deadline - 2000)}};
}
function historicalEnvironment(helperPath, now = Date.now(), env = process.env) {
  assert(!env.NODE_OPTIONS && !env[KEY], "HISTORY_EXTERNAL_PROCESS_OVERRIDE_FORBIDDEN");
  return {...env, [KEY]: String(now + TOTAL_MS),
    NODE_OPTIONS: '--require="' + helperPath.replace(/\\/g, "/") + '"'};
}
if (process.env[KEY] && isVerifier(process.argv[1])) {
  const deadline = Number(process.env[KEY]);
  const original = cp.execFileSync;
  cp.execFileSync = function(command, args, options) {
    return original.call(this, command, args, childOptions(command, args, options, deadline));
  };
}
module.exports = {TOTAL_MS, KEY, VERIFIERS, isVerifier, childOptions, historicalEnvironment};
