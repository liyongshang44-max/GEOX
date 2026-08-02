'use strict';
const assert=require('node:assert/strict');
const {digest,factId,required}=require('./shared_v1.cjs');

const DATASET_ID='mcft_cap08_stage1a_replay_v2';
const PROFILE_ID='MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1';
const OUTCOME_PROFILE_ID='FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1';
const CONTRACT_DIGEST='sha256:85fe66eda022531dd426a0ac70624ff0c22a2662a8d5f9c661cd1891bd6a8194';
const HIDDEN_PARAMETER='0.034000';

function addHours(value,hours){
  return new Date(Date.parse(value)+hours*3600000).toISOString();
}
function fvoIndex(id){
  const match=/^FVO-(\d{2})$/.exec(id);
  if(!match)throw new Error(`FVO_ID:${id}`);
  const value=Number(match[1]);
  if(value<1||value>24)throw new Error(`FVO_INDEX:${id}`);
  return value;
}
function rainfall(index){
  return index>=8
    ?Number((5.2+(index%4)*0.2).toFixed(6))
    :Number((0.2+(index%4)*0.1).toFixed(6));
}
function rewriteForcing(records,logicalTime,runtimeStart,semanticHash){
  const index=(Date.parse(logicalTime)-Date.parse(runtimeStart))/3600000;
  if(!Number.isInteger(index)||index<0||index>23)throw new Error(`TICK_INDEX:${logicalTime}`);
  return records.map(source=>{
    const record=structuredClone(source);
    if(record.record_type!=='observed_rainfall_v1')return record;
    const value=rainfall(index);
    record.canonical_payload={...record.canonical_payload,value};
    record.source_payload={...record.source_payload,value};
    record.source_record_hash=semanticHash({
      record_type:record.record_type,
      source_record_id:record.source_record_id,
      binding_id:record.binding_id,
      origin_source_id:record.origin_source_id,
      role_time:record.role_time,
      canonical_payload:record.canonical_payload,
    });
    record.dataset_id=DATASET_ID;
    record.limitations=[
      'CONTROLLED_SYNTHETIC',
      'FINAL_FORMAL_CLOSURE_INPUT',
      'MULTI_REGIME_RAINFALL_PROFILE',
      'NOT_FIELD_CALIBRATED',
    ];
    return record;
  });
}

