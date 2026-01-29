# File: scripts/ACCEPTANCE_SPRINT14_AGRONOMY_INTERPRETATION_V1_NEGATIVE.ps1 # Sprint 14 negative acceptance file path
# Sprint 14 Negative Acceptance: agronomy_interpretation_v1 must NOT change Judge outputs/hashes; must NOT leak into Judge API. # Contract-first discipline summary

[CmdletBinding()] # Enable advanced function semantics for parameters
param( # Parameter block
  [string]$baseUrl = "http://127.0.0.1:3000" # API base URL (docker-compose server)
) # End param

Set-StrictMode -Version Latest # Enable strict mode (catches undefined variables/properties)
$ErrorActionPreference = "Stop" # Fail fast on any error

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false) # UTF-8 encoder without BOM (curl --data-binary expects exact bytes)
function Parse-Json([string]$raw) { # Parse JSON using PS 5.1 compatible parser
  return ($raw | ConvertFrom-Json) # PS 5.1 has no -Depth; Judge output depth is safe
}
function Get-JsonProp([object]$obj, [string]$name) { # Safe property getter under StrictMode
  if ($null -eq $obj) { return $null } # Null guard
  $p = $obj.PSObject.Properties[$name] # Try get property by name
  if ($null -eq $p) { return $null } # Missing property
  return $p.Value # Return value
}


function Fail([string]$msg) { # Exit helper with message
  Write-Host "" # Blank line for readability
  Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red # Render failure
  exit 1 # Non-zero exit
} # End Fail

function Info([string]$msg) { # Info helper
  Write-Host ("INFO: {0}" -f $msg) -ForegroundColor DarkGray # Render info
} # End Info

function Ensure-ApiReachable([string]$u) { # Probe API health
  try { # Try request
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("{0}/api/health" -f $u) -Method Get -TimeoutSec 10 # Health probe
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) { Fail ("API probe failed: /api/health HTTP {0}" -f $resp.StatusCode) } # Enforce 2xx
  } catch { # Catch request failure
    Fail ("API not reachable at {0}. Error: {1}" -f $u, $_.Exception.Message) # Surface connectivity issue
  } # End catch
} # End Ensure-ApiReachable

function Write-JsonNoBom([string]$path, [string]$json) { # Write exact JSON bytes without BOM
  [System.IO.File]::WriteAllText($path, $json, $Utf8NoBom) # Write file bytes
} # End Write-JsonNoBom

function CurlPostJsonFile([string]$url, [string]$path) { # POST JSON file via curl.exe (binary-safe)
  $out = & curl.exe -s -S -X POST $url -H "content-type: application/json" --data-binary ("@{0}" -f $path) # Call API
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed posting to {0}" -f $url) } # Fail on non-zero exit
  return $out # Return raw JSON string
} # End CurlPostJsonFile

function CurlGet([string]$url) { # GET via curl.exe
  $out = & curl.exe -s -S $url # Call API
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed GET {0}" -f $url) } # Fail on non-zero exit
  return $out # Return body
} # End CurlGet


function Json-Canonical([object]$obj) { # Canonicalize JSON for stable comparison
  return ($obj | ConvertTo-Json -Depth 20) # Convert to stable JSON string (depth 20 is enough for our projected subset)
} # End Json-Canonical

function Get-Prop([object]$obj, [string]$name) { # Safe property accessor (works for hashtable and PSCustomObject from serializer)
  if ($null -eq $obj) { return $null } # Null guard
  if ($obj -is [hashtable]) { # Hashtable branch
    if ($obj.ContainsKey($name)) { return $obj[$name] } # Return existing key
    return $null # Missing key
  } # End hashtable
  if ($obj.PSObject -and ($obj.PSObject.Properties.Name -contains $name)) { return $obj.$name } # PSCustomObject branch
  return $null # Default missing
} # End Get-Prop
function Get-Any([object]$obj, [string[]]$names) { # Return first existing property among candidates
  foreach ($n in $names) { # Iterate candidate names
    $v = Get-Prop $obj $n # Read property
    if ($null -ne $v -and $v -ne "") { return $v } # Return first non-null/non-empty
  } # End foreach
  return $null # Nothing found
} # End Get-Any

function Project-Window([object]$w) { # Project window to stable subset
  $startTs = Get-Prop $w "startTs" # Extract startTs
  $endTs = Get-Prop $w "endTs" # Extract endTs
  return [ordered]@{ startTs = $startTs; endTs = $endTs } # Return stable ordered window object
} # End Project-Window

