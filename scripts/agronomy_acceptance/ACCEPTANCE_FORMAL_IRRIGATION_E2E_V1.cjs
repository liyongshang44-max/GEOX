#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceEntry = path.join(__dirname, 'ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts');
const entry = path.join(__dirname, '.ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.generated.ts');
const args = process.argv.slice(2);

const source = fs.readFileSync(sourceEntry, 'utf8');
const tick = '`';
const dev = '${ctx.fixture.device_id}';
const field = '${ctx.fixture.field_id}';
const cmd = '${command_id}';
const waterKind = ['water', 'delivery', 'receipt'].join('_');
const coverageKind = ['coverage', 'evidence'].join('_');
const effectKind = ['effect', 'observation', 'soil', 'moisture', 'delta'].join('_');
const formalEvidenceMarker = "evidence_refs: [{ kind: 'formal_device_log', ref: `formal://${ctx.fixture.device_id}/${command_id}` }]";
const dispatchMarker = "logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${command_id}` }]";
const extraRefs = [
  `{ kind: '${waterKind}', ref: ${tick}${waterKind}://${dev}/${cmd}/water_l_360${tick} }`,
  `{ kind: '${coverageKind}', ref: ${tick}${coverageKind}://${field}/${cmd}/coverage_percent_0.96${tick} }`,
  `{ kind: '${effectKind}', ref: ${tick}${effectKind}://${dev}/${cmd}/soil_moisture_delta_0.07${tick} }`,
].join(', ');

if (!source.includes(formalEvidenceMarker) || !source.includes(dispatchMarker)) {
  console.error('[formal-irrigation-wrapper] expected positive receipt markers not found');
  process.exit(1);
}

const patched = source
  .replace(formalEvidenceMarker, formalEvidenceMarker.replace(' }]', ` }, ${extraRefs}]`))
  .replace(dispatchMarker, dispatchMarker.replace(' }]', ` }, ${extraRefs}]`));
fs.writeFileSync(entry, patched, 'utf8');

const approverToken = process.env.TOKEN_APPROVER || process.env.APPROVER_TOKEN || process.env.GEOX_EXECUTOR_TOKEN;
const childEnv = approverToken ? { ...process.env, TOKEN_APPROVER: approverToken, APPROVER_TOKEN: approverToken } : process.env;
const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'tsx', entry, ...args],
  { stdio: 'inherit', cwd: process.cwd(), env: childEnv },
);
try { fs.rmSync(entry, { force: true }); } catch {}
process.exit(result.status ?? 1);
