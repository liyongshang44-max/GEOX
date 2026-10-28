"use strict";
/*
 * Windows-only explicit Attempt-3 Host V2 entrypoint. No implicit execution.
 * --preflight-only never consumes a Permit. --execute requires an operator
 * action and real independently signed adoption, full-chain, resource owner,
 * Permit and staged material. Nothing launches on CI/Linux.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const host=require("./MCFT_CAP09_ATTEMPT3_HOST_V2.cjs");
const REQUIRED=["--input","--operator-authorized","--attempt3-v2"];
function parse(args){
 assert(Array.isArray(args)&&args.length>0,"V2_CLI_ARGS_REQUIRED");
 const i=args.indexOf("--input");
 assert(i>=0&&i+1<args.length,"V2_CLI_INPUT_REQUIRED");
 const file=args[i+1];
 assert(path.isAbsolute(file),"V2_CLI_INPUT_ABSOLUTE_REQUIRED");
 const flags=args.filter((x,j)=>j!==i+1);
 assert(new Set(flags).size===flags.length,"V2_CLI_DUPLICATE_FLAG");
 for(const k of REQUIRED)assert(flags.includes(k),"V2_CLI_MISSING:"+k);
 assert(flags.includes("--execute")!==flags.includes("--preflight-only"),
  "V2_CLI_EXPLICIT_SINGLE_MODE_REQUIRED");
 assert(flags.every(x=>[...REQUIRED,"--execute","--preflight-only"].includes(x)),"V2_CLI_UNKNOWN_ARG");
 return {file,execute:flags.includes("--execute")};
}
function read(file){
 const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=8*1024*1024,"V2_CLI_INPUT_UNSAFE");
 return JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));
}
async function run(args,environment=process.env){
 assert(process.platform==="win32"&&!environment.CI&&!environment.GITHUB_ACTIONS,"V2_WINDOWS_HOST_ONLY");
 assert(!environment.MCFT_GOVERNED_RETRY_STAGE&&!environment.MCFT_ATTEMPT3_V2_CHILD,
  "V2_PARENT_CANNOT_REUSE_CHILD_ENV");
 const opt=parse(args);
 const input=read(opt.file);
 assert.deepEqual(Object.keys(input).sort(),
  ["admission","plan","observed","outputRoot","firstBase"].sort(),"V2_CLI_INPUT_FIELDS");
 assert(path.isAbsolute(input.outputRoot),"V2_CLI_OUTPUT_ABSOLUTE_REQUIRED");
 if(opt.execute)return host.execute({...input,environment});
 return host.preflight({...input,environment});
}
if(require.main===module)run(process.argv.slice(2)).then(x=>{
 console.log(JSON.stringify(x));
}).catch(e=>{
 console.error(JSON.stringify({status:"ATTEMPT3_V2_WINDOWS_HOLD",
  reason_code:String(e.message||e).slice(0,350),
  permit_consumed:"UNKNOWN_CHECK_DURABLE_LEDGER",original_six_stages_executed:"UNKNOWN_INSPECT_REAL_RECEIPTS",
  production_authorized:false}));
 process.exitCode=1;
});
module.exports={parse,run};
