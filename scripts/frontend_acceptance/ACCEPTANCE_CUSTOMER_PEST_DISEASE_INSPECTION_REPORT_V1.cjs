#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const files = {
  labels: path.join(root, 'apps/web/src/lib/customerScenarioLabels.ts'),
  vm: path.join(root, 'apps/web/src/lib/formalScenarioViewModel.ts'),
  operationReportPage: path.join(root, 'apps/web/src/views/OperationReportPage.tsx'),
  operationsIndexVm: path.join(root, 'apps/web/src/viewmodels/customerOperationsIndexVm.ts'),
  formalCards: path.join(root, 'apps/web/src/components/customer/FormalScenarioCards.tsx'),
  evidenceVm: path.join(root, 'apps/web/src/lib/evidenceViewModel.ts'),
  evidence: path.join(root, 'apps/web/src/components/evidence/index.tsx'),
};

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertNone(text, blocked, label) {
  const found = blocked.filter((x) => text.includes(x));
  assert.deepEqual(found, [], `${label} contains blocked entries: ${found.join(', ')}`);
}

function extractFunctionBody(text, signatureStart) {
  const start = text.indexOf(signatureStart);
  assert.notEqual(start, -1, `unable to locate function signature: ${signatureStart}`);
  const braceStart = text.indexOf('{', start);
  assert.notEqual(braceStart, -1, `unable to locate function opening brace: ${signatureStart}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(braceStart + 1, i);
    }
  }
  assert.fail(`unable to extract function body: ${signatureStart}`);
}

(function main() {
  const labels = read(files.labels);
  const vm = read(files.vm);
  const operationReportPage = read(files.operationReportPage);
  const operationsIndexVm = read(files.operationsIndexVm);
  const formalCards = read(files.formalCards);
  const evidenceVm = read(files.evidenceVm);
  const evidence = read(files.evidence);
  const pdiSectionBody = extractFunctionBody(operationReportPage, 'function buildPestDiseaseInspectionSections(report: OperationReportV1): PestDiseaseSection[]');

  assertAll(labels, [
    'FORMAL_PEST_DISEASE_INSPECTION',
    '病虫害巡检',
    'pest_disease_suspected_review_required',
    'pest_disease_inspection_confirmed_no_spray',
    'pest_disease_missing_geo',
    'pest_disease_missing_media',
    'pest_disease_skill_signal_only',
    'pest_disease_review_pending',
    'pest_disease_review_rejected',
    'pest_disease_acceptance_pass_not_treatment',
    '发现疑似病虫害风险，已进入人工复核。',
    '巡检证据不足，暂不生成处理建议。',
    '巡检结果已确认，但尚未进入补喷处方。',
    '当前仅为识别信号，不作为正式巡检结论。',
    '巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。',
    '巡检任务已完成，但缺少定位或图片证据，需复核。',
  ], 'customerScenarioLabels pest disease customer labels');

  assertAll(vm, [
    'pestDiseaseInspectionCustomerSummaryText',
    'FORMAL_PEST_DISEASE_INSPECTION',
    'pest_disease_inspection',
    'pestDiseaseSummaryText',
  ], 'formalScenarioViewModel pest disease summary integration');

  assertAll(operationReportPage, [
    'function isPestDiseaseInspectionReport(report: OperationReportV1): boolean',
    'scenario === "FORMAL_PEST_DISEASE_INSPECTION"',
    'Boolean(anyReport.pest_disease_inspection)',
    'function buildPestDiseaseInspectionSections(report: OperationReportV1): PestDiseaseSection[]',
    '为什么巡检',
    '巡检证据',
    '识别与诊断结论',
    '人工复核',
    '巡检证据验收',
    '后续处理边界',
    '尚未生成补喷处方',
    '尚未形成防治执行任务',
    '尚未形成防治效果验收',
    '不代表已完成防治',
    '病虫害巡检报告',
  ], 'OperationReportPage pest disease scenario detection and layout');

  assertAll(operationsIndexVm, [
    'function isPestDiseaseInspectionOperation(item: CustomerOperationListItem): boolean',
    'scenario === "FORMAL_PEST_DISEASE_INSPECTION"',
    'Boolean(anyItem.pest_disease_inspection)',
    'PEST_DISEASE_INSPECTION',
    '病虫害巡检',
  ], 'customerOperationsIndexVm pest disease scenario detection');

  assertAll(formalCards, [
    'pestDiseaseSummaryText',
    '巡检摘要',
    '巡检证据汇总',
    '图片/媒体',
    '定位证据',
    '人工复核',
    '严重度',
    '置信度',
  ], 'FormalScenarioCards pest disease cards');

  assertNone(pdiSectionBody, [
    '土壤水分',
    '过去 24h 降雨',
    '未来 24h 降雨预测',
    '处方与审批',
  ], 'OperationReportPage PDI dedicated section');

  assertAll(evidenceVm, [
    'inspectionSummary',
    'media_count',
    'geo_evidence_present',
    'reviewed_by_human',
    'severity',
    'confidence',
    'review_required',
    'blocking_reasons',
    'pest_disease_skill_signal_only',
  ], 'evidenceViewModel inspection summary');

  assertAll(evidence, [
    'InspectionEvidenceSummary',
    '图片/媒体证据',
    '缺图片',
    '定位证据',
    '缺定位',
    '人工复核',
    '当前仅为识别信号，不作为正式巡检结论',
  ], 'Evidence Viewer inspection evidence summary');

  console.log('PASS acceptance customer pest disease inspection report v1', files);
})();
