#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = {
  vm: 'apps/web/src/viewmodels/operatorApprovalsVm.ts',
  page: 'apps/web/src/views/operator/OperatorApprovalsPage.tsx',
};

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function assertContains(text, re, message, failures) {
  if (!re.test(text)) failures.push(message);
}

function assertNotContains(text, re, message, failures) {
  if (re.test(text)) failures.push(message);
}

const failures = [];
const vm = read(FILES.vm);
const page = read(FILES.page);

assertContains(vm, /export\s+function\s+dedupeApprovalRowsById\s*\(/, 'VM must export section-level dedupeApprovalRowsById helper', failures);
assertContains(vm, /sectionKey:\s*string/, 'dedupe helper must accept a sectionKey argument', failures);
assertContains(vm, /duplicateCount:\s*number/, 'VM must expose duplicateCount diagnostics', failures);
assertContains(vm, /duplicateIds:\s*string\[\]/, 'VM must expose duplicateIds diagnostics', failures);
assertContains(vm, /dedupeDiagnostics:\s*OperatorApprovalDedupeDiagnosticsVm/, 'VM must add dedupeDiagnostics to OperatorApprovalsVm', failures);
assertContains(vm, /bySection:\s*Record<string,\s*OperatorApprovalDedupeSectionDiagnosticsVm>/, 'dedupeDiagnostics must expose bySection diagnostics', failures);

for (const section of ['pending', 'highRiskPrescriptions', 'noPermission', 'selfApprovalRisk', 'history']) {
  assertContains(vm, new RegExp(`dedupeApprovalRowsById\\([^,]+,\\s*"${section}"`), `section ${section} must be deduped in VM`, failures);
  assertContains(page, new RegExp(`sectionKey="${section}"`), `page must pass stable sectionKey=${section}`, failures);
}

assertContains(page, /type\s+ApprovalSectionKey\s*=/, 'page must define explicit ApprovalSectionKey type', failures);
assertContains(page, /sectionKey:\s*ApprovalSectionKey/, 'ApprovalSection props must include sectionKey', failures);
assertContains(page, /key=\{`\$\{sectionKey\}-\$\{row\.approvalRequestId\}`\}/, 'React key must use stable sectionKey + approvalRequestId', failures);
assertNotContains(page, /key=\{`\$\{title\}-\$\{row\.approvalRequestId\}`\}/, 'React key must not use display title as section identity', failures);
assertNotContains(page, /key=\{[^}]*index/, 'React key must not use index to hide duplicate approvals', failures);
assertNotContains(page, /rows\.map\(\(row,\s*index\)/, 'rendering must not receive index in row map', failures);
assertNotContains(page, /Encountered two children with the same key/, 'page must not suppress duplicate key warnings', failures);

if (failures.length) {
  console.error('ACCEPTANCE_OPERATOR_APPROVALS_VM_DEDUPE_V1 failed');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ACCEPTANCE_OPERATOR_APPROVALS_VM_DEDUPE_V1 passed');
