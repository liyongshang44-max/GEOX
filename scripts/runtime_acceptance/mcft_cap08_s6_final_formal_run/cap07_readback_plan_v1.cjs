#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const SURFACES=[
 {name:'runtime',suffix:'',paginated:false},
 {name:'timeline',suffix:'/timeline',paginated:true},
 {name:'trace',suffix:'/trace',paginated:false},
 {name:'states',suffix:'/states',paginated:true},
 {name:'forecasts',suffix:'/forecasts',paginated:true},
 {name:'scenarios',suffix:'/scenarios',paginated:true},
 {name:'residuals',suffix:'/residuals',paginated:true},
 {name:'action-lifecycle',suffix:'/action-lifecycle',paginated:true},
 {name:'model-governance',suffix:'/model-governance',paginated:true,query_variants:[{collection_kind:'CALIBRATION_CANDIDATE'},{collection_kind:'SHADOW_EVALUATION'}]},
 {name:'health',suffix:'/health',paginated:false},
];
function buildCap07ReadbackPlanV1(contracts){assert.equal(contracts.s6.read_model_contract.cap07_get_surface_count,10);return{schema_version:'geox_mcft_cap08_s6_cap07_complete_readback_plan_v1',base_path_template:'/api/v1/operator/twin/fields/{field_id}/runtime',scope_query_fields:['tenant_id','project_id','group_id','season_id','zone_id'],surface_count:10,surfaces:SURFACES.map(x=>({...x,method:'GET',pagination_policy:x.paginated?'FETCH_UNTIL_NEXT_CURSOR_NULL':'SINGLE_RESPONSE',required_status:200,cache_control_required:'no-store',content_hash_required:true,response_instance_hash_required:true})),read_before_write_snapshot_required:true,read_after_write_snapshot_required:true,expected_product_read_write_delta:0,canonical_fact_write_delta:0,projection_write_delta:0,database_execution_authorized:false};}
module.exports={SURFACES,buildCap07ReadbackPlanV1};
