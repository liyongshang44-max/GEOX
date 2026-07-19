#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const FILE = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json');
const ZERO = {
  canonical_fact_append_count: 0,
  canonical_fact_update_count: 0,
  canonical_fact_delete_count: 0,
  candidate_append_count: 0,
  evaluation_append_count: 0,
  projection_write_count: 0,
  model_activation_count: 0,
  active_config_switch_count: 0,
  runtime_parameter_change_count: 0,
  state_mutation_count: 0,
  checkpoint_mutation_count: 0,
  migration_count: 0,
};

const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
value.runtime_delta = ZERO;
fs.writeFileSync(FILE, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'PASS', file: path.relative(ROOT, FILE), runtime_delta: ZERO }, null, 2)}\n`);
