"use strict";
// Revocation-aware entrypoint. V1 is preserved byte-for-byte; this is not AM22 time-policy admission.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { assertArmNotRetired } = require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
try {
  const args = process.argv.slice(2);
  const requested = args.find(x => x.startsWith("--arm="));
  const armPath = path.resolve(requested?.slice(6) || path.join(os.homedir(),".geox/mcft-cap09/formal-v5/arm-v1.json"));
  assertArmNotRetired(JSON.parse(fs.readFileSync(armPath, "utf8")));
  execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V1.ts"), ...args], { cwd: path.resolve(__dirname, "../.."), stdio: "inherit" });
} catch (error) {
  console.error(/^FORMAL_ARM_[A-Z_]+$/.test(error.message) ? error.message : "FORMAL_V5_REVOCATION_AWARE_ENTRYPOINT_REJECTED");
  process.exitCode = 1;
}
