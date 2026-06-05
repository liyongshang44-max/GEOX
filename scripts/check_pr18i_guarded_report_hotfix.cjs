#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'apps/server/src/projections/guarded_report_v1.ts');
const source = fs.readFileSync(target, 'utf8');

function fail(message, detail) {
  console.error('[pr18i-guarded-report-hotfix] FAIL:', message);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

function count(pattern) {
  return [...source.matchAll(pattern)].length;
}

const formalAcceptanceHelperCount = count(/function\s+formalAcceptanceId\s*\(/g);
if (formalAcceptanceHelperCount !== 1) {
  fail('formalAcceptanceId() must be defined exactly once', `found=${formalAcceptanceHelperCount}`);
}

const collectRoiItemsCount = count(/function\s+collectRoiItems\s*\(/g);
if (collectRoiItemsCount !== 1) {
  fail('collectRoiItems() must be defined exactly once', `found=${collectRoiItemsCount}`);
}

const formalGateMatch = source.match(/export\s+function\s+isFormalCustomerValueItem\s*\([^)]*\)\s*:\s*boolean\s*{([\s\S]*?)\n}/);
if (!formalGateMatch) {
  fail('isFormalCustomerValueItem() export was not found');
}

const formalGateBody = formalGateMatch[1];
const requiredGateClauses = [
  'item?.customer_visible_value === true',
  'item?.trust_level === "FORMAL_ACCEPTED"',
  'item?.source_lane === "FORMAL_ACCEPTANCE"',
  'formalAcceptanceId(item) != null',
  'item?.formal_evidence_passed === true',
  'item?.chain_validation_passed === true',
];

for (const clause of requiredGateClauses) {
  if (!formalGateBody.includes(clause)) {
    fail('isFormalCustomerValueItem() is missing a required formal gate clause', clause);
  }
}

const forbiddenPatterns = [
  { name: 'governance marker', pattern: /governance\s+marker/i },
  { name: 'Boolean(item?.formal_acceptance_id)', pattern: /Boolean\(\s*item\?\.formal_acceptance_id\s*\)/ },
  { name: 'customer_visible_eligible shortcut', pattern: /__report_trust\?\.customer_visible_eligible\s*===\s*true/ },
  { name: 'op_plan string guessing', pattern: /JSON\.stringify\([\s\S]*?\.includes\(\s*["']op_plan_/ },
];

for (const forbidden of forbiddenPatterns) {
  if (forbidden.pattern.test(source)) {
    fail(`forbidden low-quality formal gate pattern found: ${forbidden.name}`);
  }
}

console.log('[pr18i-guarded-report-hotfix] PASS', {
  target: 'apps/server/src/projections/guarded_report_v1.ts',
  formalAcceptanceHelperCount,
  collectRoiItemsCount,
  requiredGateClauses: requiredGateClauses.length,
});
