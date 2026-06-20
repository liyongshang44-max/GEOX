#!/usr/bin/env node
const fs = require('fs'); const path = require('path'); const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8'); const assert=(c,m)=>{if(!c) throw new Error(m)};
const app=read('apps/web/src/app/App.tsx'), page=read('apps/web/src/features/operator/pages/OperatorFieldTwinEvidencePage.tsx'), api=read('apps/web/src/api/operatorTwin.ts');
const components = ['EvidenceTracePanel.tsx','DataCoverageMatrix.tsx','QualitySummaryPanel.tsx','LowQualityReasonList.tsx'].map(f=>read('apps/web/src/features/operator/components/'+f)).join('\n');
const ui = page + '\n' + components;
assert(app.includes('OperatorFieldTwinEvidencePage') && app.includes('path="twin/fields/:fieldId/evidence"'), 'route not registered');
for (const t of ['operatorWorkbenchPage','operatorWorkbenchHero','operatorPanel','operatorPanelGrid','operatorTable','operatorList','operatorPill','operatorBoundaryNotice','operatorActionLink']) assert(ui.includes(t), 'missing operator class '+t);
for (const t of ['customerReportPage','customerCard','customerTable','customerList','customerStatusPill']) assert(!ui.includes(t), 'forbidden customer class '+t);
assert(api.includes('fetchOperatorFieldTwinEvidenceQuality') && page.includes('fetchOperatorFieldTwinEvidenceQuality'), 'missing API call');
for (const t of ['createAoActTask','dispatch','approval','submitRecommendation','writeReady=true']) assert(!ui.includes(t), 'forbidden token '+t);
for (const t of ['Evidence Trace','Data Coverage Matrix','Quality Summary','Boundary Rules']) assert(ui.includes(t), 'missing section '+t);
const pkg=JSON.parse(read('package.json')); assert(pkg.scripts['ci:frontend:operator-field-twin-evidence-page-canonical']==='node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_EVIDENCE_PAGE_CANONICAL_V1.cjs','missing package script');
console.log('[operator-field-twin-evidence-page-canonical] PASS');
