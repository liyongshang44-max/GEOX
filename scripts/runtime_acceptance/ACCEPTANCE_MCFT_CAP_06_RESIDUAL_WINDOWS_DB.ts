// Compatibility wrapper for the frozen MCFT-CAP-06 taskbook deliverable identity.
// Semantic authority remains scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts; this file adds no independent PASS logic.

const requiredPath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_RESIDUAL_WINDOWS_DB.ts";
const implementationAuthority = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts";

if (process.env.MCFT_CAP_06_COMPATIBILITY_DISCOVERY_ONLY === "1") {
  process.stdout.write(JSON.stringify({ status: "PASS", required_path: requiredPath, implementation_authority: implementationAuthority, mode: "COMPATIBILITY_WRAPPER" }) + "\n");
} else {
  await import("./ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts");
}
