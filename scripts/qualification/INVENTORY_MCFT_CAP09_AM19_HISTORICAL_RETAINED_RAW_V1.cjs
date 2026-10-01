#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const CONTRACT_PATH = path.resolve('scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_GRAPH_SUCCESSOR_V1.json');

function fail(code, detail) { throw new Error(detail === undefined ? code : `${code}:${detail}`); }
function requireCondition(condition, code, detail) { if (!condition) fail(code, detail); }
function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`AM19_SUCCESSOR_INVENTORY_ENV_REQUIRED`, name);
  return value;
}
function sha256Hex(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hmac(key, value) { return crypto.createHmac('sha256', key).update(value, 'utf8').digest(); }
function signingKey(secret, date, region) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}
function uriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function amzTimestamp(date) {
  const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return { amzDate, shortDate: amzDate.slice(0, 8) };
}
function xmlDecode(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function xmlFirst(xml, tag) {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return match ? xmlDecode(match[1]) : null;
}
function xmlAll(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map((m) => xmlDecode(m[1]));
}
function digestFromKey(key) {
  const match = /\/sha256\/([0-9a-f]{64})$/.exec(key);
  requireCondition(Boolean(match), 'AM19_SUCCESSOR_INVENTORY_KEY_DIGEST_REQUIRED', key);
  return `sha256:${match[1]}`;
}
function header(headers, name) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

class ReadOnlyS3V1 {
  constructor() {
    this.endpoint = new URL(required('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT'));
    requireCondition(this.endpoint.protocol === 'https:' && !this.endpoint.username && !this.endpoint.password && !this.endpoint.hash, 'AM19_SUCCESSOR_INVENTORY_HTTPS_ENDPOINT_REQUIRED');
    this.bucket = required('MCFT_EA5E2_TRANSIENT_S3_BUCKET');
    requireCondition(this.bucket === 'geox-mcft-cap09-formal-raw-v1', 'AM19_SUCCESSOR_INVENTORY_BUCKET_REQUIRED', this.bucket);
    this.region = required('MCFT_EA5E2_TRANSIENT_S3_REGION');
    this.accessKey = required('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID');
    this.secretKey = required('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY');
    this.listCount = 0;
    this.headCount = 0;
    this.getCount = 0;
    this.putCount = 0;
    this.deleteCount = 0;
  }
  async request(method, canonicalUri, queryPairs = []) {
    requireCondition(['GET','HEAD'].includes(method), 'AM19_SUCCESSOR_INVENTORY_READ_ONLY_METHOD_REQUIRED', method);
    const payloadHash = sha256Hex(Buffer.alloc(0));
    const { amzDate, shortDate } = amzTimestamp(new Date());
    const sorted = [...queryPairs].sort(([ak,av],[bk,bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
    const canonicalQuery = sorted.map(([k,v]) => `${uriEncode(k)}=${uriEncode(v)}`).join('&');
    const headers = { host: this.endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
    const signature = crypto.createHmac('sha256', signingKey(this.secretKey, shortDate, this.region)).update(stringToSign, 'utf8').digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const basePath = this.endpoint.pathname.replace(/\/$/, '');
    const requestPath = `${basePath}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
    const response = await new Promise((resolve, reject) => {
      const req = https.request({ protocol: this.endpoint.protocol, hostname: this.endpoint.hostname, port: this.endpoint.port || undefined, method, path: requestPath, headers }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.setTimeout(60_000, () => req.destroy(new Error('AM19_SUCCESSOR_INVENTORY_S3_TIMEOUT')));
      req.end();
    });
    requireCondition(response.status >= 200 && response.status < 300, 'AM19_SUCCESSOR_INVENTORY_S3_STATUS', `${method}:${response.status}`);
    if (method === 'HEAD') this.headCount += 1;
    else this.getCount += 1;
    return response;
  }
  bucketUri() { return `/${uriEncode(this.bucket)}`; }
  objectUri(key) { return `/${uriEncode(this.bucket)}/${key.split('/').map(uriEncode).join('/')}`; }
  async list(prefix) {
    const out = [];
    let continuation = null;
    do {
      const query = [['list-type','2'],['prefix',prefix]];
      if (continuation) query.push(['continuation-token', continuation]);
      const response = await this.request('GET', this.bucketUri(), query);
      this.listCount += 1;
      const xml = response.body.toString('utf8');
      const keys = xmlAll(xml, 'Key');
      out.push(...keys);
      const truncated = xmlFirst(xml, 'IsTruncated') === 'true';
      continuation = truncated ? xmlFirst(xml, 'NextContinuationToken') : null;
      if (truncated) requireCondition(Boolean(continuation), 'AM19_SUCCESSOR_INVENTORY_CONTINUATION_REQUIRED');
    } while (continuation);
    return [...new Set(out)].sort();
  }
  async inspect(key) {
    const uri = this.objectUri(key);
    const head = await this.request('HEAD', uri);
    const expectedDigest = digestFromKey(key);
    const bytes = Number(header(head.headers, 'content-length'));
    requireCondition(Number.isSafeInteger(bytes) && bytes > 0, 'AM19_SUCCESSOR_INVENTORY_BYTES_REQUIRED', key);
    requireCondition(header(head.headers, 'x-amz-meta-geox-sha256') === expectedDigest, 'AM19_SUCCESSOR_INVENTORY_METADATA_DIGEST_DRIFT', key);
    requireCondition(header(head.headers, 'x-amz-meta-geox-retention-class') === 'PRIVATE_RESTRICTED_RAW_EVIDENCE', 'AM19_SUCCESSOR_INVENTORY_RETENTION_CLASS_DRIFT', key);
    requireCondition(header(head.headers, 'x-amz-meta-geox-ea5e2-class') === 'EA5E2_PRIVATE_TRANSIENT_QUALIFICATION_DATA', 'AM19_SUCCESSOR_INVENTORY_EA5E2_CLASS_DRIFT', key);
    const retainedAt = header(head.headers, 'x-amz-meta-geox-retained-at');
    const retainedMs = Date.parse(retainedAt);
    requireCondition(Number.isFinite(retainedMs) && new Date(retainedMs).toISOString() === retainedAt, 'AM19_SUCCESSOR_INVENTORY_RETAINED_AT_INVALID', key);
    const get = await this.request('GET', uri);
    requireCondition(get.body.byteLength === bytes, 'AM19_SUCCESSOR_INVENTORY_GET_LENGTH_DRIFT', key);
    const actualDigest = `sha256:${sha256Hex(get.body)}`;
    requireCondition(actualDigest === expectedDigest, 'AM19_SUCCESSOR_INVENTORY_GET_DIGEST_DRIFT', key);
    return {
      retention_ref: `s3-private://${this.bucket}/${key}`,
      retained_sha256: expectedDigest,
      retained_bytes: bytes,
      retained_at: retainedAt,
      content_type: header(head.headers, 'content-type') || 'application/octet-stream',
      byte_digest_verified: true,
    };
  }
}

async function main() {
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') fail('AM19_SUCCESSOR_INVENTORY_GITHUB_ACTIONS_FORBIDDEN');
  const mode = process.argv[2] ?? '';
  requireCondition(mode === 'run', 'AM19_SUCCESSOR_INVENTORY_MODE_REQUIRED');
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? path.resolve(process.argv[outArg + 1] ?? '') : null;
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  requireCondition(contract.contract_id === 'MCFT_CAP09_AM19_PERSISTENT_GRAPH_SUCCESSOR_V1', 'AM19_SUCCESSOR_INVENTORY_CONTRACT_REQUIRED');
  const prefix = contract.archival_retained_raw.producer_prefix;
  const a0Ms = Date.parse(contract.historical_epoch.a0);
  const store = new ReadOnlyS3V1();
  const keys = await store.list(prefix);
  requireCondition(keys.length >= 2, 'AM19_SUCCESSOR_INVENTORY_RETAINED_OBJECTS_INSUFFICIENT', keys.length);
  const inspected = [];
  for (const key of keys) {
    requireCondition(key.startsWith(prefix), 'AM19_SUCCESSOR_INVENTORY_PREFIX_ESCAPE', key);
    inspected.push(await store.inspect(key));
  }
  const causal = inspected.filter((item) => Date.parse(item.retained_at) <= a0Ms);
  const tar = causal.filter((item) => item.content_type.toLowerCase().startsWith('application/x-tar'));
  const nonTar = causal.filter((item) => !item.content_type.toLowerCase().startsWith('application/x-tar'));
  requireCondition(causal.length === 2, 'AM19_SUCCESSOR_INVENTORY_EXACT_TWO_PREBOUNDARY_CAUSAL_OBJECTS_REQUIRED', causal.length);
  requireCondition(tar.length === 1 && nonTar.length === 1, 'AM19_SUCCESSOR_INVENTORY_GFS_SOIL_PAIR_REQUIRED', `${tar.length}:${nonTar.length}`);
  const output = {
    schema_version: 'geox_mcft_cap09_am19_historical_retained_raw_inventory_v1',
    status: 'PASS',
    contract_id: contract.contract_id,
    historical_epoch_a0: contract.historical_epoch.a0,
    producer_subject_sha: contract.historical_epoch.historical_producer_subject_sha,
    producer_prefix: prefix,
    listed_object_count: inspected.length,
    preboundary_causal_object_count: causal.length,
    causal_objects: causal.sort((a,b) => a.retention_ref.localeCompare(b.retention_ref)),
    later_or_noncausal_objects: inspected.filter((item) => Date.parse(item.retained_at) > a0Ms).map((item) => ({ retention_ref: item.retention_ref, retained_sha256: item.retained_sha256, retained_bytes: item.retained_bytes, retained_at: item.retained_at, content_type: item.content_type })),
    gfs_tar_digest: tar[0].retained_sha256,
    soil_raw_digest: nonTar[0].retained_sha256,
    list_request_count: store.listCount,
    head_request_count: store.headCount,
    get_request_count: store.getCount,
    put_request_count: store.putCount,
    delete_request_count: store.deleteCount,
    provider_refetch_count: 0,
    raw_values_emitted: false,
    formal_database_write_count: 0,
    formal_r2_prefix_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    current_2026_crop_window_reopened: false,
  };
  requireCondition(output.put_request_count === 0 && output.delete_request_count === 0, 'AM19_SUCCESSOR_INVENTORY_WRITE_FORBIDDEN');
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
