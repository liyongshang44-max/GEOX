"use strict";
const assert=require("node:assert/strict");
const TRANSIENT_CODES=new Set(["ETIMEDOUT","ECONNRESET","ECONNREFUSED","EPIPE","EAI_AGAIN","ENOTFOUND","57P01","57P02","57P03","08000","08001","08003","08006"]);
function isTransientReadError(error){
 const code=String(error?.code??"").toUpperCase();
 const message=String(error?.message??error??"");
 return TRANSIENT_CODES.has(code)||/^(Query read timeout|Connection terminated unexpectedly|Connection terminated due to connection timeout|Connection timeout|timeout exceeded when trying to connect)$/i.test(message);
}
async function pollExactPair({readRows,validate,deadlineMs,now=Date.now,sleep,intervalMs=15000,maxConsecutiveTransient=3,onTransient=()=>{}}){
 assert.equal(typeof readRows,"function");assert.equal(typeof validate,"function");
 assert.equal(typeof sleep,"function");assert.equal(typeof now,"function");
 assert.ok(Number.isFinite(deadlineMs)&&Number.isSafeInteger(maxConsecutiveTransient)&&maxConsecutiveTransient>=1);
 let consecutive=0,transientCount=0,pollCount=0,lastRows=[];
 while(now()<deadlineMs){
  let rows;
  try{
   rows=await readRows();
  }catch(error){
   if(!isTransientReadError(error))throw error;
   consecutive++;transientCount++;
   onTransient({count:transientCount,consecutive,code:String(error?.code??""),message:String(error?.message??error).slice(0,240)});
   if(consecutive>=maxConsecutiveTransient)throw new Error("AM22_GFS_BOOTSTRAP_TRANSIENT_DB_RETRY_LIMIT:"+consecutive,{cause:error});
   if(now()>=deadlineMs)break;
   await sleep(Math.min(intervalMs,Math.max(0,deadlineMs-now())));
   continue;
  }
  pollCount++;consecutive=0;lastRows=rows;
  if(now()>=deadlineMs)break;
  assert.ok(Array.isArray(rows),"AM22_GFS_BOOTSTRAP_PAIR_QUERY_SHAPE_INVALID");
  if(rows.length>2)throw new Error("AM22_GFS_BOOTSTRAP_DUPLICATE_PAIR_ROWS");
  if(rows.length===2){
   const pair=validate(rows); // invalid identity, provenance or cycle is a hard failure
   if(now()>=deadlineMs)break;
   return {pair,lastRows,pollCount,transientCount};
  }
  await sleep(Math.min(intervalMs,Math.max(0,deadlineMs-now())));
 }
 return {pair:null,lastRows,pollCount,transientCount};
}
module.exports={isTransientReadError,pollExactPair};
