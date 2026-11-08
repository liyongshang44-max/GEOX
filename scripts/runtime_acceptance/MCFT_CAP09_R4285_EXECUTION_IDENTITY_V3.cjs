"use strict";
// Execution identity is independent of the reused resource/qualification Run.
// This closed registration is data, never permission to execute or a signer.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const LEGACY="4285c3ce342c",SUCCESSOR="d0b9e7614a25";
const OLD_NONCE="f4160529fa81e0db77f6e3ab69ee35e2ec29886718c02208c2530f6a41a8ebca";
const OLD_SCOPE="b1822674bd11c2b4acfa6594d3eed239d77f40fd8df94afb7bdcd6c068478321";
const rows=Object.freeze({
 [LEGACY]:Object.freeze({run_id:LEGACY,resource_run_id:LEGACY,qualification_run_id:LEGACY,attempt_ordinal:4,parent_run_id:"72dc0304a21a",failed_predecessor_run_id:"6ff9b41f6f7f"}),
 [SUCCESSOR]:Object.freeze({run_id:SUCCESSOR,resource_run_id:LEGACY,qualification_run_id:LEGACY,attempt_ordinal:5,parent_run_id:"72dc0304a21a",failed_predecessor_run_id:LEGACY})
});
function get(run){assert(typeof run==="string"&&Object.hasOwn(rows,run),"V3_EXECUTION_RUN_UNREGISTERED");return rows[run];}
function checkNonce(run,nonce){get(run);assert(/^[a-f0-9]{64}$/.test(nonce),"V3_EXECUTION_NONCE");assert(run!==SUCCESSOR||nonce!==OLD_NONCE,"V3_FAILED_EXECUTION_NONCE_REUSE");}
function checkHistory(root,run){get(run);if(run!==SUCCESSOR)return;
 assert(path.isAbsolute(root),"V3_HISTORY_ROOT_ABSOLUTE");
 // The original failure marker stays in the SAME registered authority root.
 const file=path.join(root,"r4285-v3-preflight-"+OLD_SCOPE+".json");
 for(let at=file;;){const st=fs.lstatSync(at);assert(!st.isSymbolicLink(),"V3_HISTORY_LINK");if(at===file)assert(st.isFile()&&st.nlink===1&&st.size>0&&st.size<=16384,"V3_HISTORY_FILE");const up=path.dirname(at);if(up===at)break;at=up;}
 const raw=fs.readFileSync(file),p=JSON.parse(raw.toString("utf8"));
 assert(p.schema_version==="MCFT_CAP09_R4285_V3_EXECUTION_ATTEMPT_STARTED"&&p.scope_id===OLD_SCOPE&&p.nonce===OLD_NONCE&&p.permit_consumed===false&&p.stage_count===0,"V3_FAILED_EXECUTION_HISTORY_CHANGED");
 assert(!fs.existsSync(path.join(root,"run-"+LEGACY))&&!fs.existsSync(path.join(root,"nonce-"+OLD_NONCE)),"V3_PREDECESSOR_CONSUMPTION_REQUIRES_REVIEW");
 return crypto.createHash("sha256").update(raw).digest("hex");
}
module.exports=Object.freeze({LEGACY,SUCCESSOR,OLD_NONCE,OLD_SCOPE,get,checkNonce,checkHistory});
