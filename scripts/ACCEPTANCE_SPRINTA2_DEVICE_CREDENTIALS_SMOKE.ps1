param(
  [string]$BaseUrl = "http://127.0.0.1:3000",              # HTTP base URL of apps/server
  [string]$MqttUrl = "mqtt://127.0.0.1:1883",              # MQTT broker URL
  [string]$TenantId = "tenantA"                            # Tenant used in telemetry topic
)

Set-StrictMode -Version Latest                              # Enforce strict variable usage
$ErrorActionPreference = "Stop"                             # Fail fast on errors

function Fail([string]$m) { throw ("[FAIL] " + $m) }         # Unified failure helper

function HasProp([object]$o, [string]$name) {                # Safe property existence check
  if ($null -eq $o) { return $false }                        # Null object => no prop
  if ($null -eq $o.PSObject) { return $false }               # No PSObject => no prop
  if ($null -eq $o.PSObject.Properties) { return $false }    # No Properties => no prop
  return ($o.PSObject.Properties.Match($name).Count -gt 0)    # True if prop exists
}

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path   # Repo root path

function ReadJsonFile([string]$path) {                       # Read JSON file -> object
  if (-not (Test-Path -LiteralPath $path)) { return $null }  # Missing file => null
  $raw = Get-Content -LiteralPath $path -Raw                 # Read full content
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }   # Empty => null
  return ($raw | ConvertFrom-Json)                           # Parse JSON
}

function PickToken() {                                       # Pick AO-ACT token for auth
  if ($env:GEOX_AO_ACT_TOKEN) { return $env:GEOX_AO_ACT_TOKEN }  # Prefer env override

  $cfgPath = Join-Path $PSScriptRoot "..\config\auth\ao_act_tokens_v0.json"    # Token config path
  $cfgPath = (Resolve-Path -LiteralPath $cfgPath).Path        # Resolve absolute path
  $cfg = ReadJsonFile $cfgPath                                # Load config JSON
  if (-not $cfg) { Fail("no usable token found (config missing) at $cfgPath") } # Must exist

  $candidates = @()                                           # Candidate token list

  if (HasProp $cfg "tokens" -and ($cfg.tokens -is [System.Collections.IEnumerable]) -and (-not ($cfg.tokens -is [string]))) {
    foreach ($t in @($cfg.tokens)) {                          # tokens as array
      if ($null -eq $t) { continue }                          # Skip null entries
      $hasRevoked = HasProp $t "revoked"                      # Detect revoked field
      if ($hasRevoked -and ($t.revoked -eq $true)) { continue } # Skip revoked
      if (-not (HasProp $t "token")) { continue }             # Must have token
      $tok = [string]$t.token                                 # Token string
      if ([string]::IsNullOrWhiteSpace($tok)) { continue }    # Skip empty token
      $candidates += [pscustomobject]@{ token=$tok }          # Add candidate
    }
  } elseif (HasProp $cfg "tokens" -and ($cfg.tokens -ne $null) -and ($cfg.tokens.PSObject -ne $null)) {
    foreach ($k in $cfg.tokens.PSObject.Properties.Name) {    # tokens as map/object
      $t = $cfg.tokens.$k                                     # Entry by key
      if ($null -eq $t) { continue }                          # Skip null
      $hasRevoked = HasProp $t "revoked"                      # Detect revoked
      if ($hasRevoked -and ($t.revoked -eq $true)) { continue } # Skip revoked
      if (-not (HasProp $t "token")) { continue }             # Must have token
      $tok = [string]$t.token                                 # Token string
      if ([string]::IsNullOrWhiteSpace($tok)) { continue }    # Skip empty token
      $candidates += [pscustomobject]@{ token=$tok }          # Add candidate
    }
  } elseif (HasProp $cfg "token") {
    $hasRevoked = HasProp $cfg "revoked"                      # Detect revoked at root
    if (-not ($hasRevoked -and ($cfg.revoked -eq $true))) {   # Only if not revoked
      $tok = [string]$cfg.token                               # Token string
      if (-not [string]::IsNullOrWhiteSpace($tok)) {          # Only if non-empty
        $candidates += [pscustomobject]@{ token=$tok }         # Add candidate
      }
    }
  }

  if ($candidates.Count -lt 1) { Fail("no usable token found in $cfgPath") }  # Must exist
  return [string]$candidates[0].token                          # Pick first usable token
}