function Project-SubjectRef([object]$sr) { # Project subjectRef to stable subset
  $groupId = Get-Prop $sr "groupId" # Extract groupId
  return [ordered]@{ groupId = $groupId } # Return stable ordered subjectRef object
} # End Project-SubjectRef

function Project-ProblemStates([object]$arr) { # Project problem_states list to stable semantic subset
  $out = @() # Initialize output list
  if ($null -eq $arr) { return @() } # Null => empty list
  foreach ($ps in $arr) { # Iterate items
    $problem = Get-Prop $ps "problem" # Extract problem object (shape is stable and should not depend on interpretation)
    $subjectRef = Project-SubjectRef (Get-Prop $ps "subjectRef") # Project subjectRef
    $scale = Get-Prop $ps "scale" # Extract scale
    $window = Project-Window (Get-Prop $ps "window") # Project window
    $systemDegraded = Get-Prop $ps "system_degraded" # Extract system_degraded flag
    $stateLayerHint = Get-Prop $ps "state_layer_hint" # Extract state_layer_hint
    $rateClassHint = Get-Prop $ps "rate_class_hint" # Extract rate_class_hint
    $markersUsed = Get-Prop $ps "markers_used" # Extract markers_used list (may be empty)
    $out += ,([ordered]@{ # Append projected record (ordered keys)
      type = Get-Prop $ps "type" # Keep schema type label
      schema_version = Get-Prop $ps "schema_version" # Keep schema version label
      subjectRef = $subjectRef # Keep subjectRef (stable)
      scale = $scale # Keep scale (stable)
      window = $window # Keep window (stable)
      problem = $problem # Keep problem object (semantic content; excludes ids/timestamps)
      markers_used = $markersUsed # Keep marker usage list (should be stable; safe for negative coupling)
      system_degraded = $systemDegraded # Keep degraded flag (semantic)
      state_layer_hint = $stateLayerHint # Keep hint (semantic)
      rate_class_hint = $rateClassHint # Keep hint (semantic)
    }) # End projected record
  } # End foreach
  return $out # Return projected list
} # End Project-ProblemStates

function Project-AoSense([object]$arr) { # Project ao_sense list to stable semantic subset
  $out = @() # Initialize output list
  if ($null -eq $arr) { return @() } # Null => empty list
  foreach ($s in $arr) { # Iterate items
    $subjectRef = Project-SubjectRef (Get-Prop $s "subjectRef") # Project subjectRef
    $scale = Get-Prop $s "scale" # Extract scale
    $window = Project-Window (Get-Prop $s "window") # Project window
    $priority = Get-Prop $s "priority" # Extract priority
    $senseKind = Get-Prop $s "sense_kind" # Extract sense_kind
    $senseFocus = Get-Prop $s "sense_focus" # Extract sense_focus
    $note = Get-Prop $s "note" # Extract note (semantic text)
    $out += ,([ordered]@{ # Append projected record (ordered keys)
      type = Get-Prop $s "type" # Keep schema type label
      schema_version = Get-Prop $s "schema_version" # Keep schema version label
      subjectRef = $subjectRef # Keep subjectRef (stable)
      scale = $scale # Keep scale (stable)
      window = $window # Keep window (stable)
      priority = $priority # Keep priority (semantic)
      sense_kind = $senseKind # Keep sense_kind (semantic)
      sense_focus = $senseFocus # Keep sense_focus (semantic)
      note = $note # Keep note (semantic)
      # NOTE: explicitly NOT projecting: ao_sense_id / run_id / created_at_ts / supporting_problem_state_id (ids vary per run)
    }) # End projected record
  } # End foreach
  return $out # Return projected list
} # End Project-AoSense

function Project-JudgeSemantic([object]$resp) { # Create a stable semantic projection of judge/run response (no deep recursion)
  $detHash = Get-Prop $resp "determinism_hash" # Extract determinism_hash
  $cfgHash = Get-Prop $resp "effective_config_hash" # Extract effective_config_hash
  $problemStates = Project-ProblemStates (Get-Prop $resp "problem_states") # Project problem_states list
  $aoSense = Project-AoSense (Get-Prop $resp "ao_sense") # Project ao_sense list
  return [ordered]@{ # Return stable ordered projection
    determinism_hash = $detHash # Hash must be stable across this test
    effective_config_hash = $cfgHash # Config hash must be stable across this test
    problem_states = $problemStates # Semantic stable subset
    ao_sense = $aoSense # Semantic stable subset
  } # End projection
} # End Project-JudgeSemantic

