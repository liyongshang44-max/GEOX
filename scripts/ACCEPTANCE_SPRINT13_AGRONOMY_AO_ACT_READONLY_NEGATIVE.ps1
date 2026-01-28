# File: scripts/ACCEPTANCE_SPRINT13_AGRONOMY_AO_ACT_READONLY_NEGATIVE.ps1
# Sprint 13 Negative Acceptance: Agronomy may read AO-ACT receipts as evidence and must write new facts, but must NOT mutate AO-ACT or affect Judge outputs/hashes.

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
function Stable-String([object]$x) { # Create a stable string for sorting, without failing on OrderedDictionary
  try {
    # Convert OrderedDictionary -> Hashtable recursively (so ConvertTo-Json won't throw)
    if ($x -is [System.Collections.Specialized.OrderedDictionary]) {
      $h = @{}
      foreach ($k in $x.Keys) { $h[[string]$k] = Stable-String $x[$k] } # Values become stable strings (safe)
      return ($h | ConvertTo-Json -Depth 50)
    }
    return ($x | ConvertTo-Json -Depth 50) # Normal path
  } catch {
    return ($x | Out-String) # Fallback: never throw
  }
}

function Normalize-JsonStable(
  [object]$v,
  [int]$depth = 0,
  [int]$maxDepth = 60,
  [System.Collections.Generic.HashSet[int]]$seen = $null
) {
  if ($null -eq $v) { return $null } # Keep null
  if ($depth -ge $maxDepth) { return "<depth_limit>" } # Depth guard

  if ($null -eq $seen) { $seen = New-Object "System.Collections.Generic.HashSet[int]" } # Cycle guard store

  if ($v -is [string] -or $v -is [bool] -or
      $v -is [int] -or $v -is [long] -or
      $v -is [double] -or $v -is [decimal]) {
    return $v # Primitive passthrough
  }

  try {
    $id = [System.Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($v) # Ref hash
    if ($seen.Contains($id)) { return "<cycle>" } # Cycle marker
    [void]$seen.Add($id) # Mark seen
  } catch { }

  if ($v -is [System.Collections.IDictionary]) {
    $out = @{} # New map
    foreach ($key in $v.Keys) {
      $k = [string]$key # Key string

      if ($k -in @(
        "run_id","request_id","trace_id",
        "debug","explain","timing",
        "duration_ms","responseTime",
        "server_time","computed_at",
        "generated_at","evaluated_at"
      )) { continue } # Drop volatile fields

      if ($k -match '(_at|_ts)$') { continue } # Drop timestamps
      if ($k -match '^(now|time|timestamp)$') { continue } # Drop generic time fields
      if ($k -match '_id$') { continue } # Drop generated ids

      $out[$k] = Normalize-JsonStable $v[$key] ($depth + 1) $maxDepth $seen # Recurse
    }

    $ordered = [ordered]@{}
foreach ($k in ($out.Keys | Sort-Object)) { $ordered[$k] = $out[$k] } # Build stable key order
$plain = @{} # Return plain hashtable to avoid OrderedDictionary serialization issues later
foreach ($k in $ordered.Keys) { $plain[[string]$k] = $ordered[$k] }
return $plain

  }

  if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
    $arr = @() # New array
    foreach ($it in $v) { $arr += ,(Normalize-JsonStable $it ($depth + 1) $maxDepth $seen) } # Recurse items
return $arr | Sort-Object { Stable-String $_ } # Stable sort key without OrderedDictionary JSON crash
  }

  return $v # Fallback
}

Ensure-ApiReachable $baseUrl # Ensure server is up

# 1) Create AO-ACT task (append-only).
$task = @{
  issuer = @{ kind="human"; id="u_demo"; namespace="ns_demo" }
  action_type = "PLOW"
  target = @{ kind="field"; ref="FIELD_DEMO_001" }
  time_window = @{ start_ts = [int64](Get-Date -UFormat %s) * 1000; end_ts = ([int64](Get-Date -UFormat %s) + 60) * 1000 }
  parameter_schema = @{
    keys = @(
      @{ name="depth_cm"; type="number"; min=0; max=50 },
      @{ name="work_mode"; type="enum"; enum=@("shallow","deep") },
      @{ name="use_gps"; type="boolean" }
    )
  }
  parameters  = @{ depth_cm=12; work_mode="shallow"; use_gps=$true }
  constraints = @{ depth_cm=20; work_mode="deep"; use_gps=$true }
  meta = @{ note="s13_demo_task" }
} | ConvertTo-Json -Depth 20

