"use strict";
// Offline-only regression: Node built-ins, no network, no real PG/S3,
// no Provider and no execution authority.
const test = require("node:test");
const assert = require("node:assert/strict");
const {setTimeout: sleep} = require("node:timers/promises");
const {createStage3TestOnlyDualHeartbeatV1: create} = require("./MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.cjs");

function environment(overrides = {}) {
  const expires = () => new Date(Date.now() + 5000).toISOString();
  const controller = {
    epoch_id:"ep-test",subject_sha:"a".repeat(40),lease_owner:"stage3-test-controller",
    fencing_token:1n,lease_expires_at:expires()
  };
  const claim = {
    epoch_id:"ep-test",subject_sha:"a".repeat(40),lease_owner:"stage3-test-producer",
    fencing_token:7n,base_target_t:new Date(Date.now() + 3600000).toISOString(),
    idempotency_key:"test-fixture-idempotency",lease_expires_at:expires()
  };
  const counts = {controller:0,producer:0};
  const lifecycle = {
    async acquireOrRenew({lease_owner,lease_duration_seconds}) {
      counts.controller++;
      assert.equal(lease_owner,controller.lease_owner);
      assert.equal(lease_duration_seconds,3);
      const result = {status:"RENEWED",lease:{...controller,lease_expires_at:expires()}};
      return overrides.controller ? overrides.controller(result) : result;
    }
  };
  const continuity = {
    async heartbeatClaimUnderController({controller_lease,claim:current,lease_duration_seconds}) {
      counts.producer++;
      assert.equal(String(controller_lease.fencing_token),"1");
      assert.equal(current.idempotency_key,claim.idempotency_key);
      assert.equal(lease_duration_seconds,3);
      const result = {...claim,lease_expires_at:expires()};
      return overrides.producer ? overrides.producer(result) : result;
    }
  };
  const guard = () => create({
    lifecycle,continuity,initial_controller_lease:controller,initial_producer_claim:claim,
    lease_duration_seconds:3,heartbeat_interval_ms:10
  });
  return {guard,counts,controller,claim,lifecycle,continuity};
}
test("long-running capture heartbeats BOTH leases and preserves the two fences", async()=>{
  const e=environment(),h=e.guard();
  const result=await h.run(async snapshot=>{
    assert.equal(snapshot().producer_claim.idempotency_key,e.claim.idempotency_key);
    await sleep(65);
    return {status:"CONTROLLED_CAPTURE_FINISHED"};
  });
  assert.equal(result.status,"CONTROLLED_CAPTURE_FINISHED");
  assert(e.counts.controller>=3);
  assert(e.counts.producer>=3);
  assert.equal(e.counts.controller,e.counts.producer);
  const evidence=h.evidence();
  assert.equal(evidence.controller_fence,"1");
  assert.equal(evidence.producer_fence,"7");
  assert.equal(evidence.permit_consumed,false);
  assert.equal(evidence.original_v13_stage_executed,false);
  assert.equal(evidence.production_authorized,false);
});
test("controller TAKEOVER, including a forged same fence, fails closed", async()=>{
  const e=environment({controller:r=>({...r,status:"TAKEN_OVER"})});
  await assert.rejects(
    e.guard().run(async()=>{await sleep(35);}),
    /STAGE3_HEARTBEAT_CONTROLLER_RENEWAL_NOT_OWNED/
  );
});
test("controller token drift fails closed, no producer renewal proceeds", async()=>{
  const e=environment({controller:r=>({...r,lease:{...r.lease,fencing_token:2n}})});
  await assert.rejects(e.guard().run(async()=>{await sleep(35);}),/STAGE3_HEARTBEAT_CONTROLLER_FENCE_CHANGED/);
  assert.equal(e.counts.producer,0);
});
test("producer token drift fails closed", async()=>{
  const e=environment({producer:r=>({...r,fencing_token:8n})});
  await assert.rejects(e.guard().run(async()=>{await sleep(35);}),/STAGE3_HEARTBEAT_CLAIM_FENCE_CHANGED/);
});
test("producer changed base/idempotency or expired deadline is never accepted", async()=>{
  const e=environment({producer:r=>({...r,idempotency_key:"tampered"})});
  await assert.rejects(e.guard().run(async()=>{await sleep(35);}),/STAGE3_HEARTBEAT_CLAIM_IDEMPOTENCY_CHANGED/);
  const e2=environment({producer:r=>({...r,lease_expires_at:new Date(Date.now()-1000).toISOString()})});
  await assert.rejects(e2.guard().run(async()=>{await sleep(35);}),/STAGE3_HEARTBEAT_CLAIM_EXPIRED/);
});
test("underlying business-operation failure is preserved, not promoted to success",async()=>{
  const e=environment();
  await assert.rejects(e.guard().run(async()=>{
    await sleep(35);
    throw new Error("REAL_CAPTURE_FAILED_AND_NO_FORMAL_PASS");
  }),/REAL_CAPTURE_FAILED_AND_NO_FORMAL_PASS/);
});
test("strict lease bounds and interval; no implicit widening to 43 minutes",()=>{
  const e=environment();
  assert.throws(()=>create({
    lifecycle:e.lifecycle,continuity:e.continuity,
    initial_controller_lease:e.controller,initial_producer_claim:e.claim,
    lease_duration_seconds:1801,heartbeat_interval_ms:10
  }),/STAGE3_HEARTBEAT_MAX_LEASE_1800/);
  assert.throws(()=>create({
    lifecycle:e.lifecycle,continuity:e.continuity,
    initial_controller_lease:e.controller,initial_producer_claim:e.claim,
    lease_duration_seconds:3,heartbeat_interval_ms:3000
  }),/STAGE3_HEARTBEAT_INTERVAL_INVALID/);
});

