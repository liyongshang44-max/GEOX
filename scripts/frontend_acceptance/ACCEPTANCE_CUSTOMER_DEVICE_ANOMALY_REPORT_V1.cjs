#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const cards = read('apps/web/src/components/customer/FormalScenarioCards.tsx');
const labels = read('apps/web/src/lib/customerScenarioLabels.ts');
const has = (src, s) => src.includes(s);
const u = (...codes) => String.fromCharCode(...codes);
const checks = {
  label_device_anomaly: has(labels, 'DEVICE_ANOMALY'),
  label_device_anomaly_cn: has(labels, u(35774,22791,24322,24120)),
  shows_type: has(cards, 'anomalyTypeText'),
  shows_scope: has(cards, 'impactText'),
  shows_missing_evidence: has(cards, 'missingEvidenceText'),
  shows_fail_safe: has(cards, 'Fail-safe'),
  shows_manual_takeover: has(cards, u(20154,24037,25509,31649)),
  shows_next_action: has(cards, u(23458,25143,19979,19968,27493)),
  blocks_success_wording: has(cards, u(25191,34892,25104,21151)) && has(cards, u(19981,23637,31034)),
  hides_roi: has(cards, 'ROI') && has(cards, u(19981,23637,31034)),
  hides_field_memory: has(cards, 'Field Memory') && has(cards, u(19981,29983,25104)),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