$tmpTask = Join-Path $env:TEMP "geox_s13_ao_act_task.json" # Temp file
Write-JsonNoBom $tmpTask $task # Write bytes

$rawTaskResp = CurlPostJsonFile ("{0}/api/control/ao_act/task" -f $baseUrl) $tmpTask # POST task
$taskResp = Parse-Json $rawTaskResp # Parse

if (-not $taskResp.ok) { Fail ("AO-ACT task create failed: {0}" -f $rawTaskResp) } # Must succeed
$actTaskId = $taskResp.act_task_id # Extract
if (-not $actTaskId) { Fail "missing act_task_id in task response" } # Require id

# 2) Create AO-ACT receipt (append-only).
$receipt = @{
  act_task_id = $actTaskId
  executor_id = @{ kind="human"; id="exec_demo"; namespace="ns_demo" }
  execution_time = @{ start_ts = [int64](Get-Date -UFormat %s) * 1000; end_ts = ([int64](Get-Date -UFormat %s) + 30) * 1000 }
  execution_coverage = @{ kind="field"; ref="FIELD_DEMO_001" }
  resource_usage = @{ fuel_l=$null; electric_kwh=$null; water_l=$null; chemical_ml=$null }
  logs_refs = @(@{ kind="log"; ref="LOG_S13_DEMO_001" })
  status = "executed"
  constraint_check = @{ violated=$false; violations=@() }
  observed_parameters = @{ depth_cm=11; work_mode="shallow"; use_gps=$true }
  meta = @{ note="s13_demo_receipt" }
} | ConvertTo-Json -Depth 20

$tmpReceipt = Join-Path $env:TEMP "geox_s13_ao_act_receipt.json" # Temp file
Write-JsonNoBom $tmpReceipt $receipt # Write bytes

$rawReceiptResp = CurlPostJsonFile ("{0}/api/control/ao_act/receipt" -f $baseUrl) $tmpReceipt # POST receipt
$receiptResp = Parse-Json $rawReceiptResp # Parse

if (-not $receiptResp.ok) { Fail ("AO-ACT receipt create failed: {0}" -f $rawReceiptResp) } # Must succeed
$receiptFactId = $receiptResp.fact_id # Extract
if (-not $receiptFactId) { Fail "missing fact_id in receipt response" } # Require fact pointer

# 3) Snapshot AO-ACT index BEFORE Agronomy write.
$rawIndexBefore = CurlGet ("{0}/api/control/ao_act/index?act_task_id={1}" -f $baseUrl, $actTaskId) # Query AO-ACT index
$indexBefore = Parse-Json $rawIndexBefore # Parse
if (-not $indexBefore.ok) { Fail ("AO-ACT index query(before) failed: {0}" -f $rawIndexBefore) } # Must succeed

# 4) Build a minimal Judge run request.
$nowMs = [int64](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())) # Current time in ms
$startMs = $nowMs - (10 * 60 * 1000) # Window start = now - 10min
$endMs = $nowMs # Window end = now

$judgeReq = @{
  subjectRef = @{ groupId = "G_DEMO_ACCEPTANCE" }
  scale = "group"
  window = @{ startTs = $startMs; endTs = $endMs }
  options = @{ persist = $false; include_reference_views = $false; include_lb_candidates = $false; config_profile = "default" }
} | ConvertTo-Json -Depth 20

$tmpJudge = Join-Path $env:TEMP "geox_s13_judge_run.json" # Temp file
Write-JsonNoBom $tmpJudge $judgeReq # Write bytes

# 5) Judge baseline (after AO-ACT exists, before Agronomy write).
$rawJudgeA = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge
$a = Parse-Json $rawJudgeA # Parse

if (-not $a.determinism_hash) { Fail "missing determinism_hash in baseline" } # Require
if (-not $a.problem_states) { Fail "missing problem_states in baseline" } # Require

$stableA = Normalize-JsonStable @{ effective_config_hash=$a.effective_config_hash; determinism_hash=$a.determinism_hash; problem_states=$a.problem_states; ao_sense=$a.ao_sense } # Stable projection
$canonA = Json-Canonical $stableA # Canonical

# 6) Agronomy reads AO-ACT receipt as evidence and writes NEW facts (must not touch AO-ACT).
$agReq = @{
  receipt_fact_id = $receiptFactId
  meta = @{ note="s13_ag_interpret" }
} | ConvertTo-Json -Depth 20

