import fs from "node:fs";
import path from "node:path";

export function requireEffectiveAm22StartPolicyV2(): void {
  const policy=JSON.parse(fs.readFileSync(path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json"),"utf8"));
  if(policy.schema_version!=="geox_mcft_cap09_am22_effective_start_authority_v2"
    || policy.status!=="EFFECTIVE_ON_PROTECTED_MAIN"
    || policy.production_start_authorized!==true
    || policy.complete_pre_a0_measurement_qualified!==true
    || policy.new_handoff_arm_a0_chain_qualified!==true
    || policy.isolated_postgres_v2_a0_o00_qualified!==true) {
    throw new Error("AM22_EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED");
  }
}
