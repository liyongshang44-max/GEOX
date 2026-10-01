#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const out = execFileSync(
  process.execPath,
  ['scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_MIGRATION_V4.cjs'],
  { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);

process.stdout.write(out);