$tmpAg = Join-Path $env:TEMP "geox_s13_ag_request.json" # Temp file
Write-JsonNoBom $tmpAg $agReq # Write bytes

$rawAgResp = CurlPostJsonFile ("{0}/api/agronomy/v0/ao_act/interpretation" -f $baseUrl) $tmpAg # POST interpretation
$agResp = Parse-Json $rawAgResp # Parse

if (-not $agResp.ok) { Fail ("Agronomy interpretation write failed: {0}" -f $rawAgResp) } # Must succeed
if (-not $agResp.fact_id) { Fail "Agronomy response missing fact_id" } # Must return new fact_id
if (-not $agResp.interpretation_id) { Fail "Agronomy response missing interpretation_id" } # Must return deterministic id

# 6.1) Read back by interpretation_id (read-only query).
$rawAgRead = CurlGet ("{0}/api/agronomy/v0/ao_act/interpretation?interpretation_id={1}" -f $baseUrl, $agResp.interpretation_id) # GET
$agRead = Parse-Json $rawAgRead # Parse
if (-not $agRead.ok) { Fail ("Agronomy interpretation read failed: {0}" -f $rawAgRead) } # Must succeed

# 7) Judge run AFTER Agronomy write: stable projection must remain identical.
$rawJudgeB = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge
$b = Parse-Json $rawJudgeB # Parse

if (-not $b.determinism_hash) { Fail "missing determinism_hash after" } # Require
if (-not $b.problem_states) { Fail "missing problem_states after" } # Require

$stableB = Normalize-JsonStable @{ effective_config_hash=$b.effective_config_hash; determinism_hash=$b.determinism_hash; problem_states=$b.problem_states; ao_sense=$b.ao_sense } # Stable projection
$canonB = Json-Canonical $stableB # Canonical

$tmpBefore = Join-Path $env:TEMP "geox_s13_judge_before.json" # Diff file path
$tmpAfter = Join-Path $env:TEMP "geox_s13_judge_after.json" # Diff file path
Write-JsonNoBom $tmpBefore $canonA # Write stable before
Write-JsonNoBom $tmpAfter $canonB # Write stable after

if ($canonA -ne $canonB) { Fail (("Judge stable semantic projection changed after Agronomy write. Diff files: {0} vs {1}. Use: fc.exe '{0}' '{1}'" -f $tmpBefore, $tmpAfter)) }

# 8) Forbidden coupling check: Judge response must not expose ao_act / agronomy_ao_act fields.
if ($rawJudgeB -match "ao_act") { Fail "Judge run response contains 'ao_act' (forbidden leak into stable API)" } # Hard redline
if ($rawJudgeB -match "agronomy_ao_act") { Fail "Judge run response contains 'agronomy_ao_act' (forbidden leak into stable API)" } # Hard redline

# 9) AO-ACT index must remain unchanged by Agronomy writes.
$rawIndexAfter = CurlGet ("{0}/api/control/ao_act/index?act_task_id={1}" -f $baseUrl, $actTaskId) # Query AO-ACT index again
$indexAfter = Parse-Json $rawIndexAfter # Parse
if (-not $indexAfter.ok) { Fail ("AO-ACT index query(after) failed: {0}" -f $rawIndexAfter) } # Must succeed

$idxA = Json-Canonical (Normalize-JsonStable $indexBefore) # Stable index snapshot before
$idxB = Json-Canonical (Normalize-JsonStable $indexAfter) # Stable index snapshot after

$tmpIdxBefore = Join-Path $env:TEMP "geox_s13_index_before.json" # Index diff path
$tmpIdxAfter = Join-Path $env:TEMP "geox_s13_index_after.json" # Index diff path
Write-JsonNoBom $tmpIdxBefore $idxA # Write before
Write-JsonNoBom $tmpIdxAfter $idxB # Write after

if ($idxA -ne $idxB) { Fail (("AO-ACT index changed after Agronomy write (forbidden). Diff files: {0} vs {1}. Use: fc.exe '{0}' '{1}'" -f $tmpIdxBefore, $tmpIdxAfter)) }

Write-Host "PASS: Sprint 13 negative acceptance (Agronomy uses AO-ACT as read-only evidence; no AO-ACT mutation; no Judge coupling)." -ForegroundColor Green # Success
