const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = process.cwd();
const taskbookPath = path.join(root, 'docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md');
const prototypePath = path.join(root, 'docs/frontend-productization/PFE-14-PROTOTYPE-AUTHORITY-V1.json');

const taskbook = fs.readFileSync(taskbookPath, 'utf8');
const prototype = JSON.parse(fs.readFileSync(prototypePath, 'utf8'));

assert.match(taskbook, /PFE-14-TASK-V0\.2-MASTER-ALIGNED/);
assert.match(taskbook, /ONE_GOVERNED_SIX_KEY_SCOPE/);
assert.match(taskbook, /目标态原型 \/ 非当前运行数据/);
assert.match(taskbook, /一级导航冻结为:[\s\S]*运行总览[\s\S]*地块/);
assert.match(taskbook, /不再把 `\/operator\/pilot` 列为 PFE-14 正式路由/);
assert.match(taskbook, /Live Device: Not connected/);
assert.match(taskbook, /Production Gateway: Not online/);
assert.match(taskbook, /Field Pilot: Not started/);
assert.match(taskbook, /Controlled Execution: Disabled/);
assert.match(taskbook, /MCFT_CAP_09_PROVIDE_AUTHORIZED_SCHEDULER_AND_EVIDENCE_AVAILABILITY_READ_CONTRACT/);
assert.doesNotMatch(taskbook, /Governed Field Runtimes/);
assert.doesNotMatch(taskbook, /all fields/i);

assert.equal(prototype.scope_rule, 'ONE_GOVERNED_SIX_KEY_SCOPE_ONLY');
assert.deepEqual(prototype.primary_navigation, ['runtime_overview', 'fields']);
assert.equal(prototype.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.may_claim_repository_implementation, false);
assert.equal(prototype.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.may_claim_runtime_truth, false);
assert.equal(prototype.frozen_sample_scope.runtime_mode, 'SHADOW_ONLINE_SAMPLE');
assert.ok(prototype.forbidden_prototype_claims.includes('MULTI_FIELD_CONCURRENT_SHADOW_RUNTIME'));
assert.ok(prototype.forbidden_prototype_claims.includes('AO_ACT_CREATION'));
assert.ok(prototype.forbidden_prototype_claims.includes('PRODUCTION_GATEWAY_ONLINE'));

console.log('PFE-14 taskbook v0.2 alignment acceptance: PASS');
