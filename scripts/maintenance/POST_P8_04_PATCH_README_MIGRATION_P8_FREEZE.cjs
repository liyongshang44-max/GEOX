// scripts/maintenance/POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE.cjs
// Purpose: append the P8 freeze snapshot to README_MIGRATION.md without rewriting existing freeze history.
// Boundary: modifies README_MIGRATION.md only; does not touch runtime, frontend, database, package, or CI files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const TARGET = 'README_MIGRATION.md';
const MARKER = '## GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot';
const BLOCK = `

---

${MARKER}

Key anchors:

- Branch: main
- PR: #2146
- Completion tag: p8_real_evidence_closed_loop_demo_completion
- Main merge tag: p8_real_evidence_closed_loop_demo_main_merge
- Completion commit: 3441fc7157741a80800aec69e54c680a862e111b
- Main merge commit: 36fbe07528af7ace9c04d087e21f87491e30633e

Frozen scope:

- P8 real evidence closed-loop replay demo
- Real raw_samples evidence window
- Real soil moisture state estimate
- Real soil moisture prediction run
- Real actual holdout observation window
- Backtest error report
- Calibration candidate report
- Product replay demo report

P8 fixed replay scope:

- problem = soil_moisture_state_estimation
- project_id = P_DEFAULT
- sensor_group_id = G_CAF
- sensor_id = CAF009
- metric_kind = soil_moisture
- history_window = 2009-06-09T00:00:00.000Z -> 2009-06-09T04:00:00.000Z
- prediction_window = 2009-06-09T05:00:00.000Z -> 2009-06-09T07:00:00.000Z
- actual_window = 2009-06-09T05:00:00.000Z -> 2009-06-09T07:00:00.000Z
- expected_interval_ms = 3600000

Acceptance:

- node scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs

Hard boundaries:

- P8 replay runtime is read-only
- No database write by replay runtime
- No fact write
- No Field Memory write
- No model write or automatic learning loop
- No execution object
- No AO-ACT task
- No dispatch
- No receipt
- No server route
- No frontend authority
- Prediction is not authorization
- Calibration candidate is not model update

Related post-merge convergence:

- docs/REPOSITORY_HANDOFF_MAP.md
- docs/twin_kernel/README.md
- docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md
`;

function abs(file) {
  return path.resolve(ROOT, file);
}

try {
  const targetPath = abs(TARGET);
  if (!fs.existsSync(targetPath)) throw new Error(`MISSING_FILE:${TARGET}`);
  const current = fs.readFileSync(targetPath, 'utf8');
  if (current.includes(MARKER)) {
    console.log(JSON.stringify({ ok: true, action: 'POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE', changed: false, note: 'P8 freeze snapshot already present' }, null, 2));
    process.exit(0);
  }
  const next = `${current.replace(/\s*$/, '')}${BLOCK}\n`;
  fs.writeFileSync(targetPath, next, 'utf8');
  console.log(JSON.stringify({ ok: true, action: 'POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE', changed: true, target: TARGET }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, action: 'POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE', error: error.message }, null, 2));
  process.exit(1);
}