function WriteTempJsonFile([object]$obj) {                    # Write object -> temp JSON file
  $p = Join-Path $env:TEMP ("geox_json_" + [Guid]::NewGuid().ToString("N") + ".json") # Temp path
  $json = ($obj | ConvertTo-Json -Compress -Depth 20)         # Serialize JSON
  [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false))) # UTF-8 no BOM
  return $p                                                   # Return path
}

function CurlJsonFile([string]$method, [string]$url, [string]$token, [object]$bodyObj) { # curl with JSON file
  $tmp = WriteTempJsonFile $bodyObj                           # Write body to temp file
  try {
    $args = @(
      "-sS",                                                  # Silent but show errors
      "-H", "Authorization: Bearer $token",                   # Auth header
      "-H", "Content-Type: application/json",                 # JSON content type
      "-X", $method,                                          # HTTP method
      $url,                                                   # URL
      "--data-binary", "@$tmp"                                # Body from file
    )
    $raw = & curl.exe @args 2>&1 | Out-String                  # Run curl
    return $raw.Trim()                                        # Trim output
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmp | Out-Null  # Cleanup
  }
}

function CurlJsonFileRaw([string]$method, [string]$url, [string]$token, [string]$rawJson) { # curl with raw JSON
  $tmp = Join-Path $env:TEMP ("geox_json_" + [Guid]::NewGuid().ToString("N") + ".json")     # Temp path
  [System.IO.File]::WriteAllText($tmp, $rawJson, (New-Object System.Text.UTF8Encoding($false))) # Write JSON raw
  try {
    $args = @(
      "-sS",
      "-H", "Authorization: Bearer $token",
      "-H", "Content-Type: application/json",
      "-X", $method,
      $url,
      "--data-binary", "@$tmp"
    )
    $raw = & curl.exe @args 2>&1 | Out-String
    return $raw.Trim()
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmp | Out-Null
  }
}

function CurlGet([string]$url, [string]$token) {              # curl GET helper
  $args = @(
    "-sS",
    "-H", "Authorization: Bearer $token",
    "-X", "GET",
    $url
  )
  $raw = & curl.exe @args 2>&1 | Out-String                    # Run curl
  return $raw.Trim()                                          # Trim output
}

function ParseJsonOrFail([string]$ctx, [string]$raw) {         # Parse JSON response or fail
  if ([string]::IsNullOrWhiteSpace($raw)) { Fail("${ctx}: empty response") } # Must have content
  try { return ($raw | ConvertFrom-Json) } catch { Fail("${ctx}: response not json raw=$raw") } # Must be JSON
}

function EnsureOk([string]$ctx, [string]$url, [string]$raw) {  # Ensure API response indicates ok
  $obj = ParseJsonOrFail $ctx $raw                             # Parse JSON
  if ($obj.PSObject.Properties.Name -contains "statusCode") { Fail("${ctx}: http error url=$url raw=$raw") } # Fastify error shape
  if (($obj.PSObject.Properties.Name -contains "ok") -and ($obj.ok -ne $true)) { Fail("${ctx}: expected ok=true url=$url raw=$raw") } # ok discipline
  return $obj                                                  # Return parsed object
}

function StopProcSafe([string]$ctx, [System.Diagnostics.Process]$p) {  # Stop process robustly
  if ($null -eq $p) { return }                                 # Null => nothing
  try {
    if (-not $p.HasExited) {                                   # Only if still running
      try { $p.CloseMainWindow() | Out-Null } catch {}         # Try graceful close
      Start-Sleep -Milliseconds 200                            # Small grace period
      if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } # Force kill
    }
  } catch {
    Write-Host ("WARN: ${ctx}: failed to stop process: " + ($_.Exception.Message)) # Best-effort warning
  }
}

function ReadTail([string]$path, [int]$maxLines) {                          # Read last N lines from a log file
  if (-not (Test-Path -LiteralPath $path)) { return "" }                    # Missing file => empty
  $lines = Get-Content -LiteralPath $path -ErrorAction SilentlyContinue     # Read file lines
  if ($null -eq $lines) { return "" }                                       # No content => empty
  $tail = $lines | Select-Object -Last $maxLines                             # Take last N lines
  return (($tail -join "`n").Trim())                                         # Join + trim
}

