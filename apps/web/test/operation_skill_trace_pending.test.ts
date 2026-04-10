import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const operationsSource = readFileSync(resolve('apps/web/src/api/operations.ts'), 'utf8');
const labelsSource = readFileSync(resolve('apps/web/src/lib/operationLabels.ts'), 'utf8');
const detailVmSource = readFileSync(resolve('apps/web/src/viewmodels/operationDetailViewModel.ts'), 'utf8');
const traceCardSource = readFileSync(resolve('apps/web/src/components/operations/OperationSkillTraceCard.tsx'), 'utf8');

test('skill trace status normalization keeps pending and converges pass/fail', () => {
  assert.match(operationsSource, /raw === "PENDING_ACCEPTANCE"\) return "PENDING"/);
  assert.match(operationsSource, /if \(!raw \|\| raw === "PENDING_ACCEPTANCE"\) return "PENDING"/);
  assert.match(operationsSource, /\["PASS", "PASSED", "SUCCESS"/);
  assert.match(operationsSource, /\["FAIL", "FAILED", "ERROR"/);
});

test('UI has pending localized label and tone mapping', () => {
  assert.match(labelsSource, /if \(normalized === "PENDING"\) return locale === "en" \? "Pending" : "待处理"/);
  assert.match(labelsSource, /if \(normalized === "PENDING" \|\| normalized === "RUNNING"\) return "warning"/);
  assert.match(traceCardSource, /mapSkillRunStatusLabel\(resultStatus, "zh"\)/);
  assert.match(traceCardSource, /mapSkillRunStatusTone\(resultStatus\)/);
});

test('detail vm accepts pending acceptance or empty as pending verdict branch', () => {
  assert.match(detailVmSource, /raw\.includes\("PENDING_ACCEPTANCE"\) \|\| raw\.includes\("PENDING"\)/);
  assert.match(detailVmSource, /detail\?\.acceptance\?\.result_status/);
});
