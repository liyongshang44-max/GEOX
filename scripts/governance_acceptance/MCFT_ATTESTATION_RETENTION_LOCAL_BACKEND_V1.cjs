#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const PRODUCTION = 'scripts/governance_acceptance/mcft_attestation_retention_store_v1.cjs';
const LOCATOR = 'acceptance-output/MCFT_CAP_07_ATTESTATION_RETENTION_LOCATOR.json';

function fail(message) { throw new Error(message); }
function writeExecutable(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  fs.chmodSync(file, 0o755);
}

const localRoot = path.resolve(process.env.MCFT_ATTESTATION_LOCAL_ROOT ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-retention-local-')));
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-aws-shim-'));
const shim = path.join(bin, 'aws');

const shimSource = `#!/usr/bin/env node
'use strict';
const crypto=require('node:crypto');const fs=require('node:fs');const path=require('node:path');
const args=process.argv.slice(2);const root=path.resolve(process.env.MCFT_ATTESTATION_LOCAL_ROOT||'');if(!root)process.exit(90);fs.mkdirSync(root,{recursive:true});
const statePath=path.join(root,'state.json');const load=()=>fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{objects:{}};const save=s=>fs.writeFileSync(statePath,JSON.stringify(s,null,2)+'\\n');
const value=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null};const api=args.indexOf('s3api');if(api<0)process.exit(91);const op=args[api+1];const key=value('--key');const version=value('--version-id');const safe=s=>Buffer.from(String(s)).toString('base64url');
const state=load();const current=()=>state.objects[key]?.[state.objects[key].length-1];const selected=()=>state.objects[key]?.find(v=>v.version_id===version)||(!version?current():null);
function output(v){process.stdout.write(JSON.stringify(v));}
if(op==='get-bucket-versioning')output({Status:'Enabled'});
else if(op==='get-object-lock-configuration')output({ObjectLockConfiguration:{ObjectLockEnabled:'Enabled'}});
else if(op==='head-object'){const v=selected();if(!v)process.exit(1);output({ObjectLockMode:v.object_lock_mode,ObjectLockRetainUntilDate:v.retain_until,ContentLength:v.size,ETag:v.etag});}
else if(op==='put-object'){if(current())process.exit(1);const body=value('--body');const bytes=fs.readFileSync(body);const retain=value('--object-lock-retain-until-date');const id=crypto.createHash('sha256').update(key).update(bytes).update(String(retain)).digest('hex').slice(0,32);const dir=path.join(root,'objects',safe(key));fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,id);fs.writeFileSync(file,bytes);const etag='"'+crypto.createHash('md5').update(bytes).digest('hex')+'"';const row={version_id:id,file,object_lock_mode:value('--object-lock-mode'),retain_until:retain,size:bytes.length,etag};(state.objects[key]??=[]).push(row);save(state);output({VersionId:id,ETag:etag});}
else if(op==='get-object'){const v=selected();if(!v)process.exit(1);const out=args[args.length-1];fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.copyFileSync(v.file,out);output({VersionId:v.version_id});}
else if(op==='delete-object'){const v=selected();if(!v)process.exit(1);if(v.object_lock_mode==='COMPLIANCE'&&Date.parse(v.retain_until)>Date.now())process.exit(1);fs.rmSync(v.file,{force:true});output({});}
else process.exit(92);
`;

try {
  assert.ok(fs.existsSync(path.join(ROOT, PRODUCTION)), 'PRODUCTION_RETENTION_STORE_MISSING');
  writeExecutable(shim, shimSource);
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`,
    MCFT_ATTESTATION_LOCAL_ROOT: localRoot,
    GEOX_MCFT_ATTESTATION_S3_ENDPOINT: 'http://mcft-local.invalid',
    GEOX_MCFT_ATTESTATION_S3_BUCKET: process.env.GEOX_MCFT_ATTESTATION_S3_BUCKET || 'mcft-local',
    GEOX_MCFT_ATTESTATION_S3_REGION: process.env.GEOX_MCFT_ATTESTATION_S3_REGION || 'us-east-1',
    AWS_ACCESS_KEY_ID: 'mcft-local-writer',
    AWS_SECRET_ACCESS_KEY: 'mcft-local-secret',
  };
  const run = cp.spawnSync(process.execPath, [PRODUCTION, '--upload-readback'], {
    cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (run.status !== 0) fail(`PRODUCTION_RETENTION_LOCAL_BACKEND_FAILED:${run.stderr || run.stdout}`);
  const locatorPath = path.join(ROOT, LOCATOR);
  const locator = JSON.parse(fs.readFileSync(locatorPath, 'utf8'));
  assert.equal(locator.readback_verified, true);
  assert.equal(locator.locked_version_delete_denied, true);
  locator.backend_kind = 'LOCAL_PRODUCTION_LOGIC';
  locator.remote_object_store_exercised = false;
  locator.local_backend_root = localRoot;
  fs.writeFileSync(locatorPath, `${JSON.stringify(locator, null, 2)}\n`, 'utf8');
  const requested = process.env.MCFT_RETENTION_LOCATOR_PATH;
  if (requested && path.resolve(requested) !== locatorPath) {
    fs.mkdirSync(path.dirname(path.resolve(requested)), { recursive: true });
    fs.copyFileSync(locatorPath, path.resolve(requested));
  }
  console.log(JSON.stringify(locator));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  fs.rmSync(bin, { recursive: true, force: true });
}
