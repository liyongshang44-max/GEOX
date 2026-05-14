#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}
function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) throw new Error(`${label}: must not include ${needle}`);
}
function assertRegex(text, regex, label) {
  if (!regex.test(text)) throw new Error(`${label}: missing ${regex}`);
}

const learningVm = read('apps/web/src/viewmodels/operatorLearningClosureVm.ts');
const memoryVm = read('apps/web/src/viewmodels/operatorFieldMemoryVm.ts');
const memoryApi = read('apps/web/src/api/operatorFieldMemory.ts');
const roiVm = read('apps/web/src/viewmodels/operatorRoiLedgerVm.ts');
const skillTraceApi = read('apps/web/src/api/operatorSkillTrace.ts');

assertNotIncludes(learningVm, 'function didLearn', 'learning closure must not use legacy didLearn helper');
assertNotIncludes(learningVm, 'const didLearn', 'learning closure must not use object-existence didLearn state');
assertIncludes(learningVm, 'hasFormalLearning', 'learning closure must use formal learning gate');
assertIncludes(learningVm, 'hasTrustedValue', 'learning closure must use trusted value gate');
assertIncludes(learningVm, 'enteredLearning === true', 'skill trace enteredLearning may remain as raw signal');
assertIncludes(learningVm, '仅作为学习信号', 'skill trace learning flag must be labelled as raw signal');
assertIncludes(learningVm, '未通过正式学习门禁', 'learning closure must downgrade raw learning signals');
assertNotIncludes(learningVm, 'didLearn\n        ? "已生效"', 'learning effective must not be driven by didLearn');

assertIncludes(memoryApi, 'customerVisibleMemory === true', 'field memory API must expose customer visibility gate');
assertIncludes(memoryApi, 'learningEligible === true', 'field memory API must expose learning eligibility gate');
assertIncludes(memoryApi, 'memoryLane === "FORMAL_FIELD_MEMORY"', 'field memory API must require formal memory lane');
assertIncludes(memoryApi, 'trustLevel === "FORMAL_ACCEPTED"', 'field memory API must require formal trust');
assertIncludes(memoryApi, '存在记忆/证据信号，但未通过正式学习门禁', 'field memory API must not infer learning from evidence refs');

assertIncludes(memoryVm, 'learningGateText', 'field memory VM must show learning gate');
assertIncludes(memoryVm, '已通过正式学习门禁', 'field memory VM must distinguish formal learning');
assertIncludes(memoryVm, '未通过正式学习门禁', 'field memory VM must downgrade non-formal rows');
assertNotIncludes(memoryVm, 'evidenceRefs ?? []).length === 0) return "无证据，不学习"', 'field memory VM must not derive learning directly from evidence refs');
assertNotIncludes(memoryVm, 'return "已学习：变化前、变化后与变化量已更新"', 'field memory VM must not infer learned from object presence');

assertIncludes(roiVm, 'customerVisibleValue', 'ROI VM must expose customer visible value gate');
assertIncludes(roiVm, 'FORMAL_ACCEPTED', 'ROI VM must require formal accepted trust');
assertIncludes(roiVm, '未通过正式价值门禁', 'ROI VM must downgrade measured/non-formal ROI');
assertIncludes(roiVm, '具备实测计算条件，但未通过正式价值门禁', 'MEASURED must not imply trusted value');
assertNotIncludes(roiVm, '基线与实际结果已提供，可按实测口径解读。', 'ROI VM must not equate measured with formal accepted');

assertIncludes(skillTraceApi, 'enteredLearning', 'skill trace API can still expose raw enteredLearning signal');
assertRegex(learningVm, /formalLearning[\s\S]*\?[\s\S]*"已生效"/, 'learning effective success must be driven by formalLearning');

console.log('[OPERATOR_LEARNING_NOT_OBJECT_EXISTENCE_V1] PASSED');
console.log('[OPERATOR_LEARNING_NOT_OBJECT_EXISTENCE_V1] Checked operator learning closure, field memory VM/API, ROI VM, and skill trace raw-signal treatment.');
