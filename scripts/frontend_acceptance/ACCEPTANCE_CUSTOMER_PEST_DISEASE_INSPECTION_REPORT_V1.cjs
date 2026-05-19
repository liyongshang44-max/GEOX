#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const files = {
  labels: path.join(root, 'apps/web/src/lib/customerScenarioLabels.ts'),
  vm: path.join(root, 'apps/web/src/lib/formalScenarioViewModel.ts'),
  cards: path.join(root, 'apps/web/src/components/customer/FormalScenarioCards.tsx'),
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

(function main() {
  const labels = read(files.labels);
  const vm = read(files.vm);
  const cards = read(files.cards);
  const evidenceVm = read(files.evidenceVm);
  const evidence = read(files.evidence);

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

  assertAll(cards, [
    'pestDiseaseSummaryText',
    '巡检摘要',
    '巡检证据汇总',
    '图片/媒体',
    '定位证据',
    '人工复核',
    '严重度',
    '置信度',
  ], 'FormalScenarioCards pest disease cards');

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
