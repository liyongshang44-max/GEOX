"use strict";
// Stage3 NONAUTHORIZING TEST_ONLY dual-lease heartbeat / bounded fail-closed I/O guard.
// Requires caller to invoke assertLive() at every Provider/S3/PG phase seam;
// abort signal cancels cooperative Provider fetches, not arbitrary Python subprocesses.
// No API here issues Host/Adoption/Permit authority.
const assert = require("node:assert/strict");
const iso = value => new Date(value).toISOString();
function expiry(value, label, now) {
  const t = Date.parse(value);
  assert(Number.isFinite(t) && t > now, "STAGE3_HEARTBEAT_" + label + "_EXPIRED");
  return t;
}
function identity(controller, claim, originalController, originalClaim, now, marginMs) {
  for (const k of ["epoch_id","subject_sha","lease_owner","fencing_token"]) {
    assert.equal(String(controller[k]), String(originalController[k]), "STAGE3_HEARTBEAT_CONTROLLER_" + (k==="fencing_token"?"FENCE":k==="idempotency_key"?"IDEMPOTENCY":k.toUpperCase()) + "_CHANGED");
  }
  for (const k of ["epoch_id","subject_sha","lease_owner","base_target_t","causal_deadline","idempotency_key","fencing_token"]) {
    assert.equal(String(claim[k]), String(originalClaim[k]), "STAGE3_HEARTBEAT_CLAIM_" + (k==="fencing_token"?"FENCE":k==="idempotency_key"?"IDEMPOTENCY":k.toUpperCase()) + "_CHANGED");
  }
  expiry(controller.lease_expires_at,"CONTROLLER",now);
  expiry(claim.lease_expires_at,"CLAIM",now);
  const base = expiry(claim.base_target_t,"BASE_DEADLINE",now);
  assert(base - now > marginMs,"STAGE3_HEARTBEAT_CAUSAL_MARGIN_EXHAUSTED");
}
function createStage3TestOnlyDualHeartbeatV1(input) {
  assert(input && typeof input === "object", "STAGE3_HEARTBEAT_CONFIG_REQUIRED");
  const {lifecycle,continuity,initial_controller_lease:ic,initial_producer_claim:ip} = input;
  assert(typeof lifecycle?.acquireOrRenew === "function" && typeof continuity?.heartbeatClaimUnderController === "function","STAGE3_HEARTBEAT_DELEGATES_REQUIRED");
  const duration = input.lease_duration_seconds ?? 1800;
  const interval = input.heartbeat_interval_ms ?? 60000;
  const budget = input.max_run_ms ?? 3600000;
  const margin = input.base_deadline_margin_ms ?? 900000;
  const clock = input.clock ?? (()=>Date.now());
  const onEvent=input.on_event??null;
  assert(onEvent===null||typeof onEvent==="function","STAGE3_HEARTBEAT_JOURNAL_CALLBACK_INVALID");
  assert(Number.isInteger(duration) && duration > 0 && duration <= 1800,"STAGE3_HEARTBEAT_MAX_LEASE_1800");
  assert(Number.isInteger(interval) && interval > 0 && interval < duration*1000,"STAGE3_HEARTBEAT_INTERVAL_INVALID");
  assert(Number.isInteger(budget) && budget > interval && budget <= 5400000,"STAGE3_HEARTBEAT_BUDGET_INVALID");
  assert(Number.isInteger(margin) && margin >= 0 && margin <= 3600000,"STAGE3_HEARTBEAT_MARGIN_INVALID");
  let controller = ic, claim = ip, running = false, failure = null, started = null;
  let controllerCount = 0, claimCount = 0, stop = false, wake = ()=>{};
  const ac = new AbortController();
  const events = [];
  function record(kind, code) {
    // Finite retention; bounded even if a caller configures tiny heartbeat intervals.
    if(events.length >= 256) throw new Error("STAGE3_HEARTBEAT_EVENT_BUDGET_EXCEEDED");
    const event={seq:events.length+1,at:new Date(clock()).toISOString(),kind,code};
    // The Windows runner fsyncs the append-only per-run journal before renewal
    // can be treated as successful. Failure is not silently ignored.
    if(onEvent)onEvent(event);
    events.push(event);
  }
  function fail(error) {
    if(!failure) {
      failure = error instanceof Error ? error : new Error(String(error));
      try {record("FAIL",String(failure.message).slice(0,96));} catch {}
      ac.abort(failure);
    }
  }
  function assertLive() {
    if(failure) throw failure;
    if(ac.signal.aborted) throw ac.signal.reason || new Error("STAGE3_HEARTBEAT_ABORTED");
    const now=clock();
    if(started!==null && now-started >= budget) {
      fail(new Error("STAGE3_HEARTBEAT_WALL_BUDGET_EXPIRED")); throw failure;
    }
    try { identity(controller,claim,ic,ip,now,margin); }
    catch(e){fail(e);throw failure;}
    return {controller_lease:controller,producer_claim:claim};
  }
  const snapshot=()=>assertLive();
  const evidence=()=>({
    schema_version:"geox_mcft_cap09_stage3_test_only_dual_lease_heartbeat_v2",
    controller_heartbeat_count:controllerCount,
    producer_heartbeat_count:claimCount,
    controller_fence:String(controller.fencing_token),
    producer_fence:String(claim.fencing_token),
    run_started_at:started===null?null:new Date(started).toISOString(),
    run_deadline_at:started===null?null:new Date(started+budget).toISOString(),
    last_controller_expiry:controller.lease_expires_at,
    last_producer_expiry:claim.lease_expires_at,
    event_log:events.map(e=>({...e})),
    failure_code:failure?.message ?? null,
    on_event_durable_required:!!onEvent,
    original_v13_stage_executed:false,permit_consumed:false,production_authorized:false
  });
  async function run(work) {
    assert(typeof work==="function","STAGE3_HEARTBEAT_WORK_REQUIRED");
    assert(!running,"STAGE3_HEARTBEAT_CONCURRENT_RUN_FORBIDDEN");
    assert(!failure,"STAGE3_HEARTBEAT_FAILED_INSTANCE_NOT_REUSABLE");
    running=true; started=clock(); stop=false;
    try {assertLive();record("RUN","START");}
    catch(e){fail(e);running=false;throw e;}
    // Abort budget even when the caller is awaiting a network operation.
    const watchdog=setTimeout(()=>fail(new Error("STAGE3_HEARTBEAT_WALL_BUDGET_EXPIRED")),budget);
    const loop=(async()=>{
      while(!stop && !failure) {
        await new Promise(resolve=>{
          let settled=false;
          const finish=()=>{if(settled)return;settled=true;wake=()=>{};resolve();};
          const timer=setTimeout(finish,interval);
          wake=()=>{clearTimeout(timer);finish();};
        });
        if(stop||failure) break;
        try {
          assertLive();
          const renewed=await lifecycle.acquireOrRenew({
            lease_owner:ic.lease_owner,lease_duration_seconds:duration
          });
          assert.equal(renewed.status,"RENEWED","STAGE3_HEARTBEAT_CONTROLLER_RENEWAL_NOT_OWNED");
          identity(renewed.lease,claim,ic,ip,clock(),margin);
          controller=renewed.lease;controllerCount++;record("CONTROLLER","RENEWED");
          const renewedClaim=await continuity.heartbeatClaimUnderController({
            controller_lease:controller,claim,lease_duration_seconds:duration
          });
          identity(controller,renewedClaim,ic,ip,clock(),margin);
          claim=renewedClaim;claimCount++;record("PRODUCER","RENEWED");
        }catch(e){fail(e);stop=true;}
      }
    })();
    let result,workError=null;
    try { result=await work({snapshot,assertLive,signal:ac.signal,evidence}); }
    catch(e){workError=e;fail(e);}
    finally {stop=true;wake();clearTimeout(watchdog);await loop;running=false;record("RUN","STOP");}
    if(workError) throw workError;
    assertLive();
    return result;
  }
  return {run,snapshot,assertLive,evidence,signal:ac.signal};
}
module.exports={createStage3TestOnlyDualHeartbeatV1};
