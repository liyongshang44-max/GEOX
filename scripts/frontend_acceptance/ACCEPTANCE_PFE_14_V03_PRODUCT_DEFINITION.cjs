const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const taskbookPath = path.join(root, 'docs/frontend-productization/PFE-14-PRODUCT-TASKBOOK-V0.3.md');
const authorityPath = path.join(root, 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const prototypePath = path.join(root, 'docs/frontend-productization/PFE-14-PROTOTYPE-AUTHORITY-V1.json');
const matrixPath = path.join(root, 'docs/frontend-productization/PFE-14-PRODUCT-PROTOTYPE-MATRIX-V1.json');

for (const file of [taskbookPath, authorityPath, prototypePath, matrixPath]) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${path.relative(root, file)}`);
}

const taskbook = fs.readFileSync(taskbookPath, 'utf8');
const authority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
const prototype = JSON.parse(fs.readFileSync(prototypePath, 'utf8'));
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

assert.equal(authority.taskbook_revision, 'v0.3');
assert.equal(authority.taskbook_ref, 'docs/frontend-productization/PFE-14-PRODUCT-TASKBOOK-V0.3.md');
assert.equal(authority.product_goal, 'USABLE_OPERATOR_PRODUCT');
assert.equal(authority.engineering_acceptance_only, false);
assert.equal(authority.default_locale, 'zh-CN');
assert.deepEqual(authority.required_locales, ['zh-CN', 'en-US']);
assert.equal(authority.prototype_display_locale, 'zh-CN');
assert.deepEqual(authority.primary_navigation, ['runtime_overview', 'fields']);
assert.equal(authority.multi_field_concurrent_shadow_claimed, false);
assert.equal(authority.controlled_action_authorized, false);
assert.equal(authority.dispatch_authorized, false);

assert.equal(prototype.taskbook_revision, 'v0.3');
assert.equal(prototype.product_goal, 'USABLE_OPERATOR_PRODUCT');
assert.equal(prototype.prototype_display_locale, 'zh-CN');
assert.equal(prototype.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.language_switch_visible, true);
assert.deepEqual(prototype.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.language_switch_labels, ['中文', 'English']);
assert.equal(prototype.required_product_pages.length, 12);

assert.equal(matrix.artifact_class, 'TARGET_STATE_PRODUCT_PROTOTYPE');
assert.equal(matrix.display_locale, 'zh-CN');
assert.equal(matrix.required_badge, '目标态产品原型 / 非当前运行数据');
assert.equal(matrix.matrix_layout.main_panels.length, 12);
assert.equal(matrix.matrix_layout.state_strip.length, 6);
assert.equal(matrix.global_ui_requirements.includes('ONE_SIX_KEY_SCOPE_ONLY'), true);
assert.equal(matrix.forbidden_visuals.includes('MULTI_FIELD_PORTFOLIO'), true);
assert.equal(matrix.forbidden_visuals.includes('DISPATCH_BUTTON'), true);

for (const token of [
  '工程验收是进入主线的必要条件，但不是产品完成标准',
  '所有正式页面必须完整支持',
  '主界面文本：中文',
  'P01 运行总览',
  'P12 证据 / Trace / Timeline',
  '可用产品验收',
  '目标态产品原型 / 非当前运行数据'
]) {
  assert.equal(taskbook.includes(token), true, `taskbook missing token: ${token}`);
}

for (const forbidden of [
  'multi-field concurrent runtime',
  'AUTOMATIC_RECOMMENDATION',
  'AO_ACT_CREATION',
  'DISPATCH'
]) {
  assert.equal(prototype.forbidden_prototype_claims.includes(forbidden), false, `unexpected raw forbidden token mismatch: ${forbidden}`);
}

console.log('ACCEPTANCE_PFE_14_V03_PRODUCT_DEFINITION: PASS');
