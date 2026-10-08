import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  MCFT_CAP09_FORMAL_V5_DATABASE_V1,
  validateMcftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

const OUTPUT=path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_DOWNSTREAM_ZERO_V1.json");

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function required(value:unknown,code:string):string{
  const text=String(value??"").trim();
  if(!text)throw new Error(code);
  return text;
}
function write(value:unknown):void{
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(value,null,2)+"\n");
  process.stdout.write(JSON.stringify(value,null,2)+"\n");
}
function selftest():void{
  write({
    schema_version:"geox_mcft_cap09_formal_v5_downstream_zero_selftest_v1",
    status:"PASS",
    formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
    predicates:["decision_records","approved_plans","action_feedback_rows","downstream_named_facts"],
    read_only:true,
    database_write_count:0,
    mcft_cap09_completed:false,
  });
}
async function run():Promise<void>{
  const armPath=path.resolve(required(arg("--arm"),"FORMAL_V5_DOWNSTREAM_ZERO_ARM_PATH_REQUIRED"));
  if(!fs.existsSync(armPath))throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_ARM_FILE_MISSING");
  const arm=JSON.parse(fs.readFileSync(armPath,"utf8"));
  validateMcftCap09FormalV5ArmV1(arm);

  const databaseUrl=required(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL,"FORMAL_V5_DOWNSTREAM_ZERO_DATABASE_URL_REQUIRED");
  const url=new URL(databaseUrl);
  if(!["postgres:","postgresql:"].includes(url.protocol))throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_POSTGRES_URL_REQUIRED");
  if(decodeURIComponent(url.pathname.replace(/^\//,""))!==MCFT_CAP09_FORMAL_V5_DATABASE_V1){
    throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_EXACT_V5_DATABASE_REQUIRED");
  }

  const pool=new Pool({connectionString:databaseUrl,max:1,application_name:"mcft-cap09-formal-v5-downstream-zero"});
  const client=await pool.connect();
  try{
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity=(await client.query<{db:string;read_only:string}>(
      "SELECT current_database()::text AS db,current_setting('transaction_read_only')::text AS read_only"
    )).rows[0];
    if(!identity)throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_DATABASE_IDENTITY_REQUIRED");
    if(identity.db!==MCFT_CAP09_FORMAL_V5_DATABASE_V1)throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_SESSION_DATABASE_MISMATCH");
    if(identity.read_only!=="on")throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_READ_ONLY_REQUIRED");

    const row=(await client.query(`SELECT
      (SELECT count(*)::int FROM twin_decision_record_projection_v1) AS decision_records,
      (SELECT count(*)::int FROM twin_approved_plan_binding_projection_v1) AS approved_plans,
      ((SELECT count(*)::int FROM twin_action_feedback_projection_v1)
       +(SELECT count(*)::int FROM twin_action_feedback_evidence_index_v1)
       +(SELECT count(*)::int FROM twin_action_feedback_cycle_projection_v1)) AS action_feedback_rows,
      (SELECT count(*)::int FROM facts WHERE lower(record_json->>'type') ~ '(decision|recommend|approval|action|dispatch|model_activation)') AS downstream_named_facts`)).rows[0]??{};
    const counts={
      decision_records:Number(row.decision_records??-1),
      approved_plans:Number(row.approved_plans??-1),
      action_feedback_rows:Number(row.action_feedback_rows??-1),
      downstream_named_facts:Number(row.downstream_named_facts??-1),
    };
    if(Object.values(counts).some((value)=>value!==0)){
      throw new Error("FORMAL_V5_DOWNSTREAM_SIDE_EFFECT_DETECTED:"+JSON.stringify(counts));
    }
    await client.query("COMMIT");
    write({
      schema_version:"geox_mcft_cap09_formal_v5_downstream_zero_v1",
      status:"PASS",
      runtime_semantic_subject_sha:arm.subject_sha,
      formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
      ...counts,
      read_only_transaction:true,
      database_write_count:0,
      scheduler_write_count:0,
      runtime_write_count:0,
      downstream_zero_pass:true,
      mcft_cap09_completed:false,
    });
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}
const mode=process.argv[2];
if(mode==="selftest")selftest();
else if(mode==="run")run().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
else throw new Error("FORMAL_V5_DOWNSTREAM_ZERO_MODE_REQUIRED:selftest|run");