Ensure-ApiReachable $baseUrl # Ensure server is up

# 1) Build a minimal Judge run request (stable subjectRef + window). # Prepare baseline Judge input
$nowMs = [int64](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())) # Current time in ms
$startMs = $nowMs - (10 * 60 * 1000) # Window start = now - 10min
$endMs = $nowMs # Window end = now

$judgeReqObj = @{ # Build request hashtable
  subjectRef = @{ groupId = "G_DEMO_ACCEPTANCE" } # Anchor groupId
  scale = "group" # Scale label
  window = @{ startTs = $startMs; endTs = $endMs } # Time window
  options = @{ persist = $false; include_reference_views = $false; include_lb_candidates = $false; config_profile = "default" } # Keep output minimal
} # End request object

$judgeReq = $judgeReqObj | ConvertTo-Json -Depth 20 # Serialize request to JSON
$tmpJudge = Join-Path $env:TEMP "geox_s14_judge_run.json" # Temp request path
Write-JsonNoBom $tmpJudge $judgeReq # Write request JSON bytes (no BOM)

# 2) Baseline Judge run (before interpretation insertion). # Capture baseline output
$rawA = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge
$a = Parse-Json $rawA # Parse baseline JSON

$okA = Get-Any $a @("ok") # Read ok flag if present
if ($null -ne $okA -and $okA -ne $true) { # If endpoint uses ok=false style, fail with its error
  $errA = Get-Any $a @("error","message") # Read error field
  if (-not $errA) { $errA = "judge_run_failed" } # Default error text
  Fail ("judge/run baseline returned ok=false: {0}" -f $errA) # Hard fail
} # End ok check

$detA = Get-Any $a @("determinism_hash","determinismHash") # Accept snake_case or camelCase
if (-not $detA) { Fail "missing determinism_hash (or determinismHash) in baseline" } # Require determinism hash

$projA = Project-JudgeSemantic $a # Build stable semantic projection
$projA.determinism_hash = $detA # Force projected field name to determinism_hash (stable key)

$canonA = Json-Canonical $projA # Canonical JSON string for comparison

$tmpBefore = Join-Path $env:TEMP "geox_s14_judge_before.json" # Baseline snapshot path
Write-JsonNoBom $tmpBefore $canonA # Persist canonical baseline snapshot (for fc.exe diff)

# 3) Insert a minimal agronomy_interpretation_v1 via append endpoint (append-only). # Insert interpretation fact
$interpretation = @{ # Build minimal interpretation payload
  subject_ref = @{ groupId = "G_DEMO_ACCEPTANCE" } # Same subject_ref as judge
  dimension = "water_status" # Interpretation dimension (non-executable)
  description = "demo interpretation: explain-only; not a decision" # Human-readable explanation
  evidence_refs = @(@{ kind = "marker"; ref = "M_DEMO_001" }) # Evidence pointers (illustrative)
  confidence = 0.5 # Confidence is not an action threshold
  meta = @{ note = "sprint14_acceptance_demo" } # Non-executable meta
} | ConvertTo-Json -Depth 20 # Serialize interpretation JSON

$tmpInterp = Join-Path $env:TEMP "geox_s14_interpretation.json" # Temp interpretation path
Write-JsonNoBom $tmpInterp $interpretation # Write interpretation JSON bytes (no BOM)

$rawIns = CurlPostJsonFile ("{0}/api/agronomy/interpretation_v1/append" -f $baseUrl) $tmpInterp # Call append endpoint
$ins = Parse-Json $rawIns # Parse insertion response

$insOk = Get-JsonProp $ins "ok" # Optional ok field
$insFactId = Get-JsonProp $ins "fact_id" # Preferred fact_id field
if (-not $insFactId) { $insFactId = Get-JsonProp $ins "factId" } # Backward/alt field name

$insErr = Get-JsonProp $ins "error" # Optional error field
if (-not $insErr) { $insErr = "unknown_error" } # Default error

if ($null -ne $insOk) { # If endpoint returns ok, enforce it
  if (-not [bool]$insOk) { Fail ("failed to insert agronomy_interpretation_v1: {0}" -f $insErr) } # Must be ok=true
} else { # If ok not present, require fact_id as success signal
  if (-not $insFactId) { Fail ("failed to insert agronomy_interpretation_v1: missing fact_id (and no ok field). Raw={0}" -f $rawIns) } # Must return fact id
}

