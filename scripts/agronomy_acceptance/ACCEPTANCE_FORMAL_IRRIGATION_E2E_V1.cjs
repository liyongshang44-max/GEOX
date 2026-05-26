#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceEntry = path.join(__dirname, 'ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts');
const entry = path.join(__dirname, '.ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.generated.ts');
const args = process.argv.slice(2);

const source = fs.readFileSync(sourceEntry, 'utf8');
const marker = "logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${command_id}` }]";
const replacement = "logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${command_id}` }, { kind: 'water_delivery_receipt', ref: `water_delivery_receipt://${ctx.fixture.device_id}/${command_id}/water_l_360` }, { kind: 'coverage_evidence', ref: `coverage_evidence://${ctx.fixture.field_id}/${command_id}/coverage_percent_0.96` }, { kind: 'effect_observation_soil_moisture_delta', ref: `effect_observation://${ctx.fixture.device_id}/${command_id}/soil_moisture_delta_0.07` }]";

if (!source.includes(marker)) {
  console.error('[formal-irrigation-wrapper] expected positive receipt marker not found');
  process.exit(1);
}

fs.writeFileSync(entry, source.replace(marker, replacement), 'utf8');
const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'tsx', entry, ...args],
  { stdio: 'inherit', cwd: process.cwd(), env: process.env },
);
try { fs.rmSync(entry, { force: true }); } catch {}
process.exit(result.status ?? 1);
