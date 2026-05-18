const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

function read(rel) {
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `missing required file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, needles, label) {
  const missing = needles.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing: ${missing.join(', ')}`);
}

(function main() {
  const labels = read('apps/web/src/lib/customerScenarioLabels.ts');
  const vm = read('apps/web/src/lib/formalScenarioViewModel.ts');
  const cards = read('apps/web/src/components/customer/FormalScenarioCards.tsx');

  const customerTexts = [
    '实验室结果显示存在缺氮风险，已生成施氮建议。',
    '感知系统提示可能存在养分风险，建议先采样复核。',
    '土壤电导率异常，可能存在盐分或水分干扰，暂不生成施氮建议。',
    '当前仅为感知预警，不作为正式施肥结论。',
    '施氮处方已批准，等待执行。',
    '施氮作业部分分区偏差过大，需复核。',
  ];

  assertAll(labels, [
    'FORMAL_FERTILIZATION',
    '正式施氮',
    'fertilizationCustomerSummaryText',
    'fertilization_lab_low_n_formal',
    'fertilization_sensing_review_only',
    'fertilization_salinity_risk',
    'fertilization_warning_only',
    'fertilization_prescription_approved',
    'fertilization_zone_deviation_large',
    ...customerTexts,
  ], 'customerScenarioLabels fertilization labels');

  assertAll(vm, [
    'fertilizationCustomerSummaryText',
    'reportOrOperation?.fertilization',
    'fertilizationSummaryText',
    'FORMAL_FERTILIZATION',
    'fertilization?.acceptance_status',
    'fertilization?.zone_rates',
    'fertilization?.blocking_reasons',
  ], 'formalScenarioViewModel fertilization VM');

  assertAll(cards, [
    'fertilizationSummaryText',
    '施氮摘要',
    '施氮分区汇总',
    '施氮作业部分分区偏差过大，需复核。',
    'data?.fertilization?.zone_rates',
    '单个必需分区失败时，整体不得判定通过',
  ], 'FormalScenarioCards fertilization rendering');

  console.log('PASS acceptance customer fertilization report v1', {
    customer_texts_checked: customerTexts.length,
    labels: 'apps/web/src/lib/customerScenarioLabels.ts',
    view_model: 'apps/web/src/lib/formalScenarioViewModel.ts',
    cards: 'apps/web/src/components/customer/FormalScenarioCards.tsx',
  });
})();
