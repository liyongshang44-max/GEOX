param(
  [string]$BaseUrl = "http://127.0.0.1:3001",               # HTTP base URL of apps/server.
  [string]$MqttUrl  = "mqtt://127.0.0.1:1883",              # MQTT broker URL.
  [string]$TenantId = "tenantA"                             # Tenant used in telemetry topic.
)

Set-StrictMode -Version Latest                              # Enforce strict variable usage.
$ErrorActionPreference = "Stop"                             # Fail fast on errors.

if (-not $env:DATABASE_URL) {                               # Provide a sane local default for child ingest process.
  if (-not $env:PGHOST) { $env:PGHOST = "127.0.0.1" }       # Local Postgres host for docker-mapped DB.
  if (-not $env:PGPORT) { $env:PGPORT = "5433" }            # Local mapped Postgres port.
  if (-not $env:PGUSER) { $env:PGUSER = "landos" }          # Local Postgres user.
  if (-not $env:PGPASSWORD) { $env:PGPASSWORD = "landos_pwd" } # Local Postgres password.
  if (-not $env:PGDATABASE) { $env:PGDATABASE = "landos" }  # Local Postgres database.
  $env:DATABASE_URL = "postgres://$($env:PGUSER):$($env:PGPASSWORD)@$($env:PGHOST):$($env:PGPORT)/$($env:PGDATABASE)" # Explicit DSN for child ingest process.
}

function Fail([string]$m) { throw ("[FAIL] " + $m) }        # Unified failure helper.

function HasProp([object]$o, [string]$name) {               # Safe property existence check.
  if ($null -eq $o) { return $false }                       # Null object => no prop.
  if ($null -eq $o.PSObject) { return $false }              # No PSObject => no prop.
  if ($null -eq $o.PSObject.Properties) { return $false }   # No Properties => no prop.
  return ($o.PSObject.Properties.Match($name).Count -gt 0)  # True if prop exists.
}

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path # Repo root path.

function ReadJsonFile([string]$path) {                      # Read JSON file -> object.
  if (-not (Test-Path -LiteralPath $path)) { return $null } # Missing file => null.
  $raw = Get-Content -LiteralPath $path -Raw                # Read full content.
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }  # Empty => null.
  return ($raw | ConvertFrom-Json)                          # Parse JSON.
}

function PickToken() {                                      # Pick AO-ACT token for auth.
  if ($env:GEOX_AO_ACT_TOKEN) { return $env:GEOX_AO_ACT_TOKEN } # Prefer env override.

  $cfgPath = Join-Path $PSScriptRoot "..\config\auth\ao_act_tokens_v0.json" # Token config path.
  $cfgPath = (Resolve-Path -LiteralPath $cfgPath).Path      # Resolve absolute path.
  $cfg = ReadJsonFile $cfgPath                              # Load config JSON.
  if (-not $cfg) { Fail("no usable token found (config missing) at $cfgPath") } # Must exist.

  $candidates = @()                                         # Candidate token list.

  if (HasProp $cfg "tokens" -and ($cfg.tokens -is [System.Collections.IEnumerable]) -and (-not ($cfg.tokens -is [string]))) {
    foreach ($t in @($cfg.tokens)) {                        # tokens as array.
      if ($null -eq $t) { continue }                        # Skip null entries.
      if ((HasProp $t "revoked") -and ($t.revoked -eq $true)) { continue } # Skip revoked.
      if (-not (HasProp $t "token")) { continue }           # Must have token.
      $tok = [string]$t.token                               # Token string.
      if ([string]::IsNullOrWhiteSpace($tok)) { continue }  # Skip empty token.
      $candidates += [pscustomobject]@{ token = $tok }      # Add candidate.
    }
  } elseif (HasProp $cfg "token") {
    if (-not ((HasProp $cfg "revoked") -and ($cfg.revoked -eq $true))) { # Only if not revoked.
      $tok = [string]$cfg.token                             # Token string.
      if (-not [string]::IsNullOrWhiteSpace($tok)) {        # Only if non-empty.
        $candidates += [pscustomobject]@{ token = $tok }    # Add candidate.
      }
    }
  }

  if ($candidates.Count -lt 1) { Fail("no usable token found in $cfgPath") } # Must exist.
  return [string]$candidates[0].token                       # Pick first usable token.
}