function StartIngestOnce([string]$ctx) {                                    # Start telemetry-ingest --once (async) with log redirection
  $tmpRoot = Join-Path $RepoRoot "_tmp"                                      # Repo-scoped temp dir
  New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null              # Ensure temp dir exists

  $outFile = Join-Path $tmpRoot ("telemetry_ingest_out_" + [Guid]::NewGuid().ToString("N") + ".log") # stdout log path
  $errFile = Join-Path $tmpRoot ("telemetry_ingest_err_" + [Guid]::NewGuid().ToString("N") + ".log") # stderr log path

  $pnpmExe = (Get-Command pnpm -ErrorAction Stop).Source                     # Resolve pnpm path
  $argv = @("-C","apps/telemetry-ingest","dev","--","--once")                # Ingest command args

  try {
    $p = Start-Process -FilePath $pnpmExe -ArgumentList $argv -WorkingDirectory $RepoRoot -NoNewWindow `
      -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru # Start ingest with redirected logs
  } catch {
    Fail("telemetry-ingest start failed ctx=$ctx err=$($_.Exception.Message)") # Fail on start error
  }

  Write-Host ("INFO: telemetry-ingest started pid=" + $p.Id + " ctx=" + $ctx) # Log pid
  return [pscustomobject]@{ Proc=$p; Out=$outFile; Err=$errFile }             # Return handler
}

function AwaitIngestReady([string]$ctx, [pscustomobject]$h, [int]$timeoutMs) { # Wait until ingest subscribed before publishing
  if ($null -eq $h -or $null -eq $h.Proc) { Fail("AwaitIngestReady: handler/proc null ctx=$ctx") } # Must have proc

  $deadline = [int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $timeoutMs # Absolute deadline (ms)

  do {
    Start-Sleep -Milliseconds 150                                             # Small polling interval
    $out = ReadTail $h.Out 200                                                # Read recent stdout tail
    $err = ReadTail $h.Err 50                                                 # Read recent stderr tail

    if ($out -match "\[telemetry-ingest\]\s*subscribed" -or $out -match "\bsubscribed\b") { return } # Ready => return

    try {
      if ($h.Proc.HasExited) {                                                # Ingest exited early
        $code = $h.Proc.ExitCode                                              # Exit code
        Fail("ingest exited early ctx=$ctx exit=$code out_tail=`n$out`nerr_tail=`n$err") # Fail with tails
      }
    } catch {
      # Ignore rare race when querying HasExited
    }
  } while ([int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $deadline) # Loop until deadline

  $outTail = ReadTail $h.Out 250                                              # Final stdout tail
  $errTail = ReadTail $h.Err 250                                              # Final stderr tail
  Fail("ingest not ready (missing subscribed) ctx=$ctx after ${timeoutMs}ms out_tail=`n$outTail`nerr_tail=`n$errTail") # Timeout fail
}

function PublishTelemetryE2E([string]$mqttUrl, [string]$tenant, [string]$deviceId, [string]$payloadJson, [int]$timeoutMs) {
  $tmpRoot = Join-Path $RepoRoot "_tmp"                                       # Repo-scoped temp dir
  New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null               # Ensure temp dir exists
  $jsPath = Join-Path $tmpRoot ("geox_mqtt_publish_" + [Guid]::NewGuid().ToString("N") + ".cjs") # Temp JS path

  try {
    $env:GEOX_MQTT_URL = $mqttUrl                                             # Pass broker URL
    $env:GEOX_MQTT_TOPIC = "telemetry/$tenant/$deviceId"                      # Pass topic
    $env:GEOX_MQTT_PAYLOAD_JSON = $payloadJson                                # Pass payload JSON
    $env:GEOX_MQTT_TIMEOUT_MS = [string]$timeoutMs                            # Pass watchdog timeout

    Write-Host ("INFO: publish_start device_id=" + $deviceId)                 # Log start

    $js = @'
const path = require("path");
const { createRequire } = require("module");

// Resolve mqtt strictly from apps/telemetry-ingest dependency tree.
const ingestPkg = path.resolve(process.cwd(), "apps", "telemetry-ingest", "package.json");
const req = createRequire(ingestPkg);
const mqtt = req("mqtt");

const url = process.env.GEOX_MQTT_URL;
const topic = process.env.GEOX_MQTT_TOPIC;

const payloadRaw = process.env.GEOX_MQTT_PAYLOAD_JSON ? process.env.GEOX_MQTT_PAYLOAD_JSON : "{}";
const payloadObj = JSON.parse(payloadRaw);
payloadObj.ts_ms = Date.now();
const payload = JSON.stringify(payloadObj);

const HARD_TIMEOUT_MS = parseInt(process.env.GEOX_MQTT_TIMEOUT_MS ? process.env.GEOX_MQTT_TIMEOUT_MS : "8000", 10);

let done = false;
const hard = setTimeout(() => {
  if (done) return;
  console.error("publish_timeout");
  process.exit(2);
}, HARD_TIMEOUT_MS);

const c = mqtt.connect(url, {
  connectTimeout: Math.min(5000, Math.max(1500, HARD_TIMEOUT_MS - 1000)),
  reconnectPeriod: 0,
});

c.on("connect", () => {
  c.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error("publish_err", err && err.message ? err.message : String(err));
      process.exit(3);
    }
    done = true;
    clearTimeout(hard);
    console.log("publish_ok", topic);
    try { c.end(true); } catch {}
    setImmediate(() => process.exit(0));
  });
});

