const fs = require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function assert(c,m){if(!c){throw new Error(m)}}
const page=read('apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx');
const panel=read('apps/web/src/features/operator/components/SubmitScenarioToRecommendationPanel.tsx');
const api=read('apps/web/src/api/operatorTwin.ts');
const customerFiles=fs.readdirSync('apps/web/src/features/customer',{recursive:true}).filter(String).map(p=>'apps/web/src/features/customer/'+p).filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile()).map(read).join('\n');
assert(page.includes('SubmitScenarioToRecommendationPanel'),'scenario compare page must import/use SubmitScenarioToRecommendationPanel');
assert(api.includes('submitOperatorScenarioRecommendation'),'API client must expose submitOperatorScenarioRecommendation');
assert((page+panel).includes('不会自动审批') && (page+panel).includes('不会创建 AO-ACT task'),'boundary copy must mention no auto approval and no task');
for (const token of ['createAoActTask','dispatch(','approve(','createOperationPlan']) assert(!page.includes(token) && !panel.includes(token), `forbidden frontend token ${token}`);
assert(api.includes('/submit-recommendation'),'submit URL must target submit-recommendation');
assert(!customerFiles.includes('SubmitScenarioToRecommendationPanel'),'customer surface must not import submit panel');
console.log('PASS H28 frontend scenario submit recommendation page');