function WriteTempJsonFile([object]$obj) {                  # Write object -> temp JSON file.
  $p = Join-Path $env:TEMP ("geox_json_" + [Guid]::NewGuid().ToString("N") + ".json") # Temp path.
  $json = ($obj | ConvertTo-Json -Compress -Depth 20)       # Serialize JSON.
  [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false))) # UTF-8 no BOM.
  return $p                                                 # Return path.
}

function CurlJsonFile([string]$method, [string]$url, [string]$token, [object]$bodyObj) { # curl with JSON file body.
  $tmp = WriteTempJsonFile $bodyObj                         # Write body to temp file.
  try {
    $args = @(
      "-sS",                                                # Silent but show errors.
      "-H", "Authorization: Bearer $token",                 # Auth header.
      "-H", "Content-Type: application/json",               # JSON content type.
      "-X", $method,                                        # HTTP method.
      $url,                                                 # URL.
      "--data-binary", "@$tmp"                              # Body from file.
    )
    $raw = & curl.exe @args 2>&1 | Out-String               # Run curl.
    return $raw.Trim()                                      # Trim output.
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmp | Out-Null # Cleanup temp file.
  }
}

function CurlGet([string]$url, [string]$token) {            # curl GET helper.
  $args = @(
    "-sS",                                                  # Silent but show errors.
    "-H", "Authorization: Bearer $token",                   # Auth header.
    "-X", "GET",                                            # HTTP method.
    $url                                                    # URL.
  )
  $raw = & curl.exe @args 2>&1 | Out-String                 # Run curl.
  return $raw.Trim()                                        # Trim output.
}

function ParseJsonOrFail([string]$ctx, [string]$raw) {      # Parse JSON response or fail.
  if ([string]::IsNullOrWhiteSpace($raw)) { Fail("${ctx}: empty response") } # Must have content.
  try { return ($raw | ConvertFrom-Json) } catch { Fail("${ctx}: response not json raw=$raw") } # Must be JSON.
}

function EnsureOk([string]$ctx, [string]$url, [string]$raw) { # Ensure API response indicates ok.
  $obj = ParseJsonOrFail $ctx $raw                          # Parse JSON.
  if ($obj.PSObject.Properties.Name -contains "statusCode") { Fail("${ctx}: http error url=$url raw=$raw") } # Fastify error shape.
  if (($obj.PSObject.Properties.Name -contains "ok") -and ($obj.ok -ne $true)) { Fail("${ctx}: expected ok=true url=$url raw=$raw") } # ok discipline.
  return $obj                                               # Return parsed object.
}

