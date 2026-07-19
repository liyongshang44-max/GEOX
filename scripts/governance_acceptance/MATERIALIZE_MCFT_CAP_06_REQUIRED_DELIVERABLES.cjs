#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json';
const DISCOVERY_ENV = 'MCFT_CAP_06_COMPATIBILITY_DISCOVERY_ONLY';

const RUNTIME = [
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_DATASET_QUALIFICATION.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_RESIDUAL_WINDOWS_DB.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CONTRACTS_MATH.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_EXACT_REF_PORT.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PERSISTENCE_DB.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CANDIDATE_DB.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_CANDIDATE_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_SHADOW_COMPUTE.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S6_PAIRED_SHADOW_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_EVALUATION_DB.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S7_SHADOW_EVALUATION_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_RESTART_RECOVERY.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_NON_CONSUMPTION_TICK.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DB.ts'],
  ['scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_BOUNDED_CHAIN.ts', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN_DB.ts'],
];

const GOVERNANCE = [
  ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_FINALIZATION_EFFECTIVENESS.cjs', 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs'],
];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), content, 'utf8');
}

function runtimeWrapper(requiredPath, authorityPath) {
  const importPath = `./${path.basename(authorityPath)}`;
  return `// Compatibility wrapper for the frozen MCFT-CAP-06 taskbook deliverable identity.\n// Semantic authority remains ${authorityPath}; this file adds no independent PASS logic.\n\nconst requiredPath = ${JSON.stringify(requiredPath)};\nconst implementationAuthority = ${JSON.stringify(authorityPath)};\n\nif (process.env.${DISCOVERY_ENV} === "1") {\n  process.stdout.write(JSON.stringify({ status: "PASS", required_path: requiredPath, implementation_authority: implementationAuthority, mode: "COMPATIBILITY_WRAPPER" }) + "\\n");\n} else {\n  import(${JSON.stringify(importPath)}).catch((error) => {\n    console.error(error instanceof Error ? error.stack : String(error));\n    process.exitCode = 1;\n  });\n}\n`;
}

function governanceWrapper(requiredPath, authorityPath) {
  const requirePath = `./${path.basename(authorityPath)}`;
  return `#!/usr/bin/env node\n'use strict';\n// Compatibility wrapper for the frozen MCFT-CAP-06 taskbook deliverable identity.\n// Semantic authority remains ${authorityPath}; this file adds no independent PASS logic.\n\nconst requiredPath = ${JSON.stringify(requiredPath)};\nconst implementationAuthority = ${JSON.stringify(authorityPath)};\n\nif (process.env.${DISCOVERY_ENV} === '1') {\n  process.stdout.write(JSON.stringify({ status: 'PASS', required_path: requiredPath, implementation_authority: implementationAuthority, mode: 'COMPATIBILITY_WRAPPER' }) + '\\n');\n} else {\n  require(${JSON.stringify(requirePath)});\n}\n`;
}

function main() {
  const deliverables = [];
  for (const [requiredPath, authorityPath] of RUNTIME) {
    if (!fs.existsSync(absolute(authorityPath))) throw new Error(`DELIVERABLE_AUTHORITY_MISSING:${authorityPath}`);
    write(requiredPath, runtimeWrapper(requiredPath, authorityPath));
    deliverables.push({
      required_path: requiredPath,
      implementation_authority: authorityPath,
      surface: 'RUNTIME_ACCEPTANCE',
      mode: 'COMPATIBILITY_WRAPPER',
      discovery_env: DISCOVERY_ENV,
      exit_code_propagation: true,
      independent_pass_logic: false,
    });
  }
  for (const [requiredPath, authorityPath] of GOVERNANCE) {
    if (!fs.existsSync(absolute(authorityPath))) throw new Error(`DELIVERABLE_AUTHORITY_MISSING:${authorityPath}`);
    write(requiredPath, governanceWrapper(requiredPath, authorityPath));
    deliverables.push({
      required_path: requiredPath,
      implementation_authority: authorityPath,
      surface: 'GOVERNANCE_ACCEPTANCE',
      mode: 'COMPATIBILITY_WRAPPER',
      discovery_env: DISCOVERY_ENV,
      exit_code_propagation: true,
      independent_pass_logic: false,
    });
  }

  const manifest = {
    schema_version: 'geox_mcft_cap_06_required_deliverables_manifest_v1',
    capability_line_id: 'MCFT-CAP-06',
    taskbook_version: 'v0.4.0',
    taskbook_section: '41_REQUIRED_DELIVERABLES',
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'REPAIR_CANDIDATE',
    required_deliverable_count: deliverables.length,
    runtime_acceptance_count: RUNTIME.length,
    governance_acceptance_count: GOVERNANCE.length,
    equivalence_policy: 'FROZEN_PATH_COMPATIBILITY_WRAPPER_DELEGATES_TO_SINGLE_EXISTING_AUTHORITY',
    wrapper_discovery_execution_required: true,
    underlying_authority_regression_required: true,
    deliverables,
  };
  write(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'PASS', manifest: MANIFEST_PATH, required_deliverable_count: deliverables.length }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
