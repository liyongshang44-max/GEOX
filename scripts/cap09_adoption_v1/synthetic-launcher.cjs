'use strict';
// Fixed no-effect adapter; NOT wired to the real retry host or arbitrary commands.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const c = require('./contract.cjs');
const v = require('./verifier.cjs');
function consume(result) {
  assert(v.isVerified(result), 'VERIFICATION_REQUIRED');
  assert(Date.now() < result.expires_at, 'EXPIRED_BEFORE_CONSUMPTION');
  c.noLinks(result.ledger_root); assert(fs.statSync(result.ledger_root).isDirectory(), 'LEDGER_REQUIRED');
  const start = performance.now();
  // Reservations never removed. Crash or receipt failure burns the attempt.
  const nonce = path.join(result.ledger_root, 'nonce-' + result.nonce);
  const run = path.join(result.ledger_root, 'run-' + result.run_id);
  try { fs.mkdirSync(nonce); fs.mkdirSync(run); }
  catch (e) { if (e.code === 'EEXIST') throw Error('PERMIT_REPLAY'); throw e; }
  const receipt = {...result,status:'PERMIT_CONSUMED',elapsed_ms:Math.ceil(performance.now()-start)};
  c.writeOnce(path.join(nonce,'CONSUMED.json'),receipt);
  c.writeOnce(path.join(run,'CONSUMED.json'),receipt);
  return {run,receipt};
}
function launch(request) {
  const admission = v.admit(request), {run,receipt} = consume(admission);
  const start = performance.now();
  const result = {...receipt,status:'EXECUTION_RECEIPT_RECORDED',reason_code:'SYNTHETIC_NO_EFFECT_ADAPTER',
    adapter_exit_code:0,provider_calls:0,database_mutations:0,s3_mutations:0,
    elapsed_ms:Math.ceil(performance.now()-start),timings_ms:{admission:admission.elapsed_ms,consumption:receipt.elapsed_ms,adapter:Math.ceil(performance.now()-start)},
    execution_authorized:false,production_authorized:false};
  c.writeOnce(path.join(run,'SYNTHETIC-RESULT.json'),result); return result;
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length,4,'USAGE: synthetic-launcher request trusted-policy');
    const r=c.read(process.argv[2]); c.exact(r,['qualification','permit','materials','evidence','context']);
    console.log(JSON.stringify(launch({...r,policy:c.read(process.argv[3])})));
  } catch(e) { console.error(JSON.stringify({status:e.message==='PERMIT_REPLAY'?'PERMIT_REPLAY':'EXECUTION_HOLD',reason_code:'SYNTHETIC_LAUNCH_REJECTED',execution_authorized:false,production_authorized:false})); process.exitCode=1; }
}
module.exports={consume,launch};
