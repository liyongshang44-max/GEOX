#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const cards = read('apps/web/src/components/customer/FormalScenarioCards.tsx');
const page = read('apps/web/src/views/OperationReportPage.tsx');
const has = (src, s) => src.includes(s);

const checks = {
  operation_report_page_renders_fail_safe_notice: has(page, '<FailSafeCustomerNotice data={report} />'),
  card_renders_anomaly_type: has(cards, '异常类型'),
  card_renders_impact_scope: has(cards, '影响范围'),
  card_renders_system_block_reason: has(cards, '系统阻断'),
  card_renders_missing_evidence: has(cards, '缺少证据'),
  card_renders_manual_takeover: has(cards, '人工接管'),
  card_renders_fail_safe: has(cards, 'Fail-safe'),
  card_renders_customer_next_action: has(cards, '客户下一步'),
  card_blocks_success_claim: has(cards, '不展示') && has(cards, '执行成功'),
  card_blocks_roi_claim: has(cards, '不展示 ROI'),
  card_blocks_field_memory_claim: has(cards, '不生成对客 Field Memory'),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
