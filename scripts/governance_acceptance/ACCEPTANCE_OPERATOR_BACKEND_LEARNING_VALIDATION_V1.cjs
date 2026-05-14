#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function read(rel) { const full = path.join(root, rel); if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`); return fs.readFileSync(full, 'utf8'); }
function has(file, token, label) { const text = read(file); if (!text.includes(token)) throw new Error(`${label}: missing ${token}`); }
function lacks(file, token, label) { const text = read(file); if (text.includes(token)) throw new Error(`${label}: forbidden ${token}`); }

const projector = 'apps/server/src/domain/operator_learning/learning_validation_v1.ts';
const route = 'apps/server/src/routes/v1/operator_learning_validation.ts';
const moduleFile = 'apps/server/src/modules/operator/registerOperatorModule.ts';
const api = 'apps/web/src/api/operatorLearningValidation.ts';
const vm = 'apps/web/src/viewmodels/operatorLearningClosureVm.ts';
const oldDiagnostics = 'apps/server/src/routes/operator_diagnostics_v1.ts';

for (const token of [
  'FORMAL_LEARNING_ACCEPTED',
  'TRUSTED_VALUE_ONLY',
  'RAW_SIGNALS_ONLY',
  'SIMULATED_OR_DEV_ONLY',
  'INSUFFICIENT_FORMAL_CHAIN',
  'learning_effective',
  'formal_memory_count',
  'trusted_value_count',
  'raw_signal_count',
  'SKILL_RUN_IS_RAW_SIGNAL',
  'TECHNICAL_MEMORY_IS_RAW_SIGNAL',
  'FORMAL_ACCEPTANCE_ID_REQUIRED',
  'memory_lane',
  'customer_visible_memory',
  'learning_eligible',
  'customer_visible_value',
  'chain_validation_passed',
]) has(projector, token, `projector ${token}`);

has(route, '/api/v1/operator/learning-validation', 'route list endpoint');
has(route, '/api/v1/operator/operations/:operation_id/learning-validation', 'route operation endpoint');
has(route, 'buildOperatorLearningValidationV1', 'route uses projector');
has(route, 'operator_learning_validation_v1', 'route source marker');
has(moduleFile, 'registerOperatorLearningValidationRoutes', 'operator module registration');
has(api, 'fetchOperatorLearningValidation', 'frontend API client');
has(api, '/api/v1/operator/learning-validation', 'frontend API official route');
has(vm, 'learningValidation', 'VM accepts backend validation');
has(vm, 'backendValidationText', 'VM shows backend validation');
has(vm, 'validation.learning_effective', 'VM uses backend learning_effective');
has(vm, '未通过后端学习门禁', 'VM downgrades failed backend validation');

has(oldDiagnostics, 'skillPerfRows.length > 0', 'legacy diagnostics still contains object-existence signal and must not be official learning source');
lacks(projector, 'skillPerfRows.length > 0', 'projector must not use skillPerfRows length as formal learning');
lacks(projector, 'roiRows.length > 0 ? "已生效"', 'projector must not mark ROI existence as learning effective');

console.log('[OPERATOR_BACKEND_LEARNING_VALIDATION_V1] PASSED');
console.log('[OPERATOR_BACKEND_LEARNING_VALIDATION_V1] Checked backend-owned learning validation projector, routes, module registration, frontend API, and VM preference.');
