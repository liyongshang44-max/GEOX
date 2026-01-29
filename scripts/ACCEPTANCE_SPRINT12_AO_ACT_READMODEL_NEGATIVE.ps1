# File: scripts/ACCEPTANCE_SPRINT12_AO_ACT_READMODEL_NEGATIVE.ps1
# Sprint 12 Negative Acceptance: AO-ACT ReadModel must NOT change Judge outputs/hashes. // Contract-first discipline

[CmdletBinding()]
param(
  [string]$baseUrl = "http://127.0.0.1:3000" # API base URL (docker-compose server)
)

Set-StrictMode -Version Latest # Enable strict mode for safer scripting
$ErrorActionPreference = "Stop" # Fail fast on any error

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false) # UTF-8 encoder without BOM (curl --data-binary expects exact bytes)

function Fail([string]$msg) { # Exit helper with message
  Write-Host "" # Blank line for readability
  Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red # Render failure
  exit 1 # Non-zero exit
}

function Ensure-ApiReachable([string]$u) { # Probe API health
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("{0}/api/health" -f $u) -Method Get -TimeoutSec 10 # Health probe
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) { Fail ("API probe failed: /api/health HTTP {0}" -f $resp.StatusCode) } # Enforce 2xx
  } catch {
    Fail ("API not reachable at {0}. Error: {1}" -f $u, $_.Exception.Message) # Surface connectivity issue
  }
}

function Write-JsonNoBom([string]$path, [string]$json) { # Write exact JSON bytes without BOM
  [System.IO.File]::WriteAllText($path, $json, $Utf8NoBom) # Write file bytes
}

function CurlPostJsonFile([string]$url, [string]$path) { # POST JSON file via curl.exe (binary-safe)
  $out = & curl.exe -s -X POST $url -H "content-type: application/json" --data-binary ("@{0}" -f $path) # Call API
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed posting to {0}" -f $url) } # Fail on non-zero exit
  return $out # Return raw JSON string
}

function CurlGet([string]$url) { # GET via curl.exe
  $out = & curl.exe -s $url # Call API
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed GET {0}" -f $url) } # Fail on non-zero exit
  return $out # Return body
}

function Parse-Json([string]$raw) { # Parse JSON with depth-friendly serializer
  Add-Type -AssemblyName System.Web.Extensions | Out-Null # Load serializer
  $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer # Create serializer
  $ser.MaxJsonLength = 2147483647 # Allow large responses
  $ser.RecursionLimit = 10000 # Increase recursion limit
  return $ser.DeserializeObject($raw) # Return parsed object (Hashtable/ArrayList-like)
}

function Json-Canonical([object]$obj) { # Canonicalize JSON for stable comparison
  return ($obj | ConvertTo-Json -Depth 50) # Convert to JSON string
}

function Normalize-JsonStable(
  [object]$v,
  [int]$depth = 0,
  [int]$maxDepth = 60,
  [System.Collections.Generic.HashSet[int]]$seen = $null
) {
  if ($null -eq $v) { return $null }
  if ($depth -ge $maxDepth) { return "<depth_limit>" }

  if ($null -eq $seen) {
    $seen = New-Object "System.Collections.Generic.HashSet[int]"
  }

  # primitives
  if ($v -is [string] -or $v -is [bool] -or
      $v -is [int] -or $v -is [long] -or
      $v -is [double] -or $v -is [decimal]) {
    return $v
  }

  # cycle guard (reference types only)
  try {
    $id = [System.Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($v)
    if ($seen.Contains($id)) { return "<cycle>" }
    [void]$seen.Add($id)
  } catch {
    # some value types cannot be hashed – ignore
  }

  # IDictionary (hashtable / dictionary)
  if ($v -is [System.Collections.IDictionary]) {
    $out = @{}
    foreach ($key in $v.Keys) {
      $k = [string]$key

      if ($k -in @(
        "run_id","request_id","trace_id",
        "debug","explain","timing",
        "duration_ms","responseTime",
        "server_time","computed_at",
        "generated_at","evaluated_at"
      )) { continue }

      if ($k -match '(_at|_ts)$') { continue }
      if ($k -match '^(now|time|timestamp)$') { continue }
      if ($k -match '_id$') { continue }

      $out[$k] = Normalize-JsonStable $v[$key] ($depth + 1) $maxDepth $seen
    }

    $ordered = [ordered]@{}
    foreach ($k in ($out.Keys | Sort-Object)) {
      $ordered[$k] = $out[$k]
    }
    return $ordered
  }

  # PSObject with note properties (NO .Count access)
  if ($v -is [psobject]) {
    $props = $v | Get-Member -MemberType NoteProperty -ErrorAction SilentlyContinue
    if ($props) {
      $out = @{}
      foreach ($p in $props) {
        $k = $p.Name

        if ($k -in @(
          "run_id","request_id","trace_id",
          "debug","explain","timing",
          "duration_ms","responseTime",
          "server_time","computed_at",
          "generated_at","evaluated_at"
        )) { continue }

        if ($k -match '(_at|_ts)$') { continue }
        if ($k -match '^(now|time|timestamp)$') { continue }
        if ($k -match '_id$') { continue } 

        $out[$k] = Normalize-JsonStable $v.$k ($depth + 1) $maxDepth $seen
      }

      $ordered = [ordered]@{}
      foreach ($k in ($out.Keys | Sort-Object)) {
        $ordered[$k] = $out[$k]
      }
      return $ordered
    }
  }

  # IEnumerable (arrays / lists)
  if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
    $arr = @()
    foreach ($it in $v) {
      $arr += ,(Normalize-JsonStable $it ($depth + 1) $maxDepth $seen)
    }
    return $arr | Sort-Object { $_ | ConvertTo-Json -Depth 50 }
  }

  # fallback
  return [string]$v
}

