#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function read(rel) { const full = path.join(root, rel); if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`); return fs.readFileSync(full, 'utf8'); }
function has(file, token, label) { const text = read(file); if (!text.includes(token)) throw new Error(`${label}: missing ${token}`); }
function lacks(file, token, label) { const text = read(file); if (text.includes(token)) throw new Error(`${label}: forbidden ${token}`); }

const guard = 'apps/server/src/runtime/route_reply_guard_v1.ts';
const diagnostics = 'apps/server/src/routes/operator_diagnostics_v1.ts';
const officialRoute = 'apps/server/src/routes/v1/operator_learning_validation.ts';
const officialProjector = 'apps/server/src/domain/operator_learning/learning_validation_v1.ts';

has(guard, 'sanitizeLegacyDiagnosticsLearningPayload', 'runtime guard sanitizer');
has(guard, 'looksLikeLegacyLearningClosure', 'legacy closure detector');
has(guard, 'DIAGNOSTIC_ONLY_NOT_FORMAL', 'legacy diagnostic downgrade status');
has(guard, 'official_learning_validation_route', 'official route pointer');
has(guard, '/api/v1/operator/learning-validation', 'official route path');
has(guard, 'operator_learning_validation_v1', 'official source marker');
has(guard, 'learning_effective: false', 'legacy diagnostics cannot mark learning effective');
has(guard, 'Legacy operator diagnostics is diagnostic-only', 'diagnostic-only warning');
has(guard, 'onSend', 'runtime response guard');
has(guard, 'application/json', 'guard only touches JSON');
has(guard, 'pathname.includes("operator")', 'guard scoped to operator/diagnostic routes');

has(diagnostics, 'skillPerfRows.length > 0', 'legacy diagnostics still contains old object-existence wording source');
has(diagnostics, 'customer_summary', 'legacy diagnostics still returns diagnostic customer summary');
has(officialRoute, 'operator_learning_validation_v1', 'official learning validation route exists');
has(officialProjector, 'FORMAL_LEARNING_ACCEPTED', 'official projector owns formal learning accepted status');
has(officialProjector, 'learning_effective', 'official projector owns learning_effective');
lacks(officialProjector, 'DIAGNOSTIC_ONLY_NOT_FORMAL', 'official projector must not be diagnostic-only');

console.log('[LEGACY_DIAGNOSTICS_LEARNING_BOUNDARY_V1] PASSED');
console.log('[LEGACY_DIAGNOSTICS_LEARNING_BOUNDARY_V1] Checked legacy diagnostics learning payload downgrade and official learning-validation source boundary.');
