# AM22 GFS progress diagnostic V1

Engineering-only read-only observer. No Runtime, Provider retry-budget, authority, container or lease mutation. It does not recover acquisition, qualify an A0, generate six-phase input, or authorize Formal execution.

## Evidence and limits

Read-only production transaction checks the database name and exact six-key scope. Claims are counted as durable attempt claims, not successful HTTP requests. Pair metadata is observed, never certified as a scientific/provenance qualification. A live lease at one database sample is not H5. Missing logs and unavailable SQL are not interpreted as no failures or zero rows.

The existing health logger omits the wrapped transport cause. This observer cannot retrospectively determine HTTP status versus timeout/reset or prove provider publication. It reports UNKNOWN. It keeps member-fetch failures separately from the repeated missed-window messages so a restart loop does not overwrite the earlier failure in its summary. Only permitted health tokens are emitted; URLs, messages, credentials and cause objects are excluded.

## Operator command after this candidate is accepted

Use a clean checkout of the accepted exact main, dependencies already installed, and the restored operator PowerShell environment. No image build or cutover is required. The runner uses the host database credentials solely for SELECT statements within BEGIN READ ONLY and reads the mounted durable Evidence log. The original target below is a diagnostic target, never a new execution window.

```powershell
node scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs --live --operator-authorized --target=2026-10-09T07:00:00.000Z
if ($LASTEXITCODE -ne 0) { throw 'Diagnostic blocked; unavailable evidence is not an empty result' }
```

Offline mode: `--input=/absolute/path/snapshot.json`. Input schema is exercised by the acceptance script. Output is diagnostic-only and all Formal/production authorization fields remain false.

## Independent Windows network probe

Run in the original Windows PowerShell/Docker Desktop environment. This standalone probe can be reviewed and run without merging the candidate or rebuilding an image. It creates one disposable diagnostic container using the exact original image and its single attached Docker network, with no production environment, credentials, mounts, restart policy, collector entry point or database access. The original container is inspected only. Network mode and image mismatch block the command.

It calls the existing compiled controlled byte client and provider URL builder, bypassing the retry wrapper solely to expose a new request's HTTP status and safe transport codes. It makes at most two requests, one F011 request for each explicitly labelled candidate cycle (00Z and 06Z), with 120-second per-request timeout, a 260-second overall ceiling, a streaming 20 MB diagnostic cap, and at least ten seconds between requests. The streaming cap is an extra diagnostic limit; it does not change the deployed transport. A 403/429 stops further probes. Those cycles are candidates, not an assertion about the failed attempt's selected cycle. No directory inventory, full bundle, scientific qualification or original publication-time proof is obtained. Successful bytes must have a GRIB signature, but even that is not a qualified Weather/ET0 pair. New network observations cannot recover the historical omitted cause.

Paste this complete block; return the JSON output, including any BLOCKED result. Do not paste Docker inspect output or environment variables. The command takes up to about 4.5 minutes. There is no automatic retry.

