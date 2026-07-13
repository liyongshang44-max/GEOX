// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S7_ACTIVATION.cjs
// Purpose: verify S6 merged-main effectiveness and the exact governance-only activation of the S7 24-tick range implementation boundary.
// Boundary: governance verification only; no Runtime source, database mutation, route, scheduler, recommendation, decision, or field claim.

'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'ea9ddfeeda88a3bb0a3b8abd3b821b8a3965dac3';
const BRANCH = 'agent/mcft-cap-04-s7-activation-v1';
const S7 = 'MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1';
const FILES = ["docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S7_ACTIVATION.cjs"];
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const run = (exe, args) => {
  const r = cp.spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${exe} ${args.join(' ')}\n${r.stdout || ''}\n${r.stderr || ''}`);
  return String(r.stdout || '').trim();
};
const git = (args) => run(process.platform === 'win32' ? 'git.exe' : 'git', args);
let pass = 0; let fail = 0;
const check = (value, message) => value ? (pass++, console.log(`PASS ${message}`)) : (fail++, console.error(`FAIL ${message}`));
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const s6 = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json');
const s7 = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const auth = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((x) => x.capability_line_id === 'MCFT-CAP-04');
check(s6.status === 'MERGED_EFFECTIVE' && s6.effectiveness_condition_satisfied === true, 'S6 merged effective');
check(s6.merge_evidence.merge_commit === BASELINE, 'S6 merge commit exact');
check(s6.merge_evidence.postmerge_workflow_run === 29245469293 && s6.merge_evidence.postmerge_gate === 'PASS', 'S6 postmerge evidence exact');
check(s7.status === 'IMPLEMENTATION_AUTHORIZED' && s7.runtime_source_authorized === true, 'S7 implementation authorized');
check(s7.baseline_main_commit === BASELINE && s7.branch === 'agent/mcft-cap-04-s7-twenty-four-tick-range-v1', 'S7 activation identity exact');
check(s7.target_contract.logical_tick_count === 24 && s7.target_contract.forecast_point_count === 1728 && s7.target_contract.scenario_point_count === 5184, 'S7 cardinalities exact');
check(s7.target_contract.checkpoint_sequence_start === 49 && s7.target_contract.checkpoint_sequence_end === 72, 'S7 checkpoint range exact');
check(s7.target_contract.closure_fixture_allows_a2 === false, 'S7 closure fixture forbids A2');
check(delivery.status === 'S7_IMPLEMENTATION_AUTHORIZED' && delivery.active_delivery_slice_id === S7, 'delivery active S7');
check(auth.active_delivery_slice_id === S7 && auth.repository_write_scope === 'S7_TWENTY_FOUR_TICK_RANGE_ONLY', 'authorization scope S7 exact');
check(cap04.active_delivery_slice_id === S7 && cap04.implementation_status === 'S7_IMPLEMENTATION_AUTHORIZED', 'matrix active S7');
check(same(s7.activation_pr_changed_file_boundary, FILES), 'activation boundary frozen');
const changed = [...new Set([
  git(['diff', '--name-only', BASELINE]),
  git(['ls-files', '--others', '--exclude-standard']),
].filter(Boolean).flatMap((x) => x.split(/\r?\n/).filter(Boolean)))].sort();
check(same(changed, FILES), 'activation changed-file boundary exact');
check(changed.every((f) => f.startsWith('docs/') || f.startsWith('scripts/governance_acceptance/')), 'activation is governance only');
check(git(['branch', '--show-current']) === BRANCH, 'activation Gate branch exact');
check(git(['rev-parse', 'origin/main']) === BASELINE, 'origin/main baseline exact');
try { git(['diff', '--check', BASELINE]); check(true, 'git diff --check PASS'); } catch { check(false, 'git diff --check PASS'); }
console.log(`MCFT-CAP-04 S7 activation: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