Info ("inserted agronomy_interpretation_v1 fact_id={0}" -f $insFactId) # Emit inserted fact_id

# 4) Forbidden-key redline: nested forbid key must be rejected (write-side). # Enforce forbid list recursion
$bad = @{ # Build payload containing forbidden key inside meta
  subject_ref = @{ groupId = "G_DEMO_ACCEPTANCE" } # Subject ref
  dimension = "water_status" # Dimension
  description = "this must be rejected due to forbidden nested key" # Description
  evidence_refs = @(@{ kind = "marker"; ref = "M_DEMO_001" }) # Evidence refs
  confidence = 0.5 # Confidence
  meta = @{ nested = @{ recommendation = "DO NOT ALLOW" } } # Forbidden key: recommendation
} | ConvertTo-Json -Depth 20 # Serialize bad payload

$tmpBad = Join-Path $env:TEMP "geox_s14_interpretation_bad.json" # Temp bad payload path
Write-JsonNoBom $tmpBad $bad # Write bad JSON bytes

$rawBad = CurlPostJsonFile ("{0}/api/agronomy/interpretation_v1/append" -f $baseUrl) $tmpBad # Attempt to append bad payload
$badResp = Parse-Json $rawBad # Parse bad response

$badOk = Get-JsonProp $badResp "ok" # Optional ok field
$badErr = Get-JsonProp $badResp "error" # Optional error field
if (-not $badErr) { $badErr = "no_error_field" } # Default when missing

if ($null -ne $badOk) { # If ok exists, it must be false
  if ([bool]$badOk -eq $true) { Fail "forbidden-key payload was accepted (must reject)" } # Must reject
} else {
  # If ok not present, we still require a FORBIDDEN_KEY error signature
  # (If endpoint uses HTTP 400 but still returns JSON without ok, we accept this branch)
}

if (-not ($badErr -match "^FORBIDDEN_KEY:")) { Fail ("forbidden-key payload rejected with unexpected error: {0}" -f $badErr) } # Must be FORBIDDEN_KEY
Info ("forbidden-key rejection ok: {0}" -f $badErr) # Emit rejection info

# 5) Judge run after interpretation insertion (must be identical in stable projection). # Re-run Judge and compare
$rawB = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # Call Judge again
$b = Parse-Json $rawB # Parse after JSON

$okB = Get-Any $b @("ok") # Read ok flag if present
if ($null -ne $okB -and $okB -ne $true) { # If endpoint uses ok=false style, fail with its error
  $errB = Get-Any $b @("error","message") # Read error field
  if (-not $errB) { $errB = "judge_run_failed" } # Default error text
  Fail ("judge/run after insertion returned ok=false: {0}" -f $errB) # Hard fail
} # End ok check

$detB = Get-Any $b @("determinism_hash","determinismHash") # Accept snake_case or camelCase
if (-not $detB) { Fail "missing determinism_hash (or determinismHash) after insertion" } # Require determinism hash

$projB = Project-JudgeSemantic $b # Build stable semantic projection
$projB.determinism_hash = $detB # Force projected field name to determinism_hash (stable key)

$canonB = Json-Canonical $projB # Canonical JSON string for comparison

$tmpAfter = Join-Path $env:TEMP "geox_s14_judge_after.json" # After snapshot path
Write-JsonNoBom $tmpAfter $canonB # Persist canonical after snapshot (for fc.exe diff)

if ($canonA -ne $canonB) { # Compare stable projections
  $msg = ("Judge stable semantic projection changed after interpretation insertion. Diff files: {0} vs {1}. Use: fc.exe ""{0}"" ""{1}""" -f $tmpBefore, $tmpAfter) # Format diff hint without PS parsing issues
  Fail $msg # Fail test with diff hint
} # End compare

# 6) Forbidden coupling check: Judge response must not expose interpretation type/keys. # Ensure no leakage into API
if ($rawB -match "agronomy_interpretation_v1") { Fail "Judge run response contains agronomy_interpretation_v1 (forbidden: interpretation must not leak into Judge API)" } # Hard redline

Write-Host "PASS: Sprint 14 negative acceptance (interpretation is explain-only; no Judge coupling; forbid-list enforced)." -ForegroundColor Green # Success
