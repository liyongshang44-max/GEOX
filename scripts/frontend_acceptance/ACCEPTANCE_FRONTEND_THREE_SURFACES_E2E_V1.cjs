#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const files = (dir) => fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]).filter(f=>/\.(tsx?|css)$/.test(f));
const assert=(c,m,d)=>{if(!c)throw new Error(m+(d?' '+JSON.stringify(d):''));};
const app=read('apps/web/src/app/App.tsx');
const required = ['dashboard','fields','fields/:fieldId','operations','operations/:operationId','reports','export'];
for (const r of required) assert(app.includes(`path="${r}"`), `missing customer route ${r}`);
for (const r of ['twin','twin/fields/:fieldId','twin/fields/:fieldId/forecast','twin/fields/:fieldId/scenarios','twin/fields/:fieldId/evidence','twin/fields/:fieldId/calibration','twin/fields/:fieldId/post-irrigation']) assert(app.includes(`path="${r}"`), `missing operator route ${r}`);
for (const r of ['dashboard','fields','operations','devices','alerts','evidence','skills','acceptance','healthz']) assert(app.includes(`path="${r}"`), `missing admin route ${r}`);
function assertSurface(dir, cls, otherClasses, forbiddenImports, forbiddenTokens){
  for (const f of files(dir)) { const s=read(f); const rel=f; if (/\.tsx?$/.test(f)) {
    for (const bad of forbiddenImports) assert(!new RegExp(`from [\"'][^\"']*${bad}`).test(s), `${rel} imports ${bad}`);
    for (const t of forbiddenTokens) assert(!s.includes(t), `${rel} contains forbidden ${t}`);
    for (const oc of otherClasses) assert(!new RegExp(`className=[{\"'\`][^\n]*(?:${oc}[A-Z]|${oc}[-_])`).test(s), `${rel} uses ${oc} class`);
  }}
}
assertSurface('apps/web/src/features/customer', 'customer', ['operator','admin'], ['/operator/','/admin/'], ['submitOperatorScenarioRecommendation','createAoActTask','dispatchNow','approveNow','raw debug','skill logs']);
assertSurface('apps/web/src/features/operator', 'operator', ['customer','admin'], ['/features/customer/','/features/admin/'], ['createAoActTask','dispatchNow','approveNow','approvalBypassReady','field_memory_write','roi_ledger_write']);
assertSurface('apps/web/src/features/admin', 'admin', ['customerReportPage','operatorWorkbenchPage'], ['/features/customer/','/features/operator/'], ['SubmitScenarioToRecommendationPanel','submitOperatorScenarioRecommendation']);
assert(read('apps/web/src/features/customer/components/CustomerConfirmedTwinSummaryCard.tsx').includes('CustomerConfirmedTwinSummaryCard'), 'customer confirmed twin summary card missing');
assert(read('apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx').includes('SubmitScenarioToRecommendationPanel'), 'operator scenario submit panel missing');
assert(read('apps/web/src/features/admin/pages/AdminDashboardPage.tsx').includes('AdminControlPlaneShell'), 'admin control plane shell missing');
console.log('[frontend-three-surfaces-e2e] PASS');
