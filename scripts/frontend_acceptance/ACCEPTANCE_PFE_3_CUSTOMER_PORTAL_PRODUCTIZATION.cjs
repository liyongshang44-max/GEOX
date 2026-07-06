// scripts/frontend_acceptance/ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const required = [
  'docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-PRODUCTIZATION.md',
  'docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-SURFACE-REVIEW.md',
  'apps/web/src/features/customer/pages/CustomerDashboardPage.tsx',
  'apps/web/src/features/customer/pages/CustomerDashboardExportPage.tsx',
  'apps/web/src/views/CustomerFieldsIndexPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportPage.tsx',
  'apps/web/src/features/fields/pages/FieldReportExportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx',
  'apps/web/src/features/operations/pages/OperationReportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerReportExportPage.tsx',
  'apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx',
  'apps/web/src/styles.css',
  'apps/web/src/design-system/product/index.ts',
];
const assertions = [];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(name, ok, details = {}) { assertions.push({ name, passed: ok === true, details }); if (ok !== true) throw new Error(name); console.log('[pfe-3-customer-portal-productization] ok:', name); }
try {
  required.forEach((file) => assert('exists:' + file, fs.existsSync(path.join(root, file)), { file }));
  assert('product_css_imported', read('apps/web/src/styles.css').includes('./styles/productDesignSystem.css'));
  assert('dashboard_productized', read('apps/web/src/features/customer/pages/CustomerDashboardPage.tsx').includes('Reporting-only customer surface'));
  assert('fields_index_productized', read('apps/web/src/views/CustomerFieldsIndexPage.tsx').includes('Authorized field reports'));
  assert('field_report_productized', read('apps/web/src/features/fields/pages/FieldReportPage.tsx').includes('Customer-safe field report'));
  assert('field_export_productized', read('apps/web/src/features/fields/pages/FieldReportExportPage.tsx').includes('Print-safe customer delivery surface'));
  assert('operations_index_productized', read('apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx').includes('Operation reporting only'));
  assert('operation_report_productized', read('apps/web/src/features/operations/pages/OperationReportPage.tsx').includes('Customer-safe operation report'));
  assert('customer_export_productized', read('apps/web/src/features/customer/pages/CustomerReportExportPage.tsx').includes('Print-safe customer delivery surface'));
  assert('reports_center_productized', read('apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx').includes('Customer-safe report center'));
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION', scope: 'Customer Portal productization only', assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_3_CUSTOMER_PORTAL_PRODUCTIZATION', error: error.message, assertions }, null, 2));
  process.exit(1);
}
