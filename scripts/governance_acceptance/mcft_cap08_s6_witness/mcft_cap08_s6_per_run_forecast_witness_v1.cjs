#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_forecast_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const rows=source.forecasts;const success=rows.filter((x)=>x.status==='SUCCESS');const pointCounts=[...new Set(success.map((x)=>x.point_count))];return{successful_forecast_count:success.length,forecast_point_count_per_forecast:pointCounts.length===1?pointCounts[0]:null,total_forecast_point_count:success.reduce((n,x)=>n+x.point_count,0),failed_forecast_count:rows.length-success.length};}});
