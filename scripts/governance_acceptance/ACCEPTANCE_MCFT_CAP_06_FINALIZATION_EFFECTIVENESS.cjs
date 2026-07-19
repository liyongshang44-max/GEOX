#!/usr/bin/env node
'use strict';
// Compatibility wrapper for the frozen MCFT-CAP-06 taskbook deliverable identity.
// Semantic authority remains scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs; this file adds no independent PASS logic.

const requiredPath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_FINALIZATION_EFFECTIVENESS.cjs";
const implementationAuthority = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs";

if (process.env.MCFT_CAP_06_COMPATIBILITY_DISCOVERY_ONLY === '1') {
  process.stdout.write(JSON.stringify({ status: 'PASS', required_path: requiredPath, implementation_authority: implementationAuthority, mode: 'COMPATIBILITY_WRAPPER' }) + '\n');
} else {
  require("./ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs");
}