// Ignore late errors after success.
c.on("error", (e) => {
  if (done) return;
  console.error("mqtt_err", e && e.message ? e.message : String(e));
  process.exit(4);
});
'@

    [System.IO.File]::WriteAllText($jsPath, $js, (New-Object System.Text.UTF8Encoding($false))) # Write JS UTF-8 no BOM

    Push-Location $RepoRoot                                                   # Ensure process.cwd() is repo root for require resolution
    try {
      $raw = (& node $jsPath 2>&1 | Out-String).Trim()                        # Run node file synchronously
      $code = $LASTEXITCODE                                                   # Capture exit code immediately
    } finally {
      Pop-Location                                                            # Restore location
    }

    if ($code -ne 0) { Fail("mqtt publish: exit=$code raw=`n$raw") }          # Must exit 0
    if ($raw -notmatch "publish_ok") { Fail("mqtt publish: missing publish_ok raw=`n$raw") } # Must contain marker

    Write-Host ("INFO: " + $raw)                                              # Log output
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $jsPath | Out-Null       # Cleanup temp JS
  }
}

function GetTelemetryCount([string]$baseUrl, [string]$tok, [string]$device, [string]$metric, [int64]$startMs, [int64]$endMs) {
  $url = "$baseUrl/api/telemetry/v1/query?device_id=$device&metric=$metric&from_ts_ms=$startMs&to_ts_ms=$endMs&limit=10" # Query URL
  $raw = CurlGet -url $url -token $tok                                       # GET query
  $obj = EnsureOk -ctx "telemetry query" -url $url -raw $raw                 # Ensure ok
  return [int]$obj.count                                                     # Return count
}

