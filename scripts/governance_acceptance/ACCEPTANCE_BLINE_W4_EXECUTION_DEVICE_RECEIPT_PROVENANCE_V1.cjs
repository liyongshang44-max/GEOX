const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const ACCEPTED="f23cc22eb8158a1d9840f042f13ad3fd27b5fe8a";
const GATE="scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs";
function sh(args,opts={}){return cp.execFileSync("git",args,{encoding:"utf8",...opts}).trim();}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}

const head=sh(["rev-parse","HEAD"]);
assert(head!==ACCEPTED,"W4 successor dispatcher must not replace the historical accepted-head gate");
try { cp.execFileSync("git",["merge-base","--is-ancestor",ACCEPTED,head],{stdio:"ignore"}); }
catch { throw new Error(`W4 successor is not descended from accepted head: ${head}`); }

const protectedFiles=[
  "docs/architecture/semantic_convergence/GEOX-BLINE-W4-EXECUTION-DEVICE-RECEIPT-PROVENANCE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json",
  "docker-compose.commercial_v1.yml",
  "config/auth/security_acceptance_tokens.json",
  "apps/executor/src/runtime_loop.ts",
  "apps/executor/src/run_dispatch_once.ts",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/auth/device_credential_auth_v1.ts",
  "apps/server/src/routes/device_heartbeat_v1.ts",
  "apps/server/src/routes/sensing_fact_envelope_v1.ts",
  "apps/server/src/routes/control_ao_sense.ts",
  "apps/server/src/domain/controlplane/task_service.ts",
  "apps/server/src/routes/control_ao_act.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
  "apps/server/src/routes/fail_safe_v1.ts",
  "apps/server/src/routes/v1/operator_dispatch_actions.ts",
  "apps/server/scripts/p1_smoke_device_ready.mjs",
  "apps/server/scripts/p1_skill_loop_minimal.mjs",
  "scripts/acceptance/p1_device_identity_fixture.cjs",
  "scripts/acceptance/run_acceptance.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_P1_SMOKE_PREFLIGHT_IDEMPOTENT_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_COMMERCIAL_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts"
];
const drift=sh(["diff","--name-only",ACCEPTED,head,"--",...protectedFiles]).split(/\r?\n/).filter(Boolean);
assert(drift.length===0,"W4 protected source/artifact drift in successor workstream",drift);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"geox-w4-accepted-"));
try {
  cp.execFileSync("git",["worktree","add","--detach",tmp,ACCEPTED],{stdio:"ignore"});
  cp.execFileSync(process.execPath,[GATE],{cwd:tmp,stdio:"inherit"});
} finally {
  try { cp.execFileSync("git",["worktree","remove","--force",tmp],{stdio:"ignore"}); } catch {}
  try { fs.rmSync(tmp,{recursive:true,force:true}); } catch {}
}

console.log(JSON.stringify({
  result:"PASS",
  workstream:"W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_SUCCESSOR_PRESERVATION",
  accepted_head:ACCEPTED,
  successor_head:head,
  protected_file_count:protectedFiles.length,
  protected_drift:0,
  historical_exact_head_gate_replayed:true
},null,2));
