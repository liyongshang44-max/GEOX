#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); console.log('[pui] ok:', msg); };
const customer = read('apps/web/src/viewmodels/customerReportMainVisualVm.ts');
const summary = read('apps/web/src/features/customer/components/CustomerConfirmedTwinSummaryCard.tsx');
const learning = read('apps/web/src/viewmodels/operatorLearningClosureVm.ts');
assert(customer.includes('正式报告尚未形成'), 'customer fallback language');
assert(customer.includes('建议记录'), 'recommendation label');
assert(customer.includes('处方记录'), 'prescription label');
assert(customer.includes('执行记录'), 'execution label');
assert(customer.includes('验收记录'), 'acceptance label');
assert(customer.includes('价值记录'), 'value label');
assert(customer.includes('田块记忆'), 'field memory label');
assert(summary.includes('customerReason(summary?.reason)'), 'summary reason mapper');
assert(learning.includes('请选择作业查看学习闭环'), 'operator learning empty state');
console.log('[pui] PASS');