```powershell
$ErrorActionPreference = 'Stop'
$container = 'geox-mcft-cap09-production-v1-geox-mcft-cap09-evidence-runtime-v1-1'
$image = 'sha256:b2eed3f3845ce4ba45627da028ecc7a04947dd03223698d65cebacf10c659456'
$raw = docker --context desktop-linux inspect --type container $container
if ($LASTEXITCODE -ne 0) { throw 'Diagnostic blocked: container inspect failed' }
$info = @($raw | ConvertFrom-Json)[0]
if ($info.Image -ne $image) { throw 'Diagnostic blocked: original image identity changed' }
$networks = @($info.NetworkSettings.Networks.PSObject.Properties.Name)
if ($networks.Count -ne 1) { throw 'Diagnostic blocked: expected exactly one attached network' }
$network = $networks[0]
if ($network -in @('host', 'none')) { throw 'Diagnostic blocked: unsupported network mode' }
$probe = @'
import { ControlledHttpsByteClientV1 } from '/app/apps/server/dist/apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js';
import { gfsPgrb2FilterUrlV1 } from '/app/apps/server/dist/apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const known = new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','ERR_TLS_CERT_ALTNAME_INVALID','DIAGNOSTIC_BYTE_LIMIT']);
const errorNames = new Set(['Error','TypeError','AbortError','TimeoutError']);
const base = {diagnostic_only:true,production_writes:0,historical_cause:'UNKNOWN',selected_cycle_of_failed_attempt:'UNKNOWN',formal_v5_arm:false,a0_execution:false,o00_execution:false};
const deadline = setTimeout(() => {console.log(JSON.stringify({...base,status:'BLOCKED',reason:'DIAGNOSTIC_OVERALL_TIMEOUT'}));process.exit(2);},260000);
try {
 for (const cycle of ['2026-10-09T00:00:00.000Z','2026-10-09T06:00:00.000Z']) {
  const row = {...base,observed_at:new Date().toISOString(),candidate_cycle:cycle,lead:11,http_status:null,bytes_read:0};
  const started = Date.now();let received;
  const client = new ControlledHttpsByteClientV1({user_agent:'GEOX-MCFT-CAP09-PHASE3-EVIDENCE-RUNTIME/1',max_raw_bytes:20000000,timeout_ms:120000,fetch_impl:async (url, init) => {
   const response = await fetch(url, init);received=response;
   row.http_status = response.status;
   if(response.status !== 200 && response.body) await response.body.cancel().catch(() => {});
   return {status:response.status,url:response.url,headers:response.headers,arrayBuffer:async () => {
    const reader = response.body?.getReader();
    if (!reader) return new ArrayBuffer(0);
    const chunks = [];
    try {for (;;) {const {done,value} = await reader.read();if(done) break;row.bytes_read += value.byteLength;
      if(row.bytes_read > 20000000) {const e = new Error('diagnostic limit');e.code = 'DIAGNOSTIC_BYTE_LIMIT';throw e;}chunks.push(value);}}
    finally {await reader.cancel().catch(() => {});reader.releaseLock();}
    const bytes = new Uint8Array(row.bytes_read);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes.buffer;
   }};
  }});
  try {
   const response = await client.requestBytes({locator:gfsPgrb2FilterUrlV1(cycle,11),allowed_final_hosts:['nomads.ncep.noaa.gov'],expected_statuses:[200],request_headers:{Accept:'application/octet-stream,*/*;q=0.5','Cache-Control':'no-cache'},max_bytes:20000000,error_prefix:'MCFT_CAP09_GFS_PGRB2_F011'});
   row.grib_signature = response.bytes.length >= 8 && new TextDecoder('ascii').decode(response.bytes.slice(0,4)) === 'GRIB';
   row.status = row.grib_signature ? 'HTTP_BYTES_OBSERVED_NOT_QUALIFIED' : 'NON_GRIB_RESPONSE';
  } catch(error) {
   row.status = 'REQUEST_FAILED';row.error_name = errorNames.has(error?.name) ? error.name : 'OTHER';
   row.error_codes = [];let current=error;
   for(let depth=0;current && depth<4;depth++,current=current.cause) if(known.has(current.code)) row.error_codes.push(current.code);
   row.error_codes = [...new Set(row.error_codes)];
   const validation = /^MCFT_CAP09_GFS_PGRB2_F011_(HTTP_STATUS|FINAL_HOST_NOT_ALLOWED|FINAL_IDENTITY_DRIFT|RAW_BYTES|HTTPS_REQUIRED|CREDENTIAL_OR_FRAGMENT_FORBIDDEN|URL_INVALID)(?::|$)/.exec(error?.message ?? '');
   row.validation_failure = validation?.[1] ?? null;
  } finally {if(received?.body && !received.body.locked) await received.body.cancel().catch(() => {});}
  row.elapsed_ms = Date.now()-started;console.log(JSON.stringify(row));
  if([403,429].includes(row.http_status)) break;
  if(cycle.endsWith('T00:00:00.000Z')) await sleep(10000);
 }
} finally {clearTimeout(deadline);}
'@
$probe | docker --context desktop-linux run --rm --pull=never --network $network --read-only --cap-drop=ALL --security-opt=no-new-privileges --memory=256m --pids-limit=64 --user=65534:65534 --log-driver=none --entrypoint=node -i $image --input-type=module -
if ($LASTEXITCODE -ne 0) { throw 'Diagnostic blocked: report unavailable; no production state was changed' }
```

Each REQUEST_FAILED line is a diagnostic result even when the disposable container exits zero. Import/setup failure or a nonzero Docker exit is unavailable evidence. The probe shares the Docker network, but not the original process, proxy environment, connection pool or acquisition sequence; it must not be treated as an exact reproduction of the historical failure.

## Governance

Predecessor is protected-main 0d19c4b9f7eb9067824f68014babd757c74f1943 (#3680). All 44 existing QCP checks and resolvers remain unchanged; one exact-path diagnostic check is appended. The prior recovery verifier receives only a diagnostic delegation line. Its entire previous body is compared byte-for-byte, and its actual qualification is replayed against a separate checkout of the adopted predecessor. R6/G12/G13 files and frozen Runtime are unchanged. No old failure receipt becomes a success receipt.
