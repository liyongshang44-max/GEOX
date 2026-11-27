import type {FastifyInstance} from 'fastify';
import {ManagerAuthorityErrorV1,type ManagerAuthorizerV1} from '../auth/manager_authority_v1.js';
import {readHistoricalForecastV1,type HistoricalForecastConfigV1} from '../product_projection/customer/manager_historical_forecast_v1.js';
export function registerManagerHistoricalForecastV1(app:FastifyInstance,authority:ManagerAuthorizerV1,config?:HistoricalForecastConfigV1){
 app.get('/api/v1/manager/fields/:field_id/historical-forecast',async(req,reply)=>{
  reply.header('cache-control','no-store');
  const {field_id}=req.params as {field_id:string};
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(field_id))return reply.code(404).send({ok:false,error:'NOT_FOUND'});
  if(Object.keys((req.query??{}) as object).length)return reply.code(400).send({ok:false,error:'QUERY_INVALID'});
  const token=/^Bearer ([^\s]+)$/i.exec(String(req.headers.authorization??''))?.[1];
  if(!token)return reply.code(401).send({ok:false,error:'MANAGER_CREDENTIAL_REQUIRED'});
  try{
   const a=await authority.authorize(token,field_id,'READ_FIELD_GEOMETRY');
   const result=await readHistoricalForecastV1(a,config);
   authority.assertCurrent(a,field_id,'READ_FIELD_GEOMETRY');
   return reply.send({ok:true,...result});
  }catch(e){
   if(e instanceof ManagerAuthorityErrorV1)return reply.code(e.status).send({ok:false,error:e.message});
   return reply.code(503).send({ok:false,error:'HISTORICAL_FORECAST_UNAVAILABLE'});
  }
 });
}