function PublishTelemetryOnce([string]$mqttUrl, [string]$tenant, [string]$deviceId, [string]$payloadJson, [int]$timeoutMs) { # MQTT publish via node file.
  $tmpRoot = Join-Path $RepoRoot "_tmp"                     # Repo-scoped temp dir.
  New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null # Ensure temp dir exists.
  $jsPath = Join-Path $tmpRoot ("geox_mqtt_publish_" + [Guid]::NewGuid().ToString("N") + ".cjs") # Temp JS file.

  try {
    $env:GEOX_MQTT_URL = $mqttUrl                           # Pass broker URL.
    $env:GEOX_MQTT_TOPIC = "telemetry/$tenant/$deviceId"    # Pass topic.
    $env:GEOX_MQTT_PAYLOAD_JSON = $payloadJson              # Pass payload JSON.
    $env:GEOX_MQTT_TIMEOUT_MS = [string]$timeoutMs          # Pass watchdog timeout.

    $js = @'
const path = require("path");                               // Path utils.
const { createRequire } = require("module");                // Create require scoped to a package.json.

const ingestPkg = path.resolve(process.cwd(), "apps", "telemetry-ingest", "package.json"); // Resolve package root.
const req = createRequire(ingestPkg);                       // Scoped require for telemetry-ingest deps.
const mqtt = req("mqtt");                                   // Resolve mqtt from telemetry-ingest tree.

const url = process.env.GEOX_MQTT_URL;                      // Broker URL.
const topic = process.env.GEOX_MQTT_TOPIC;                  // Topic.
const payloadRaw = process.env.GEOX_MQTT_PAYLOAD_JSON || "{}"; // Raw JSON payload.
const payload = payloadRaw;                                 // Use provided payload as-is.
const HARD_TIMEOUT_MS = parseInt(process.env.GEOX_MQTT_TIMEOUT_MS || "8000", 10); // Hard timeout.

let done = false;                                           // Completion flag.
const hard = setTimeout(() => {                             // Hard timeout watchdog.
  if (done) return;
  console.error("publish_timeout");
  process.exit(2);
}, HARD_TIMEOUT_MS);

const c = mqtt.connect(url, {                               // Connect to broker.
  connectTimeout: Math.min(5000, Math.max(1500, HARD_TIMEOUT_MS - 1000)), // Connection timeout.
  reconnectPeriod: 0,                                       // No reconnect in smoke test.
});

c.on("connect", () => {                                     // On connect, publish once.
  c.publish(topic, payload, { qos: 1, retain: false }, (err) => { // QoS1 publish, no retain.
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

c.on("error", (e) => {                                      // Connection error handler.
  if (done) return;
  console.error("mqtt_err", e && e.message ? e.message : String(e));
  process.exit(4);
});
'@                                                          # End JS.

    [System.IO.File]::WriteAllText($jsPath, $js, (New-Object System.Text.UTF8Encoding($false))) # Write JS UTF-8 no BOM.

    Push-Location $RepoRoot                                 # Ensure cwd is repo root for require resolution.
    try {
      $raw = (& node $jsPath 2>&1 | Out-String).Trim()      # Run node file.
      $code = $LASTEXITCODE                                 # Capture exit code.
    } finally {
      Pop-Location                                          # Restore cwd.
    }

    if ($code -ne 0) { Fail("mqtt publish: exit=$code raw=`n$raw") } # Must exit 0.
    if ($raw -notmatch "publish_ok") { Fail("mqtt publish: missing publish_ok raw=`n$raw") } # Must contain marker.

    Write-Host ("INFO: " + $raw)                            # Print publish output.
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $jsPath | Out-Null # Cleanup JS file.
  }
}

function GetTelemetryCount([string]$baseUrl, [string]$tok, [string]$device, [string]$metric, [int64]$startMs, [int64]$endMs) { # Query count helper.
  $url = "$baseUrl/api/telemetry/v1/query?device_id=$device&metric=$metric&from_ts_ms=$startMs&to_ts_ms=$endMs&limit=10" # Build URL.
  $raw = CurlGet -url $url -token $tok                      # GET query.
  $obj = EnsureOk -ctx "telemetry query" -url $url -raw $raw # Ensure ok.
  return [int]$obj.count                                    # Return count.
}

function AwaitCountAtLeast([string]$baseUrl, [string]$tok, [string]$device, [string]$metric, [int64]$startMs, [int64]$endMs, [int]$expectCount, [int]$timeoutMs) { # Poll until count reaches expected value.
  $deadline = [int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $timeoutMs # Deadline.
  $count = -1                                               # Current count.
  do {
    Start-Sleep -Milliseconds 600                           # Poll interval.
    $count = GetTelemetryCount -baseUrl $baseUrl -tok $tok -device $device -metric $metric -startMs $startMs -endMs $endMs # Query count.
  } while (($count -ne $expectCount) -and ([int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $deadline)) # Loop until exact count or timeout.

  if ($count -ne $expectCount) { Fail("expected count=$expectCount, got $count device=$device metric=$metric") } # Fail if not reached.
  Write-Host ("INFO: count ok count=" + $count)             # Print success count.
}

# -------------------------
# Main
# -------------------------

$tok = PickToken                                            # Pick token.
Write-Host ("INFO: using GEOX_AO_ACT_TOKEN len=" + $tok.Length) # Print token length.
Write-Host ("INFO: using baseUrl=" + $BaseUrl)              # Print base URL.
Write-Host ("INFO: using mqttUrl=" + $MqttUrl)              # Print MQTT URL.
Write-Host ("INFO: using DATABASE_URL=" + $env:DATABASE_URL) # Print DB URL used by child ingest process.

$metric = "soil_moisture"                                   # Metric under test.

$deviceId = "devA1_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" # Unique device id.
$uDev = "$BaseUrl/api/devices"                              # Device registration endpoint.

$raw = CurlJsonFile -method "POST" -url $uDev -token $tok -bodyObj @{ device_id = $deviceId; display_name = "Dev A1 SMOKE" } # Register device.
$null = EnsureOk -ctx "register device" -url $uDev -raw $raw # Ensure ok.

$uCred = "$BaseUrl/api/devices/$deviceId/credentials"       # Credential issue endpoint.
$raw = CurlJsonFile -method "POST" -url $uCred -token $tok -bodyObj @{} # Issue credential.
$credObj = EnsureOk -ctx "issue credential" -url $uCred -raw $raw # Ensure ok.
if (-not (HasProp $credObj "credential_secret")) { Fail("issue credential: missing credential_secret raw=$raw") } # Must have secret.
$secret = [string]$credObj.credential_secret                # Extract secret.
Write-Host ("INFO: using credential len=" + $secret.Length) # Print secret length.

$p = Start-Process -FilePath (Get-Command pnpm -ErrorAction Stop).Source `
  -ArgumentList @("-C", "apps/telemetry-ingest", "dev", "--", "--once") `
  -WorkingDirectory $RepoRoot -NoNewWindow -PassThru        # Start ingest process.
Start-Sleep -Milliseconds 1500                              # Give ingest time to connect and subscribe.

try {
  $ts1 = [int64][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() # First timestamp.
  $ts2 = $ts1 + 1000                                        # Second timestamp for new-point check.
  $startMs = $ts1 - 8000                                    # Start of query window.
  $endMs   = $ts2 + 12000                                   # End of query window.

  $payload1 = @{ metric = $metric; value = 21.3; ts_ms = $ts1; credential = $secret } | ConvertTo-Json -Compress -Depth 10 # First payload JSON.
  $payload2 = @{ metric = $metric; value = 21.3; ts_ms = $ts2; credential = $secret } | ConvertTo-Json -Compress -Depth 10 # Second payload JSON.

  PublishTelemetryOnce -mqttUrl $MqttUrl -tenant $TenantId -deviceId $deviceId -payloadJson $payload1 -timeoutMs 8000 # Publish first message.
  AwaitCountAtLeast -baseUrl $BaseUrl -tok $tok -device $deviceId -metric $metric -startMs $startMs -endMs $endMs -expectCount 1 -timeoutMs 20000 # Wait for first ingest.

  PublishTelemetryOnce -mqttUrl $MqttUrl -tenant $TenantId -deviceId $deviceId -payloadJson $payload1 -timeoutMs 8000 # Publish duplicate point.
  AwaitCountAtLeast -baseUrl $BaseUrl -tok $tok -device $deviceId -metric $metric -startMs $startMs -endMs $endMs -expectCount 1 -timeoutMs 20000 # Count must remain 1.

  PublishTelemetryOnce -mqttUrl $MqttUrl -tenant $TenantId -deviceId $deviceId -payloadJson $payload2 -timeoutMs 8000 # Publish new point.
  AwaitCountAtLeast -baseUrl $BaseUrl -tok $tok -device $deviceId -metric $metric -startMs $startMs -endMs $endMs -expectCount 2 -timeoutMs 20000 # Count must advance to 2.
} finally {
  try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } } catch {} # Ensure ingest is stopped.
}

Write-Host "[PASS] ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE" # Final pass marker.