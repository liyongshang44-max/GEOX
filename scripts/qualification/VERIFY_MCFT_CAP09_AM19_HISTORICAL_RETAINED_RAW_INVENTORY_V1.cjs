#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DESCRIPTOR = path.resolve('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json');
const OUTPUT = path.resolve('acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_RETAINED_RAW_INVENTORY_V1.json');
const BUCKET = 'geox-mcft-cap09-formal-raw-v1';

function required(name) { const v = process.env[name]?.trim(); if (!v) throw new Error(`AM19_HISTORICAL_RAW_INVENTORY_ENV_REQUIRED:${name}`); return v; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim(); }
function sha256Hex(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hmac(key, value) { return crypto.createHmac('sha256', key).update(value, 'utf8').digest(); }
function signingKey(secret, date, region) { const d=hmac(`AWS4${secret}`,date); const r=hmac(d,region); const s=hmac(r,'s3'); return hmac(s,'aws4_request'); }
function uriEncode(value) { return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
function encodedPath(bucket, key) { return `/${uriEncode(bucket)}/${key.split('/').map(uriEncode).join('/')}`; }
function amzTimestamp(date) { const a=date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'); return { amz_date:a, short_date:a.slice(0,8) }; }
function header(headers, name) { const v=headers[name.toLowerCase()]; return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? ''); }
function keyFromRef(ref) {
  const u = new URL(ref);
  assert.equal(u.protocol, 's3-private:', 'AM19_HISTORICAL_RAW_INVENTORY_S3_PRIVATE_REF_REQUIRED');
  assert.equal(u.hostname, BUCKET, 'AM19_HISTORICAL_RAW_INVENTORY_BUCKET_MISMATCH');
  return u.pathname.replace(/^\/+/, '');
}
function signedOptions(endpoint, region, accessKey, secretKey, method, key) {
  const payloadHash = sha256Hex(Buffer.alloc(0));
  const { amz_date: amzDate, short_date: shortDate } = amzTimestamp(new Date());
  const requestPath = `${endpoint.pathname.replace(/\/$/, '')}${encodedPath(BUCKET, key)}`;
  const headers = { host:endpoint.host, 'x-amz-content-sha256':payloadHash, 'x-amz-date':amzDate };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n)=>`${n}:${headers[n].trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method,requestPath,'',canonicalHeaders,signedHeaders,payloadHash].join('\n');
  const scope = `${shortDate}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256',amzDate,scope,sha256Hex(canonicalRequest)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(secretKey,shortDate,region)).update(stringToSign,'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { protocol:endpoint.protocol, hostname:endpoint.hostname, port:endpoint.port || undefined, method, path:requestPath, headers };
}
function request(endpoint, region, accessKey, secretKey, method, key, onData) {
  return new Promise((resolve,reject)=>{
    const req=https.request(signedOptions(endpoint,region,accessKey,secretKey,method,key),(res)=>{
      let bytes=0;
      const hash=crypto.createHash('sha256');
      res.on('data',(chunk)=>{ bytes += chunk.length; if(method==='GET') hash.update(chunk); if(onData) onData(chunk); });
      res.on('end',()=>resolve({status:res.statusCode ?? 0,headers:res.headers,bytes,sha256:method==='GET'?`sha256:${hash.digest('hex')}`:null}));
    });
    req.on('error',reject);
    req.setTimeout(120000,()=>req.destroy(new Error('AM19_HISTORICAL_RAW_INVENTORY_REQUEST_TIMEOUT')));
    req.end();
  });
}
async function verifyObject(endpoint, region, accessKey, secretKey, object) {
  const key=keyFromRef(object.retention_ref);
  const head=await request(endpoint,region,accessKey,secretKey,'HEAD',key);
  assert.equal(head.status,200,`AM19_HISTORICAL_RAW_INVENTORY_HEAD_STATUS:${object.record_role}:${head.status}`);
  assert.equal(Number(header(head.headers,'content-length')),object.raw_bytes,`AM19_HISTORICAL_RAW_INVENTORY_HEAD_BYTES:${object.record_role}`);
  assert.equal(header(head.headers,'x-amz-meta-geox-sha256'),object.raw_sha256,`AM19_HISTORICAL_RAW_INVENTORY_HEAD_SHA:${object.record_role}`);
  assert.equal(header(head.headers,'x-amz-meta-geox-retention-class'),'PRIVATE_RESTRICTED_RAW_EVIDENCE',`AM19_HISTORICAL_RAW_INVENTORY_HEAD_CLASS:${object.record_role}`);
  assert.equal(header(head.headers,'x-amz-meta-geox-ea5e2-class'),'EA5E2_PRIVATE_TRANSIENT_QUALIFICATION_DATA',`AM19_HISTORICAL_RAW_INVENTORY_HEAD_EA5E2_CLASS:${object.record_role}`);
  assert.equal(header(head.headers,'x-amz-meta-geox-retained-at'),object.retained_at,`AM19_HISTORICAL_RAW_INVENTORY_HEAD_RETAINED_AT:${object.record_role}`);
  const get=await request(endpoint,region,accessKey,secretKey,'GET',key);
  assert.equal(get.status,200,`AM19_HISTORICAL_RAW_INVENTORY_GET_STATUS:${object.record_role}:${get.status}`);
  assert.equal(get.bytes,object.raw_bytes,`AM19_HISTORICAL_RAW_INVENTORY_GET_BYTES:${object.record_role}`);
  assert.equal(get.sha256,object.raw_sha256,`AM19_HISTORICAL_RAW_INVENTORY_GET_SHA:${object.record_role}`);
  return {record_role:object.record_role,retention_ref:object.retention_ref,raw_sha256:object.raw_sha256,raw_bytes:object.raw_bytes,retained_at:object.retained_at,head_verified:true,get_verified:true,raw_values_emitted:false};
}
async function main() {
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase()==='true') throw new Error('AM19_HISTORICAL_RAW_INVENTORY_GITHUB_ACTIONS_FORBIDDEN');
  const subject=process.argv[2] ?? '';
  assert.match(subject,/^[0-9a-f]{40}$/,'AM19_HISTORICAL_RAW_INVENTORY_SUBJECT_REQUIRED');
  assert.equal(git('rev-parse','HEAD'),subject,'AM19_HISTORICAL_RAW_INVENTORY_HEAD_MISMATCH');
  assert.equal(git('status','--porcelain'),'','AM19_HISTORICAL_RAW_INVENTORY_DIRTY_WORKTREE_FORBIDDEN');
  const d=readJson(DESCRIPTOR);
  assert.equal(d.schema_version,'geox_mcft_cap09_am19_historical_logical_epoch_v1','AM19_HISTORICAL_RAW_INVENTORY_DESCRIPTOR_SCHEMA_REQUIRED');
  assert.equal(d.retained_raw_objects.length,2,'AM19_HISTORICAL_RAW_INVENTORY_TWO_OBJECTS_REQUIRED');
  const endpoint=new URL(required('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT'));
  assert.equal(endpoint.protocol,'https:','AM19_HISTORICAL_RAW_INVENTORY_HTTPS_ENDPOINT_REQUIRED');
  const bucket=required('MCFT_EA5E2_TRANSIENT_S3_BUCKET');
  assert.equal(bucket,BUCKET,'AM19_HISTORICAL_RAW_INVENTORY_BUCKET_BINDING_REQUIRED');
  const region=required('MCFT_EA5E2_TRANSIENT_S3_REGION');
  const accessKey=required('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID');
  const secretKey=required('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY');
  const objects=[];
  for(const object of d.retained_raw_objects) objects.push(await verifyObject(endpoint,region,accessKey,secretKey,object));
  const out={schema_version:'geox_mcft_cap09_am19_historical_retained_raw_inventory_v1',status:'PASS',qualification_subject_sha:subject,historical_logical_epoch_id:d.epoch_id,producer_subject_sha:d.historical_producer.producer_subject_sha,target_t:d.logical_epoch.target_t,retained_raw_object_count:objects.length,objects,provider_refetch_count:0,put_count:0,delete_count:0,formal_database_write_count:0,runtime_write_count:0,scheduler_write_count:0,raw_values_emitted:false,current_season_formal_admission:'NOT_EVALUATED',formal_effect:false};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,`${JSON.stringify(out,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(out)}\n`);
}
main().catch((error)=>{console.error(error instanceof Error ? error.stack ?? error.message : String(error));process.exitCode=1;});