function createFinalFormalEvidenceSourceV1({
  pool,
  baseSource,
  runtimeRepository,
  formalRunId,
  scope,
  product,
  forecastResolver=null,
}){
  const generated=new Map();
  const exactForecastResolver=forecastResolver??(
    typeof product.Cap08S4T17AuthorityBoundForecastResolverV1==='function'
      &&typeof product.PostgresCap08S4T17TransitionRepositoryV1==='function'
      ?new product.Cap08S4T17AuthorityBoundForecastResolverV1(
        new product.PostgresCap08S4T17TransitionRepositoryV1(pool),
      )
      :null
  );

  async function persist(record){
    const id=factId('mcft08_s6_fvo',{
      formal_run_id:formalRunId,
      source_record_id:record.source_record_id,
      source_record_hash:record.source_record_hash,
    });
    const stored={
      ...record,
      formal_run_id:formalRunId,
      closure_evidence_class:'FORECAST_VERIFICATION_OBSERVATION',
    };
    const inserted=await pool.query(
      `INSERT INTO facts(fact_id,occurred_at,source,record_json)
       VALUES($1,$2::timestamptz,'mcft_cap08_s6_final_formal_evidence_v1',$3::jsonb)
       ON CONFLICT(fact_id) DO NOTHING RETURNING fact_id`,
      [
        id,
        record.available_to_runtime_at,
        JSON.stringify({type:'soil_moisture_observation_v1',payload:stored}),
      ],
    );
    if(inserted.rows.length===0){
      const existing=await pool.query('SELECT record_json FROM facts WHERE fact_id=$1',[id]);
      assert.equal(existing.rows.length,1);
      assert.equal(
        existing.rows[0].record_json.payload.source_record_hash,
        record.source_record_hash,
        'FVO_IDEMPOTENCY_CONFLICT',
      );
    }
    generated.set(record.source_record_id,stored);
  }

  async function exactForecast(issuedAt){
    const values=[
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      scope.field_id,
      scope.season_id,
      scope.zone_id,
      issuedAt,
    ];
    const result=await pool.query(
      `SELECT record_json->'payload' AS object
         FROM facts
        WHERE record_json->>'type'='twin_forecast_run_v1'
          AND record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->'payload'->'payload'->>'issued_at'=$7
          AND record_json->'payload'->'payload'->>'status'='COMPLETED'
        ORDER BY record_json->'payload'->>'object_id'`,
      values,
    );
    const candidates=result.rows.map(row=>row.object);
    if(exactForecastResolver){
      return exactForecastResolver.resolveExactForecast({
        formal_run_id:formalRunId,
        scope,
        issued_at:issuedAt,
        candidates,
      });
    }
    assert.equal(candidates.length,1,`FORECAST_CARDINALITY:${issuedAt}`);
    return candidates[0];
  }

  async function buildFvo(id,forecast){
    const index=fvoIndex(id);
    const payload=forecast.payload;
    assert.equal(payload.status,'COMPLETED');
    assert.equal(payload.points.length,72);
    const point=payload.points[0];
    const configObject=await runtimeRepository.readRuntimeConfig(
      required(forecast.runtime_config_ref,'CONFIG_REF'),
    );
    assert.ok(
      configObject&&configObject.determinism_hash===forecast.runtime_config_hash,
      'CONFIG_MISMATCH',
    );
    const config=new product.DirectCap04ExecutionConfigResolverV1()
      .resolveExecutionConfig(configObject).payload;
    const fixed6=value=>Number(value).toFixed(6);
    const replay=product.executeHourlyWaterBalanceV1({
      interval_start_exclusive:point.interval_start,
      interval_end_inclusive:point.interval_end,
      previous_storage_mm_decimal:point.previous_storage_mm,
      previous_variance_basis:{
        basis_origin:'CARRIED_FROM_PREVIOUS_CONTINUATION_STATE',
        previous_state_ref:payload.source_posterior_ref,
        previous_storage_variance_mm2_decimal:'0.000000000000',
      },
      gross_rainfall_mm_decimal:point.gross_precipitation_assumption_mm,
      historical_et0_mm_decimal:point.reference_et0_mm,
      crop_stage_code:point.crop_stage_code,
      kc_decimal:point.kc,
      executed_irrigation_candidates:[],
      config:{
        root_zone_depth_mm:fixed6(config.soil_hydraulic_snapshot.root_zone_depth_mm),
        wilting_point_storage_mm:fixed6(config.soil_hydraulic_snapshot.wilting_point_storage_mm),
        field_capacity_storage_mm:fixed6(config.soil_hydraulic_snapshot.field_capacity_storage_mm),
        saturation_storage_mm:fixed6(config.soil_hydraulic_snapshot.saturation_storage_mm),
        saturation_fraction:fixed6(config.soil_hydraulic_snapshot.saturation_fraction),
        runoff_fraction:fixed6(config.dynamics_parameters.runoff_fraction),
        drainage_coefficient_per_hour:HIDDEN_PARAMETER,
        structural_process_stddev_mm_per_hour:fixed6(
          config.process_uncertainty.structural_process_stddev_mm_per_hour,
        ),
        rainfall_relative_stddev:fixed6(config.process_uncertainty.rainfall_relative_stddev),
        crop_et_relative_stddev:fixed6(config.process_uncertainty.crop_et_relative_stddev),
        executed_irrigation_relative_stddev:fixed6(
          config.process_uncertainty.executed_irrigation_relative_stddev,
        ),
      },
    });
    const observedAt=addHours(product.CAP08_S1_RUNTIME_START_V1,index);
    const availableAt=index===1
      ?addHours(product.CAP08_S1_RUNTIME_START_V1,16)
      :observedAt;
    const qualityStatus=index===3?'LIMITED':'PASS';
    const value=id==='FVO-10'
      ?Number(product.CAP08_S3_OUTCOME_VALUE_V1)
      :Number(replay.published_state.root_zone_vwc_fraction.mean);
    const canonicalPayload={
      value,
      unit:'fraction',
      quantity_kind:'VOLUMETRIC_WATER_CONTENT',
      forecast_verification_observation_id:id,
      generation_profile_id:id==='FVO-10'?OUTCOME_PROFILE_ID:PROFILE_ID,
      hidden_parameter_key:id==='FVO-10'
        ?null
        :'dynamics_parameters.drainage_coefficient_per_hour',
      hidden_parameter_value:id==='FVO-10'?null:HIDDEN_PARAMETER,
      source_forecast_ref:forecast.object_id,
      source_forecast_hash:forecast.determinism_hash,
      business_outcome_anchor:id==='FVO-10',
    };
    const roleTime={observed_at:observedAt,ingested_at:availableAt};
    const semantic={
      dataset_id:DATASET_ID,
      source_record_id:id,
      binding_id:'soil_obs_c8_20cm_v1',
      scope,
      role_time:roleTime,
      canonical_payload:canonicalPayload,
      quality_status:qualityStatus,
    };
    const record={
      ...scope,
      dataset_id:DATASET_ID,
      source_record_id:id,
      source_record_hash:product.semanticHashV1(semantic),
      record_type:'soil_moisture_observation_v1',
      binding_id:'soil_obs_c8_20cm_v1',
      origin_source_kind:'CONTROLLED_REPLAY_FIXTURE',
      origin_source_id:'mcft_cap08_stage1a_replay_v2_fvo_source',
      epistemic_class:'OBSERVED',
      available_to_runtime_at:availableAt,
      role_time:roleTime,
      quality:{status:qualityStatus},
      source_payload:{...canonicalPayload,source_version:'2-final-formal-closure'},
      canonical_payload:canonicalPayload,
      source_unit:'fraction',
      canonical_unit:'fraction',
      conversion_rule:{id:'IDENTITY_V1',version:'1'},
      limitations:[
        'CONTROLLED_SYNTHETIC',
        'FINAL_FORMAL_CLOSURE_INPUT',
        'NOT_FIELD_CALIBRATED',
      ],
    };
    await persist(record);
    return record;
  }

  return{
    dataset_id:DATASET_ID,
    profile_id:PROFILE_ID,
    contract_digest:CONTRACT_DIGEST,
    allFvos(){
      return[...generated.values()]
        .sort((left,right)=>left.source_record_id.localeCompare(right.source_record_id));
    },
    async buildFvoFromForecastV1({fvoId,forecast}){
      return buildFvo(fvoId,forecast);
    },
    async loadCandidateRecords(input){
      const due=product.buildCap08S2FormalDueObligationV1(input.logical_time);
      const base=rewriteForcing(
        await baseSource.loadCandidateRecords(input),
        input.logical_time,
        product.CAP08_S1_RUNTIME_START_V1,
        product.semanticHashV1,
      ).filter(record=>record.record_type!=='soil_moisture_observation_v1');
      const observations=[];
      for(const id of due.due_fvo_ids){
        const forecast=await exactForecast(
          addHours(product.CAP08_S1_RUNTIME_START_V1,fvoIndex(id)-1),
        );
        observations.push(await buildFvo(id,forecast));
      }
      return[...base,...observations];
    },
  };
}

module.exports={
  DATASET_ID,
  PROFILE_ID,
  OUTCOME_PROFILE_ID,
  CONTRACT_DIGEST,
  HIDDEN_PARAMETER,
  createFinalFormalEvidenceSourceV1,
};
