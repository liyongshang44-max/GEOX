#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const checkedFiles = [
  'apps/web/src/views/CustomerDashboardPage.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/components/customer/FormalScenarioCards.tsx',
  'apps/web/src/components/cockpit/RecentOperationsSection.tsx',
  'apps/web/src/components/cockpit/CockpitKpiCard.tsx',
  'apps/web/src/components/cockpit/CockpitActionCard.tsx',
  'apps/web/src/components/cockpit/DeviceHealthCard.tsx',
  'apps/web/src/components/cockpit/ValueResultPanel.tsx',
];

function rawToken(...parts) {
  return parts.join('_');
}

const banned = [
  ['guarded payload', /guarded\s+payload/i],
  ['needs_review rendered assignment', /needs_review\s*[=:：]/i],
  ['scenario_type', new RegExp(rawToken('scenario', 'type'), 'i')],
  ['formal_chain_status', new RegExp(rawToken('formal', 'chain', 'status'), 'i')],
  ['evidence_status', new RegExp(rawToken('evidence', 'status'), 'i')],
  ['global_devices_count', new RegExp(rawToken('global', 'devices', 'count'), 'i')],
  ['visible_devices_count', new RegExp(rawToken('visible', 'devices', 'count'), 'i')],
  ['field_devices_count', new RegExp(rawToken('field', 'devices', 'count'), 'i')],
  ['offline_devices_count', new RegExp(rawToken('offline', 'devices', 'count'), 'i')],
  ['alert_events_count', new RegExp(rawToken('alert', 'events', 'count'), 'i')],
  ['ROI trust lane', /ROI\s+trust\s+lane/i],
  ['Field Memory trust lane', /Field\s+Memory\s+trust\s+lane/i],
  ['closure chain', /closure\s+chain/i],
  ['Fail-safe', /Fail-safe/i],
];

const requiredProductLanguageUsages = [
  'apps/web/src/components/customer/FormalScenarioCards.tsx',
  'apps/web/src/components/cockpit/RecentOperationsSection.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/components/cockpit/CockpitKpiCard.tsx',
  'apps/web/src/components/cockpit/CockpitActionCard.tsx',
  'apps/web/src/components/cockpit/DeviceHealthCard.tsx',
  'apps/web/src/components/cockpit/ValueResultPanel.tsx',
];

let failed = false;

for (const rel of checkedFiles) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`[customer-product-language] missing checked file: ${rel}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of banned) {
    if (pattern.test(text)) {
      console.error(`[customer-product-language] customer-facing technical language leaked: ${label} in ${rel}`);
      failed = true;
    }
  }
}

for (const rel of requiredProductLanguageUsages) {
  const file = path.join(ROOT, rel);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!/customerProductText|customerReviewStateText|customerClosureStepLabel/.test(text)) {
    console.error(`[customer-product-language] missing product-language adapter usage in ${rel}`);
    failed = true;
  }
}

if (failed) {
  console.error('[customer-product-language] FAIL');
  process.exit(1);
}

console.log('[customer-product-language] PASS');