function AwaitTelemetryCount([string]$ctx, [int]$expectMin, [int]$expectMax, [string]$baseUrl, [string]$tok, [string]$device, [string]$metric, [int64]$startMs, [int64]$endMs, [int]$timeoutMs) {
  $deadline = [int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $timeoutMs  # Deadline
  $count = -1                                                                # Current count
  do {
    Start-Sleep -Milliseconds 600                                            # Poll interval
    $count = GetTelemetryCount -baseUrl $baseUrl -tok $tok -device $device -metric $metric -startMs $startMs -endMs $endMs # Query count
  } while ((($count -lt $expectMin) -or ($count -gt $expectMax)) -and ([int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $deadline)) # Loop until in range or timeout

  if (($count -lt $expectMin) -or ($count -gt $expectMax)) {                 # Validate range
    Fail("${ctx}: expected count in [$expectMin,$expectMax], got $count device=$device metric=$metric") # Fail if out of range
  }
  return $count                                                              # Return final count
}

function RunIngestAndPublishAndAssert([string]$ctx, [string]$deviceId, [string]$payloadJson, [int]$expectMin, [int]$expectMax, [int]$queryTimeoutMs) {
  $ingestCtx = "telemetry-ingest --once ($ctx)"                               # Context string
  $h = $null                                                                 # Ingest handler
  try {
    $h = StartIngestOnce -ctx $ctx                                           # Start ingest (async)
    AwaitIngestReady -ctx $ctx -h $h -timeoutMs 12000                        # Wait for subscribe before publishing

    $now = [int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()          # Current time (ms)
    $startMs = $now - 15000                                                  # Wider start window for jitter
    $endMs   = $now + 15000                                                  # Wider end window for jitter

    PublishTelemetryE2E -mqttUrl $MqttUrl -tenant $TenantId -deviceId $deviceId -payloadJson $payloadJson -timeoutMs 8000 # Publish after ready

    $null = AwaitTelemetryCount -ctx "$ctx query" -expectMin $expectMin -expectMax $expectMax `
      -baseUrl $BaseUrl -tok $tok -device $deviceId -metric $metric -startMs $startMs -endMs $endMs -timeoutMs $queryTimeoutMs # Assert count

    Write-Host ("INFO: $ctx query ok (count in [$expectMin,$expectMax])")    # Pass message
  } finally {
    if ($h -ne $null) {                                                      # If ingest was started
      StopProcSafe -ctx $ingestCtx -p $h.Proc                                # Stop ingest process
      $outTail = ReadTail $h.Out 60                                          # Tail stdout for debugging
      $errTail = ReadTail $h.Err 60                                          # Tail stderr for debugging
      $tail = (($outTail + "`n" + $errTail).Trim())                          # Combine tail
      if (-not [string]::IsNullOrWhiteSpace($tail)) {                        # Print only if non-empty
        Write-Host ("INFO: ingest_tail(" + $ctx + ")=`n" + $tail)            # Print tail
      }
      Remove-Item -Force -ErrorAction SilentlyContinue $h.Out, $h.Err | Out-Null # Cleanup log files
    }
  }
}

# -------------------------
# Main
# -------------------------

$tok = PickToken                                                      # Pick token
Write-Host "INFO: auto-selected token len=$($tok.Length)"             # Print token length
Write-Host "INFO: using baseUrl=$BaseUrl"                             # Print baseUrl
Write-Host "INFO: using mqttUrl=$MqttUrl"                             # Print mqttUrl
Write-Host "INFO: repoRoot=$RepoRoot"                                 # Print repo root

if (-not $env:DATABASE_URL) { Fail("MISSING env:DATABASE_URL in current session (telemetry-ingest needs it)") } # Require DB URL

$metric = "soil_moisture"                                             # Metric under test
$env:MQTT_URL = $MqttUrl                                              # telemetry-ingest env
$env:MQTT_TOPIC_FILTER = "telemetry/+/+"                              # telemetry-ingest subscription filter

$uDev = "$BaseUrl/api/devices"                                        # Device API endpoint

# POSITIVE baseline
$deviceId = "devA2_pos_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" # Unique device id
Write-Host "INFO: positive device_id=$deviceId"                       # Print device id

$raw = CurlJsonFile -method "POST" -url $uDev -token $tok -bodyObj @{ device_id=$deviceId; display_name="Dev A2 POS" } # Register device
$null = EnsureOk -ctx "register device (pos)" -url $uDev -raw $raw    # Ensure ok

$uCred = "$BaseUrl/api/devices/$deviceId/credentials"                 # Credential endpoint
$raw = CurlJsonFileRaw -method "POST" -url $uCred -token $tok -rawJson "{}" # Create credential
$credObj = EnsureOk -ctx "create credential (pos)" -url $uCred -raw $raw # Ensure ok
if (-not (HasProp $credObj "credential_secret")) { Fail("create credential (pos): missing credential_secret raw=$raw") } # Must have secret
$credSecret = [string]$credObj.credential_secret                      # Extract secret
Write-Host "INFO: positive credential_secret_len=$($credSecret.Length)" # Print secret length

$payloadObj = @{ metric=$metric; value=21.3; ts_ms=0; credential=$credSecret } # Payload object
$payloadJson = ($payloadObj | ConvertTo-Json -Compress -Depth 10)      # Serialize payload
RunIngestAndPublishAndAssert -ctx "pos" -deviceId $deviceId -payloadJson $payloadJson -expectMin 1 -expectMax 100 -queryTimeoutMs 25000 # Expect >=1

# NEG1 unregistered device drop
$neg1Device = "devA2_neg_unreg_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" # Unregistered device
Write-Host "INFO: neg1 device_id=$neg1Device (unregistered)"          # Print device id
$payloadObj = @{ metric=$metric; value=21.3; ts_ms=0; credential="BOGUS_UNREGISTERED_DEVICE" } # Bad credential
$payloadJson = ($payloadObj | ConvertTo-Json -Compress -Depth 10)      # Serialize payload
RunIngestAndPublishAndAssert -ctx "neg1" -deviceId $neg1Device -payloadJson $payloadJson -expectMin 0 -expectMax 0 -queryTimeoutMs 12000 # Expect drop
Write-Host "INFO: neg1 ok (unregistered device dropped)"              # Pass message

# NEG2 wrong credential drop
$neg2Device = "devA2_neg_badcred_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" # Registered device, bad cred
Write-Host "INFO: neg2 device_id=$neg2Device"                         # Print device id

$raw = CurlJsonFile -method "POST" -url $uDev -token $tok -bodyObj @{ device_id=$neg2Device; display_name="Dev A2 NEG2" } # Register
$null = EnsureOk -ctx "register device (neg2)" -url $uDev -raw $raw   # Ensure ok

$payloadObj = @{ metric=$metric; value=21.3; ts_ms=0; credential="WRONG_CREDENTIAL_SHOULD_DROP" } # Wrong credential
$payloadJson = ($payloadObj | ConvertTo-Json -Compress -Depth 10)      # Serialize payload
RunIngestAndPublishAndAssert -ctx "neg2" -deviceId $neg2Device -payloadJson $payloadJson -expectMin 0 -expectMax 0 -queryTimeoutMs 12000 # Expect drop
Write-Host "INFO: neg2 ok (bad credential dropped)"                   # Pass message

# NEG3 revoked credential drop
$neg3Device = "devA2_neg_revoked_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" # Device for revoke test
Write-Host "INFO: neg3 device_id=$neg3Device"                         # Print device id

$raw = CurlJsonFile -method "POST" -url $uDev -token $tok -bodyObj @{ device_id=$neg3Device; display_name="Dev A2 NEG3" } # Register
$null = EnsureOk -ctx "register device (neg3)" -url $uDev -raw $raw   # Ensure ok

$uCred3 = "$BaseUrl/api/devices/$neg3Device/credentials"              # Credential endpoint
$raw = CurlJsonFileRaw -method "POST" -url $uCred3 -token $tok -rawJson "{}" # Create credential
$credObj3 = EnsureOk -ctx "create credential (neg3)" -url $uCred3 -raw $raw # Ensure ok
if (-not (HasProp $credObj3 "credential_secret")) { Fail("create credential (neg3): missing credential_secret raw=$raw") } # Must have secret
if (-not (HasProp $credObj3 "credential_id")) { Fail("create credential (neg3): missing credential_id raw=$raw") } # Must have id
$neg3Secret = [string]$credObj3.credential_secret                     # Extract secret
$neg3CredId = [string]$credObj3.credential_id                         # Extract credential id
Write-Host "INFO: neg3 credential_secret_len=$($neg3Secret.Length)"   # Print secret length

$uRevoke = "$BaseUrl/api/devices/$neg3Device/credentials/$neg3CredId/revoke" # Revoke endpoint
$raw = CurlJsonFileRaw -method "POST" -url $uRevoke -token $tok -rawJson "{}" # Revoke credential
$null = EnsureOk -ctx "revoke credential (neg3)" -url $uRevoke -raw $raw # Ensure ok
Write-Host "INFO: neg3 revoked credential_id=$neg3CredId"             # Print revoked id

$payloadObj = @{ metric=$metric; value=21.3; ts_ms=0; credential=$neg3Secret } # Use revoked secret
$payloadJson = ($payloadObj | ConvertTo-Json -Compress -Depth 10)      # Serialize payload
RunIngestAndPublishAndAssert -ctx "neg3" -deviceId $neg3Device -payloadJson $payloadJson -expectMin 0 -expectMax 0 -queryTimeoutMs 12000 # Expect drop
Write-Host "INFO: neg3 ok (revoked credential dropped)"               # Pass message

Write-Host "[PASS] ACCEPTANCE_SPRINTA2_DEVICE_CREDENTIALS_SMOKE"       # Final pass
