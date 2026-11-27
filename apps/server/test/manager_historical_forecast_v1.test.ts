import assert from 'node:assert/strict';
import test from 'node:test';
import {projectHistoricalForecastFactsV1} from '../src/product_projection/customer/manager_historical_forecast_v1.js';
import {computeMemberDeterminismHashV1} from '../src/domain/twin_runtime/canonical_identity_v1.js';
import {executeCap04PureThreeScenarioMathV1} from '../src/domain/twin_runtime/pure_three_scenario_math_v1.js';
import {buildCap04PureScenarioMathInputV1} from '../../../scripts/runtime_acceptance/mcft_cap_04_scenario_math_fixture_v1.js';
const scope={tenant_id:'fixture-tenant',project_id:'fixture-project',group_id:'fixture-group',field_id:'fixture-field',season_id:'fixture-season',zone_id:'fixture-zone'};
function sample(){
 const input=buildCap04PureScenarioMathInputV1(),fp=input.source_forecast.math_result.forecast_payload,sp=executeCap04PureThreeScenarioMathV1(input).scenario_set_payload;
 const envelope=(id:string,kind:string,payload:unknown)=>({...scope,object_id:id,object_type:kind,lineage_id:'fixture-lineage',revision_id:'fixture-revision',logical_time:fp.issued_at,payload,determinism_hash:''});
 const f=envelope(input.source_forecast.ref,'twin_forecast_run_v1',fp);f.determinism_hash=computeMemberDeterminismHashV1(f);
 const scenario=structuredClone(sp);
 scenario.source_forecast_hash=f.determinism_hash;
 for(const o of scenario.options){o.source_forecast_hash=f.determinism_hash;o.assumption_basis.source_forecast_hash=f.determinism_hash;}
 const s=envelope('fixture-scenario','twin_scenario_set_v1',scenario);s.determinism_hash=computeMemberDeterminismHashV1(s);
 const ref=(x:typeof f)=>({fact_id:'fact_'+x.object_id,object_id:x.object_id,determinism_hash:x.determinism_hash});
 return {bindings:[{forecast:ref(f),scenario:ref(s)}],rows:[f,s].map(x=>({fact_id:'fact_'+x.object_id,source:'system',record_json:{type:x.object_type,payload:x}})),fp};
}
test('native forecast/scenario archive preserves 72 and 216 original fixture points',()=>{
 const x=sample(),r=projectHistoricalForecastFactsV1(scope,x.bindings,x.rows)[0];
 assert.equal(r.points.length,72);assert.equal(r.scenarios?.options.reduce((n,o)=>n+o.points.length,0),216);
 assert.equal(r.points[0].storage_mean_mm,x.fp.points[0].storage_mean_mm);
 assert.ok(r.scenarios?.options.every(o=>o.execution_status==='NOT_EXECUTED'));
});
test('missing fact, modified payload, wrong scope, incorrect grant all fail closed',()=>{
 const x=sample();
 assert.throws(()=>projectHistoricalForecastFactsV1(scope,x.bindings,x.rows.slice(0,1)));
 assert.throws(()=>projectHistoricalForecastFactsV1({...scope,field_id:'other'},x.bindings,x.rows));
 const corrupt=structuredClone(x.rows);(corrupt[0].record_json.payload.payload as any).points[0].storage_mean_mm='999.000000';
 assert.throws(()=>projectHistoricalForecastFactsV1(scope,x.bindings,corrupt));
 const wrong=structuredClone(x.bindings);wrong[0].forecast.determinism_hash='sha256:'+'f'.repeat(64);
 assert.throws(()=>projectHistoricalForecastFactsV1(scope,wrong,x.rows));
});
