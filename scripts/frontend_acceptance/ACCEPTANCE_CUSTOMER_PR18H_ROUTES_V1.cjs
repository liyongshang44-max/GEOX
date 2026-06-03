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
const reports = read('apps/web/src/api/customerReportsCenter.ts') + read('apps/web/src/viewmodels/customerReportsCenterVm.ts') + read('apps/web/src/views/CustomerReportsCenterPage.tsx');
must('reports center hardening', reports, ['data_trust_text', 'trustText', 'sanitizeCustomerText', 'customerSemanticLabel', '有限记录', '受控试点预览数据', '数据可信级别：', '状态：', '更新时间：']);
if (/状态：\{item\.statusText\}\s*更新时间：/.test(reports)) {
  console.error('[customer-pr18h-routes] status and update time must be rendered separately');
  failed = true;
}
must('export sections', read('apps/web/src/components/customer/CustomerExportBlocks.tsx'), ['1. 本期摘要','2. 主要风险','3. 待处理事项','4. 作业进展','5. 设备状态','6. 证据与验收','7. 价值记录','8. 附注：哪些结论尚待复核']);
must('field memory copy', read('apps/web/src/components/customer/FieldMemoryPanel.tsx') + read('apps/web/src/viewmodels/customerFieldMemoryVm.ts'), ['暂无正式田块记忆','正式验收通过后形成客户可见的田块学习结论','isCustomerVisibleFormalMemory']);
must('safe text dictionary', read('apps/web/src/lib/customerSafeText.ts'), ['等待正式验收','土壤水分偏低','近期无降雨预报','暂不形成正式结论','需要人工复核','有限记录','证据待补充','证据已通过']);
const runtimeAudit = read('scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_RUNTIME_PAGE_AUDIT_V1.cjs');
must('runtime audit customer route coverage', runtimeAudit, ['/customer/dashboard','/customer/reports','/customer/export','/customer/fields/field_c8_demo','/customer/operations/op_plan_c8_irrigation_formal_001','/customer/operations/op_plan_c8_irrigation_pending_001']);
must('runtime audit customer raw gate', runtimeAudit, ['CUSTOMER_VISIBLE_RAW_PATTERNS', 'assertNoCustomerRawVisibleText']);
if (failed) {
  console.error('[customer-pr18h-routes] FAIL');
  process.exit(1);
}
console.log('[customer-pr18h-routes] PASS');
