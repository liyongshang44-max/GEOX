#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = false;
function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`[customer-pr18h-routes] missing: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}
function must(scope, text, required) {
  for (const item of required) if (!text.includes(item)) {
    console.error(`[customer-pr18h-routes] ${scope} missing: ${item}`);
    failed = true;
  }
}
function token(parts) { return parts.join(''); }
function forbiddenTokens() {
  return [
    ['LIM','ITED'], ['AVAIL','ABLE'], ['PEND','ING'], ['UNAVAIL','ABLE'],
    ['STATE_','FALLBACK_','LIMITED'], ['OFFICIAL_','CUSTOMER_','API'],
    ['PENDING_','ACCEPTANCE'], ['soil_','moisture_','below_','threshold'], ['no_','rain_','forecast'], ['BLO','CKED'],
    ['admin','/internal preview'], ['field','.geometry'], ['geometry','_id'], ['Field ','Memory']
  ].map(token);
}
function forbid(scope, text) {
  for (const item of forbiddenTokens()) if (text.includes(item)) {
    console.error(`[customer-pr18h-routes] ${scope} leaked: ${item}`);
    failed = true;
  }
}
function section(text, route) {
  const start = text.indexOf(`## ${route}`);
  if (start < 0) return '';
  const next = text.indexOf('\n## ', start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
}
const reportCenter = read('apps/web/src/api/customerReportsCenter.ts') + read('apps/web/src/viewmodels/customerReportsCenterVm.ts') + read('apps/web/src/views/CustomerReportsCenterPage.tsx');
must('reports center', reportCenter, ['data_trust_text', 'trustText', 'sanitizeCustomerText', 'customerSemanticLabel', '有限记录', '受控试点预览数据', '数据可信级别：', '状态：', '更新时间：']);
forbid('reports center source', reportCenter);
const customerPages = [
  'apps/web/src/views/CustomerDashboardPage.tsx',
  'apps/web/src/views/CustomerReportsCenterPage.tsx',
  'apps/web/src/views/CustomerFieldsIndexPage.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/views/CustomerOperationsIndexPage.tsx',
  'apps/web/src/views/OperationReportPage.tsx',
  'apps/web/src/components/customer/CustomerExportBlocks.tsx',
  'apps/web/src/components/customer/FieldMemoryPanel.tsx',
  'apps/web/src/viewmodels/customerFieldMemoryVm.ts',
  'apps/web/src/lib/customerSafeText.ts',
];
for (const file of customerPages) forbid(file, read(file));
must('export sections', read('apps/web/src/components/customer/CustomerExportBlocks.tsx'), ['1. 本期摘要','2. 主要风险','3. 待处理事项','4. 作业进展','5. 设备状态','6. 证据与验收','7. 价值记录','8. 附注：哪些结论尚待复核']);
must('formal memory wording', read('apps/web/src/components/customer/FieldMemoryPanel.tsx') + read('apps/web/src/viewmodels/customerFieldMemoryVm.ts'), ['暂无正式田块记忆','正式验收通过后形成客户可见的田块学习结论','isCustomerVisibleFormalMemory']);
const audit = path.join(ROOT, 'docs/audit/FRONTEND_RUNTIME_PAGE_AUDIT_REPORT.md');
if (fs.existsSync(audit)) {
  const report = fs.readFileSync(audit, 'utf8');
  const routes = ['/customer/dashboard','/customer/reports','/customer/export','/customer/fields','/customer/fields/field_c8_demo','/customer/operations','/customer/operations/op_plan_c8_irrigation_formal_001','/customer/operations/op_plan_c8_irrigation_pending_001'];
  const text = routes.map((r) => section(report, r)).join('\n');
  forbid('runtime customer routes', text);
  must('runtime customer routes', text, ['状态：', '更新时间：']);
}
if (failed) {
  console.error('[customer-pr18h-routes] FAIL');
  process.exit(1);
}
console.log('[customer-pr18h-routes] PASS');
