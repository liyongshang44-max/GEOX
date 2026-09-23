const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, '.github/workflows/mcft-cap-09-v13-forcing-controller-contract.yml');
const text = fs.readFileSync(WORKFLOW, 'utf8');

function fail(code) {
  throw new Error(code);
}

const forbidden = [
  { pattern: /^\s*schedule\s*:/m, code: 'V13_CONTROLLER_WORKFLOW_SCHEDULE_FORBIDDEN' },
  { pattern: /^\s*workflow_dispatch\s*:/m, code: 'V13_CONTROLLER_WORKFLOW_DISPATCH_FORBIDDEN' },
  { pattern: /^\s*actions\s*:\s*write\s*$/m, code: 'V13_CONTROLLER_WORKFLOW_ACTIONS_WRITE_FORBIDDEN' },
  { pattern: /GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL/, code: 'V13_CONTROLLER_WORKFLOW_FORMAL_DB_SECRET_FORBIDDEN' },
  { pattern: /FORMAL_RAW_S3/, code: 'V13_CONTROLLER_WORKFLOW_FORMAL_RAW_SECRET_FORBIDDEN' },
  { pattern: /repository_dispatch/, code: 'V13_CONTROLLER_WORKFLOW_REPOSITORY_DISPATCH_FORBIDDEN' },
  { pattern: /workflow_run\s*:/, code: 'V13_CONTROLLER_WORKFLOW_WORKFLOW_RUN_FORBIDDEN' },
];
for (const rule of forbidden) {
  if (rule.pattern.test(text)) fail(rule.code);
}

if (!/^permissions:\n\s{2}contents:\s*read\s*$/m.test(text)) {
  fail('V13_CONTROLLER_WORKFLOW_CONTENTS_READ_ONLY_REQUIRED');
}
if (!/^on:\n\s{2}pull_request:/m.test(text)) {
  fail('V13_CONTROLLER_WORKFLOW_PULL_REQUEST_TRIGGER_REQUIRED');
}
if (!/^\s{2}merge_group:/m.test(text)) {
  fail('V13_CONTROLLER_WORKFLOW_MERGE_GROUP_TRIGGER_REQUIRED');
}
if (!/VALIDATE_MCFT_CAP_09_V13_FORCING_CONTROLLER_WORKFLOW\.cjs/.test(text)) {
  fail('V13_CONTROLLER_WORKFLOW_SELF_VALIDATOR_REQUIRED');
}

const result = {
  status: 'PASS',
  workflow: '.github/workflows/mcft-cap-09-v13-forcing-controller-contract.yml',
  pull_request_only_development_trigger: true,
  merge_group_validation_trigger: true,
  schedule_present: false,
  workflow_dispatch_present: false,
  workflow_run_present: false,
  repository_dispatch_present: false,
  actions_write_present: false,
  formal_database_secret_present: false,
  formal_raw_secret_present: false,
  production_wake_surface: false,
};
console.log(JSON.stringify(result, null, 2));