Ensure-ApiReachable $baseUrl # Ensure server is up

# 1) Build a minimal Judge run request (anchor by groupId; window is last 10 minutes). // No dependence on AO-ACT
$nowMs = [int64](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())) # Current time in ms
$startMs = $nowMs - (10 * 60 * 1000) # Window start = now - 10min
$endMs = $nowMs # Window end = now

$judgeReq = @{ # Build request as hashtable
  subjectRef = @{ groupId = "G_DEMO_ACCEPTANCE" } # Anchor groupId (may be empty in DB; determinism still applies)
  scale = "group" # Scale label (string)
  window = @{ startTs = $startMs; endTs = $endMs } # Time window
  options = @{ persist = $false; include_reference_views = $false; include_lb_candidates = $false; config_profile = "default" } # Keep output minimal
} | ConvertTo-Json -Depth 20 # Serialize

$tmpJudge = Join-Path $env:TEMP "geox_s12_judge_run.json" # Temp file path
Write-JsonNoBom $tmpJudge $judgeReq # Persist bytes

# 2) Baseline Judge run (before AO-ACT facts). // Capture determinism hash + semantic output
$rawA = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge
$a = Parse-Json $rawA # Parse JSON

if (-not $a.determinism_hash) { Fail "missing determinism_hash in baseline" } # Require determinism_hash
if (-not $a.problem_states) { Fail "missing problem_states in baseline" } # Require problem_states

$stableA = Normalize-JsonStable @{ # Stable projection for semantic comparison
  effective_config_hash = $a.effective_config_hash # Config hash should be stable
  problem_states = $a.problem_states # Normalize volatile fields away
  ao_sense = $a.ao_sense # Normalize volatile fields away
}
$canonA = Json-Canonical $stableA # Canonical stable json

# 3) Insert AO-ACT task + receipt inside the same window. // Must NOT change Judge output/hashes
$task = @{ # AO-ACT task body
  issuer = @{ kind = "human"; id = "u_demo"; namespace = "ns_demo" } # Issuer identity
  action_type = "PLOW" # Allowed action type
  target = @{ kind = "field"; ref = "FIELD_DEMO_001" } # Target reference
  time_window = @{ start_ts = $startMs; end_ts = $endMs } # Execution window (ms)
  parameter_schema = @{ keys = @(
    @{ name = "depth_cm"; type = "number"; min = 0; max = 50 },
    @{ name = "work_mode"; type = "enum"; enum = @("shallow", "deep") },
    @{ name = "use_gps"; type = "boolean" }
  ) } # Parameter schema
  parameters = @{ depth_cm = 12; work_mode = "shallow"; use_gps = $true } # Requested parameters
  constraints = @{ depth_cm = 20; work_mode = "deep"; use_gps = $true } # Constraints
  meta = @{ note = "sprint12_negative" } # Audit metadata
} | ConvertTo-Json -Depth 20 # Serialize

$tmpTask = Join-Path $env:TEMP "geox_s12_ao_act_task.json" # Temp task file
Write-JsonNoBom $tmpTask $task # Persist bytes

