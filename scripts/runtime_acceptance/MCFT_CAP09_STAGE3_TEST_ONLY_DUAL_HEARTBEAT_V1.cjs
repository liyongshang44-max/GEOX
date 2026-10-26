"use strict";
/**
 * Stage3 Windows-only, TEST_ONLY dual-lease heartbeat. No Provider/PG/S3 access
 * of its own. The only writes are the delegated, pre-existing controller
 * renewal and fenced producer claim heartbeat calls on an isolated database.
 * No production Host, Adoption, Permit, or original V13 stage authority.
 */
const assert = require("node:assert/strict");

function isFuture(value, label) {
  const t = Date.parse(value);
  assert(Number.isFinite(t) && t > Date.now(), "STAGE3_HEARTBEAT_" + label + "_EXPIRED");
}
function leaseIdentity(controller, claim, initialController, initialClaim) {
  assert.equal(controller.epoch_id, initialController.epoch_id, "STAGE3_HEARTBEAT_CONTROLLER_EPOCH_CHANGED");
  assert.equal(controller.subject_sha, initialController.subject_sha, "STAGE3_HEARTBEAT_CONTROLLER_SUBJECT_CHANGED");
  assert.equal(controller.lease_owner, initialController.lease_owner, "STAGE3_HEARTBEAT_CONTROLLER_OWNER_CHANGED");
  assert.equal(String(controller.fencing_token), String(initialController.fencing_token), "STAGE3_HEARTBEAT_CONTROLLER_FENCE_CHANGED");
  assert.equal(claim.epoch_id, initialClaim.epoch_id, "STAGE3_HEARTBEAT_CLAIM_EPOCH_CHANGED");
  assert.equal(claim.subject_sha, initialClaim.subject_sha, "STAGE3_HEARTBEAT_CLAIM_SUBJECT_CHANGED");
  assert.equal(claim.lease_owner, initialClaim.lease_owner, "STAGE3_HEARTBEAT_CLAIM_OWNER_CHANGED");
  assert.equal(claim.base_target_t, initialClaim.base_target_t, "STAGE3_HEARTBEAT_CLAIM_BASE_CHANGED");
  assert.equal(claim.idempotency_key, initialClaim.idempotency_key, "STAGE3_HEARTBEAT_CLAIM_IDEMPOTENCY_CHANGED");
  assert.equal(String(claim.fencing_token), String(initialClaim.fencing_token), "STAGE3_HEARTBEAT_CLAIM_FENCE_CHANGED");
  isFuture(controller.lease_expires_at, "CONTROLLER");
  isFuture(claim.lease_expires_at, "CLAIM");
  isFuture(claim.base_target_t, "BASE_DEADLINE");
}
function createStage3TestOnlyDualHeartbeatV1(input) {
  assert(input && typeof input === "object", "STAGE3_HEARTBEAT_CONFIG_REQUIRED");
  const {lifecycle, continuity, initial_controller_lease, initial_producer_claim} = input;
  assert(lifecycle && typeof lifecycle.acquireOrRenew === "function", "STAGE3_HEARTBEAT_LIFECYCLE_REQUIRED");
  assert(continuity && typeof continuity.heartbeatClaimUnderController === "function", "STAGE3_HEARTBEAT_CONTINUITY_REQUIRED");
  const duration = input.lease_duration_seconds === undefined ? 1800 : input.lease_duration_seconds;
  const interval = input.heartbeat_interval_ms === undefined ? 60000 : input.heartbeat_interval_ms;
  assert(Number.isInteger(duration) && duration > 0 && duration <= 1800, "STAGE3_HEARTBEAT_MAX_LEASE_1800");
  assert(Number.isInteger(interval) && interval > 0 && interval < duration * 1000, "STAGE3_HEARTBEAT_INTERVAL_INVALID");
  const originalController = initial_controller_lease;
  const originalClaim = initial_producer_claim;
  let controller = originalController, claim = originalClaim;
  let controllerCount = 0, claimCount = 0, running = false;
  leaseIdentity(controller, claim, originalController, originalClaim);
  const evidence = () => ({
    schema_version: "geox_mcft_cap09_stage3_test_only_dual_lease_heartbeat_v1",
    controller_heartbeat_count: controllerCount,
    producer_heartbeat_count: claimCount,
    controller_fence: String(controller.fencing_token),
    producer_fence: String(claim.fencing_token),
    last_controller_expiry: controller.lease_expires_at,
    last_producer_expiry: claim.lease_expires_at,
    original_v13_stage_executed: false,
    permit_consumed: false,
    production_authorized: false,
  });
  const snapshot = () => {
    leaseIdentity(controller, claim, originalController, originalClaim);
    return {controller_lease: controller, producer_claim: claim};
  };
  async function run(work) {
    assert(typeof work === "function", "STAGE3_HEARTBEAT_WORK_REQUIRED");
    assert(!running, "STAGE3_HEARTBEAT_CONCURRENT_RUN_FORBIDDEN");
    running = true;
    snapshot();
    let stop = false, cancelDelay = () => {}, heartbeatFailure = null;
    const loop = (async () => {
      while (!stop) {
        await new Promise(resolve => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            cancelDelay = () => {};
            resolve();
          };
          const timer = setTimeout(finish, interval);
          cancelDelay = () => { clearTimeout(timer); finish(); };
        });
        if (stop) break;
        try {
          // A TAKEOVER is forbidden even if its new fencing token happens to compare equal.
          const renewed = await lifecycle.acquireOrRenew({
            lease_owner: originalController.lease_owner,
            lease_duration_seconds: duration
          });
          assert.equal(renewed.status, "RENEWED", "STAGE3_HEARTBEAT_CONTROLLER_RENEWAL_NOT_OWNED");
          leaseIdentity(renewed.lease, claim, originalController, originalClaim);
          controller = renewed.lease;
          controllerCount++;
          const nextClaim = await continuity.heartbeatClaimUnderController({
            controller_lease: controller,
            claim,
            lease_duration_seconds: duration
          });
          leaseIdentity(controller, nextClaim, originalController, originalClaim);
          claim = nextClaim;
          claimCount++;
        } catch (error) {
          heartbeatFailure = error;
          stop = true;
        }
      }
    })();
    let result, operationFailure = null;
    try {
      result = await work(snapshot);
    } catch (error) {
      operationFailure = error;
    } finally {
      stop = true;
      cancelDelay();
      await loop;
      running = false;
    }
    // Do not convert a possibly mutated promotion failure into a success.
    if (operationFailure) throw operationFailure;
    if (heartbeatFailure) throw heartbeatFailure;
    snapshot(); // Verify time/fencing still valid before allowing next transition.
    return result;
  }
  return {run, snapshot, evidence};
}
module.exports = {createStage3TestOnlyDualHeartbeatV1};
