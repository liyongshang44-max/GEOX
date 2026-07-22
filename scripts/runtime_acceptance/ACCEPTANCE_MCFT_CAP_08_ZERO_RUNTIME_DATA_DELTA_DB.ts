import fs from "node:fs";
import path from "node:path";
import pg from "pg";
const {Pool}=pg;
const baselinePath="acceptance-output/MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json";
const outPath="acceptance-output/MCFT_CAP_08_ZERO_RUNTIME_DATA_DELTA_DB_RESULT.json";
function out(v:unknown){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,`${JSON.stringify(v,null,2)}\n`);}
async function main(){const baseline=JSON.parse(fs.readFileSync(baselinePath,"utf8"));if(baseline.status!=="PASS")throw new Error("PLATFORM_BASELINE_NOT_PASS");const root=String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL||"postgres://postgres:postgres@127.0.0.1:5432/postgres");const name=String(process.env.MCFT_CAP08_TARGET_DATABASE_NAME||"geox_mcft_cap08_s0_acceptance");const u=new URL(root);u.pathname=`/${name}`;const pool=new Pool({connectionString:u.toString(),max:1});try{const after:Record<string,number>={};for(const relation of Object.keys(baseline.canonical_relation_counts_after)){after[relation]=Number((await pool.query(`SELECT count(*)::int AS n FROM public.${relation}`)).rows[0].n);}if(JSON.stringify(after)!==JSON.stringify(baseline.canonical_relation_counts_after))throw new Error("CANONICAL_RUNTIME_DATA_DELTA");out({status:"PASS",database_name:name,counts:after,zero_runtime_data_delta:true});}finally{await pool.end();}}
main().catch(e=>{out({status:"FAIL",error:e instanceof Error?e.message:String(e)});throw e;});