$rawTaskResp = CurlPostJsonFile ("{0}/api/control/ao_act/task" -f $baseUrl) $tmpTask # Create task
$taskResp = Parse-Json $rawTaskResp # Parse response
if (-not $taskResp.ok) { Fail ("AO-ACT task create failed: {0}" -f $rawTaskResp) } # Ensure ok

$actTaskId = $taskResp.act_task_id # Capture created act_task_id
if (-not $actTaskId) { Fail "missing act_task_id from AO-ACT task response" } # Require act_task_id

$receipt = @{ # AO-ACT receipt body
  act_task_id = $actTaskId # Link to task
  executor_id = @{ kind = "human"; id = "exec_demo"; namespace = "ns_demo" } # Executor identity
  execution_time = @{ start_ts = $startMs; end_ts = $endMs } # Execution time (ms)
  execution_coverage = @{ kind = "field"; ref = "FIELD_DEMO_001" } # Coverage reference
  resource_usage = @{ fuel_l = $null; electric_kwh = $null; water_l = $null; chemical_ml = $null } # Resource usage (nullable)
  logs_refs = @(@{ kind = "log"; ref = "LOG_DEMO_001" }) # At least one log ref
  status = "executed" # Status enum
  constraint_check = @{ violated = $false; violations = @() } # Constraint check
  observed_parameters = @{ depth_cm = 11; work_mode = "shallow"; use_gps = $true } # Observed parameters
  meta = @{ note = "sprint12_negative" } # Audit metadata
} | ConvertTo-Json -Depth 20 # Serialize

$tmpReceipt = Join-Path $env:TEMP "geox_s12_ao_act_receipt.json" # Temp receipt file
Write-JsonNoBom $tmpReceipt $receipt # Persist bytes

$rawReceiptResp = CurlPostJsonFile ("{0}/api/control/ao_act/receipt" -f $baseUrl) $tmpReceipt # Create receipt
$receiptResp = Parse-Json $rawReceiptResp # Parse response
if (-not $receiptResp.ok) { Fail ("AO-ACT receipt create failed: {0}" -f $rawReceiptResp) } # Ensure ok

# Optional sanity: index should show latest receipt. // Debug-only
$idxRaw = CurlGet ("{0}/api/control/ao_act/index?act_task_id={1}" -f $baseUrl, $actTaskId) # Query index
$idx = Parse-Json $idxRaw # Parse response
if (-not $idx.ok) { Fail ("AO-ACT index query failed: {0}" -f $idxRaw) } # Ensure ok

# 4) Judge run again after AO-ACT facts. // Must be identical in determinism + stable semantic projection
$rawB = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge again
$b = Parse-Json $rawB # Parse JSON

if (-not $b.determinism_hash) { Fail "missing determinism_hash after AO-ACT facts" } # Require determinism_hash

# Hard determinism redline: hash must not change
if ($b.determinism_hash -ne $a.determinism_hash) { Fail ("determinism_hash changed after AO-ACT facts: {0} -> {1}" -f $a.determinism_hash, $b.determinism_hash) } # Enforce no determinism impact

# Persist raw outputs for diff when needed
$tmpA = Join-Path $env:TEMP "geox_s12_judge_before.json" # Baseline output file
$tmpB = Join-Path $env:TEMP "geox_s12_judge_after.json" # After output file
[System.IO.File]::WriteAllText($tmpA, $rawA, $Utf8NoBom) # Write baseline raw
[System.IO.File]::WriteAllText($tmpB, $rawB, $Utf8NoBom) # Write after raw

# Stable projection comparison (semantic; strips volatile fields)
$stableB = Normalize-JsonStable @{ # Stable projection for semantic comparison
  effective_config_hash = $b.effective_config_hash # Config hash should be stable
  problem_states = $b.problem_states # Normalize volatile fields away
  ao_sense = $b.ao_sense # Normalize volatile fields away
}
$canonB = Json-Canonical $stableB # Canonical stable json

if ($canonB -ne $canonA) {
  Fail ("Judge stable semantic projection changed after AO-ACT facts. Diff files: {0} vs {1}. Use: fc.exe `"{0}`" `"{1}`"" -f $tmpA, $tmpB) # Provide paths for fc.exe diff
}

# 5) Forbidden coupling check: Judge response must not expose AO-ACT fields/keys. // Explain-only must stay out of API
if ($rawB -match "ao_act") { Fail "Judge run response contains 'ao_act' (forbidden: explain mirror must not leak into API)" } # Hard redline

Write-Host "PASS: Sprint 12 negative acceptance (AO-ACT facts do not affect Judge outputs/hashes)." -ForegroundColor Green # Success
