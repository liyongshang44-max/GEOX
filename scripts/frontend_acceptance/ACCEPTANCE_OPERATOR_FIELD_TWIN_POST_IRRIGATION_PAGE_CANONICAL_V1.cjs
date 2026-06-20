const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function ok(c,m){if(!c){console.error(m);process.exit(1)}}
const app=read('apps/web/src/app/App.tsx');
const pagePath='apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx';
ok(fs.existsSync(pagePath),'page missing');
const page=read(pagePath);
ok(app.includes('twin/fields/:fieldId/post-irrigation'),'route missing');
ok(page.includes('fetchOperatorFieldTwinPostIrrigationVerification'),'fetch missing');
['State Before / After','Response Delta','Execution Evidence','Zone Response Matrix','Verification Summary','Verification Gaps','Boundary Rules'].forEach(t=>ok(page.includes(t),`missing ${t}`));
['operatorWorkbenchPage','operatorWorkbenchHero','operatorPanel','operatorPanelGrid','operatorTable','operatorList','operatorPill','operatorBoundaryNotice','operatorActionLink'].forEach(t=>ok(page.includes(t),`missing ${t}`));
['customerReportPage','customerCard','customerTable','customerList','customerStatusPill'].forEach(t=>ok(!page.includes(t),`forbidden ${t}`));
['writeFieldMemory','createRoiLedger','createAoActTask','approve','submitRecommendation'].forEach(t=>ok(!page.includes(t),`forbidden mutation ${t}`));
ok(!/\bdispatch\s*\(/.test(page),'forbidden mutation dispatch');
console.log('H27 frontend canonical acceptance passed');
