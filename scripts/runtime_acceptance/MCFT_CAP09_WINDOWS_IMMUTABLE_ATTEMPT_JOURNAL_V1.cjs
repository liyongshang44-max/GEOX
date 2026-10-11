"use strict";
// Host-only immutable-attempt journal primitive. This does not grant execute.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
function reserveOnce(root,runId,decisionDigest,subject) {
 assert(process.platform==="win32"||process.env.MCFT_CAP09_JOURNAL_SYNTHETIC_TEST==="1","WINDOWS_HOST_ONLY");
 assert(/^[a-f0-9]{12}$/.test(runId),"RUN_ID_REQUIRED");
 assert(/^[a-f0-9]{64}$/.test(decisionDigest),"REVIEWED_DECISION_DIGEST_REQUIRED");
 assert(/^[a-f0-9]{40}$/.test(subject),"SOURCE_SUBJECT_REQUIRED");
 assert(path.isAbsolute(root),"ABSOLUTE_EVIDENCE_ROOT_REQUIRED");
 // The parent directory must be created by a separately authorized setup.
 assert(fs.existsSync(root)&&fs.statSync(root).isDirectory(),"EXISTING_EVIDENCE_ROOT_REQUIRED");
 const file=path.join(root,"mcft-cap09-attempt-"+runId+".reserved.json");
 const record={schema_version:"geox_mcft_cap09_attempt_reservation_v1",run_id:runId,
  subject_sha:subject,decision_sha256:decisionDigest,reserved_at:new Date().toISOString(),
  status:"RESERVED_NO_EXECUTE_ASSERTION"};
 // wx is atomic: a second attempt cannot silently clobber the first receipt.
 fs.writeFileSync(file,JSON.stringify(record,null,2)+"\n",{flag:"wx",mode:0o600});
 return {file,sha256:crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),record};
}
function appendImmutableReceipt(dir,name,data) {
 assert(/^[A-Z0-9_]+\.json$/.test(name),"IMMUTABLE_RECEIPT_NAME_REQUIRED");
 assert(fs.existsSync(dir)&&fs.statSync(dir).isDirectory(),"EXISTING_ATTEMPT_DIR_REQUIRED");
 const file=path.join(dir,name);
 const bytes=Buffer.from(JSON.stringify(data,null,2)+"\n");
 fs.writeFileSync(file,bytes,{flag:"wx",mode:0o600});
 return {file,sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
}
module.exports={reserveOnce,appendImmutableReceipt};