test("revoked controller aborts the Provider signal and denies later S3 write",async()=>{
  const e=environment({controller:r=>({...r,status:"TAKEN_OVER"})}),h=e.guard();
  let wrote=0, aborted=false;
  await assert.rejects(h.run(async({assertLive,signal})=>{
    assertLive();
    await sleep(35);
    aborted=signal.aborted;
    assertLive();wrote++;
  }),/STAGE3_HEARTBEAT_CONTROLLER_RENEWAL_NOT_OWNED/);
  assert.equal(wrote,0);
  assert.equal(aborted,true);
  assert.match(h.evidence().failure_code,/CONTROLLER_RENEWAL_NOT_OWNED/);
  assert(h.evidence().event_log.some(x=>x.kind==="FAIL"));
});
test("revoked producer aborts before candidate or promotion after slow decoder",async()=>{
  const e=environment({producer:r=>({...r,fencing_token:8n})}),h=e.guard();
  let promoted=0;
  await assert.rejects(h.run(async({assertLive})=>{
    await sleep(35);
    assertLive();promoted++;
  }),/STAGE3_HEARTBEAT_CLAIM_FENCE_CHANGED/);
  assert.equal(promoted,0);
});
test("expired initial claim does not strand running lock; failed instance cannot restart",async()=>{
  const e=environment();
  e.claim.lease_expires_at=new Date(Date.now()-1000).toISOString();
  const h=e.guard();
  await assert.rejects(h.run(async()=>{}),/STAGE3_HEARTBEAT_CLAIM_EXPIRED/);
  await assert.rejects(h.run(async()=>{}),/STAGE3_HEARTBEAT_FAILED_INSTANCE_NOT_REUSABLE/);
});
test("deadline margin and whole-run watchdog both halt side effects",async()=>{
  const e=environment();
  const h=create({
    lifecycle:e.lifecycle,continuity:e.continuity,initial_controller_lease:e.controller,
    initial_producer_claim:e.claim,lease_duration_seconds:3,heartbeat_interval_ms:10,
    max_run_ms:26,base_deadline_margin_ms:0
  });
  let writes=0;
  await assert.rejects(h.run(async({assertLive,signal})=>{
    await sleep(50);
    assert.equal(signal.aborted,true);
    assertLive();writes++;
  }),/STAGE3_HEARTBEAT_WALL_BUDGET_EXPIRED/);
  assert.equal(writes,0);
  assert(h.evidence().event_log.some(x=>x.kind==="FAIL"));
});
test("budget cannot be disabled or widened beyond policy",()=>{
  const e=environment();
  const args={lifecycle:e.lifecycle,continuity:e.continuity,initial_controller_lease:e.controller,
    initial_producer_claim:e.claim,lease_duration_seconds:3,heartbeat_interval_ms:10};
  assert.throws(()=>create({...args,max_run_ms:5400001}),/STAGE3_HEARTBEAT_BUDGET_INVALID/);
  assert.throws(()=>create({...args,base_deadline_margin_ms:-1}),/STAGE3_HEARTBEAT_MARGIN_INVALID/);
});
test("post-commit worker exception never produces a success report",async()=>{
  const e=environment(),h=e.guard();
  let committed=false,attested=false;
  await assert.rejects(h.run(async({assertLive})=>{
    assertLive();committed=true;
    await sleep(15);
    assertLive();throw Error("PHYSICAL_POST_COMMIT_ATTESTATION_UNCERTAIN");
  }),/PHYSICAL_POST_COMMIT_ATTESTATION_UNCERTAIN/);
  assert.equal(committed,true);
  assert.equal(attested,false);
  assert.match(h.evidence().failure_code,/PHYSICAL_POST_COMMIT/);
});
