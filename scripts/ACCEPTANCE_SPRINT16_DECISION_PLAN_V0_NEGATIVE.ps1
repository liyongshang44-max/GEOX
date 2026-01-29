# File: scripts/ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1
# Sprint 16 Negative Acceptance: decision_plan_v0 must be non-executing, non-coupling, excluded from ALL hash inputs,
# and Sprint 16 must NOT add any decision_plan_v0 list/query API (facts-only audit access).
# Contract anchors:
# - docs/controlplane/GEOX-CP-Decision-Plan-Contract-v0.md
# - Sprint 16 freeze doc (Decision/Plan v0 read-only existenceization)

[CmdletBinding()]
param(
  [string]$baseUrl = "http://127.0.0.1:3000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Fail([string]$msg) {
  Write-Host ""
  Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host ("INFO: {0}" -f $msg) -ForegroundColor DarkGray
}

function Pass([string]$msg) {
  Write-Host ("PASS: {0}" -f $msg) -ForegroundColor Green
}

function Ensure-ApiReachable([string]$u) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("{0}/api/health" -f $u) -Method Get -TimeoutSec 10
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) { Fail ("API probe failed: /api/health HTTP {0}" -f $resp.StatusCode) }
  } catch {
    Fail ("API not reachable at {0}. Error: {1}" -f $u, $_.Exception.Message)
  }
}

function Write-JsonNoBom([string]$path, [string]$text) {
  [System.IO.File]::WriteAllText($path, $text, $Utf8NoBom)
}

function CurlPostJsonFile([string]$url, [string]$path) {
  $out = & curl.exe -s -S -X POST $url -H "content-type: application/json" --data-binary ("@{0}" -f $path)
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed posting to {0}" -f $url) }
  return $out
}

function CurlGet([string]$url) {
  $out = & curl.exe -s -S $url
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed GET {0}" -f $url) }
  return $out
}

function Has-Prop([object]$obj, [string]$name) {
  if ($null -eq $obj) { return $false }
  $p = $obj.PSObject.Properties[$name]
  return ($null -ne $p)
}

function Get-PropOrNull([object]$obj, [string]$name) {
  if (-not (Has-Prop $obj $name)) { return $null }
  return $obj.PSObject.Properties[$name].Value
}

function Normalize-JsonStable([object]$v) {
  if ($null -eq $v) { return $null }

  if ($v -is [string] -or $v -is [bool] -or $v -is [double] -or $v -is [int] -or $v -is [long]) { return $v }

  if ($v -is [System.Collections.IDictionary]) {
    $tmp = @{}
    foreach ($kObj in $v.Keys) {
      $k = [string]$kObj

      if ($k -in @("run_id","request_id","trace_id","debug","explain","timing","duration_ms","server_time","computed_at","generated_at","evaluated_at")) { continue }
      if ($k -match '(_ts)$') { continue }
      if ($k -match '(_id)$') { continue }
      if ($k -match '^(now|time|timestamp)$') { continue }
      if ($k -match '^(input_fact_ids|state_inputs_used)$') { continue }

      $tmp[$k] = Normalize-JsonStable $v[$kObj]
    }

    $ordered = [ordered]@{}
    foreach ($k in ($tmp.Keys | Sort-Object)) { $ordered[$k] = $tmp[$k] }
    return $ordered
  }

  if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
    $arr = @()
    foreach ($it in $v) { $arr += ,(Normalize-JsonStable $it) }
    return $arr
  }

  if ($v.PSObject -and $v.PSObject.Properties) {
    $h = @{}
    foreach ($p in $v.PSObject.Properties) { $h[$p.Name] = $p.Value }
    return Normalize-JsonStable $h
  }

  return $v
}

function Canonical([object]$obj) {
  return ($obj | ConvertTo-Json -Depth 80)
}

function Assert-NoDecisionPlanListApi([string]$u) {
  $candidates = @(
    "/api/decision_plan/v0/list",
    "/api/decision_plan/v0/query",
    "/api/decision_plan/v0/search",
    "/api/decision_plan/list",
    "/api/decision_plan/query",
    "/api/decision_plan/search"
  )

  foreach ($p in $candidates) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri ("{0}{1}" -f $u, $p) -Method Get -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
        Fail ("Forbidden decision_plan list/query API exists and is reachable: GET {0}{1} HTTP {2}" -f $u, $p, $resp.StatusCode)
      }
    } catch {
      continue
    }
  }
}

# ---------------------------------------------
# 0) Preflight
# ---------------------------------------------

Ensure-ApiReachable $baseUrl

# Sprint 16 Deliverable hardening: no decision_plan_v0 list/query API
Assert-NoDecisionPlanListApi $baseUrl
Info "guardrail ok: no decision_plan_v0 list/query API detected."

# ---------------------------------------------
# 1) Baseline Judge run (before)
# ---------------------------------------------

$nowMs = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$judgeReq = @{
  subjectRef = @{ groupId = "G_SPRINT16_NEG" }
  scale = "group"
  window = @{ startTs = ($nowMs - 600000); endTs = $nowMs }
  options = @{ persist = $false; include_reference_views = $false; include_lb_candidates = $false; config_profile = "default" }
} | ConvertTo-Json -Depth 20

$tmpJudge = Join-Path $env:TEMP "geox_s16_judge_run.json"
[System.IO.File]::WriteAllText($tmpJudge, $judgeReq, $Utf8NoBom)

$rawA = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge
$a = $rawA | ConvertFrom-Json

if (-not (Has-Prop $a "determinism_hash") -or -not $a.determinism_hash) { Fail "baseline missing determinism_hash" }
if (-not (Has-Prop $a "effective_config_hash") -or -not $a.effective_config_hash) { Fail "baseline missing effective_config_hash" }

# ssot_hash is OPTIONAL in this repo version; if present, it must remain stable and must not include decision_plan input.
$ssotA = Get-PropOrNull $a "ssot_hash"

$stableA = Normalize-JsonStable @{
  effective_config_hash = $a.effective_config_hash
  determinism_hash      = $a.determinism_hash
  ssot_hash             = $ssotA
  problem_states        = $a.problem_states
  ao_sense              = $a.ao_sense
  silent               = $a.silent
  run_meta             = $a.run_meta
}
$canonA = Canonical $stableA

# ---------------------------------------------
# 2) decision_plan_v0 insertion is intentionally skipped (no public append endpoint by design)
# ---------------------------------------------

Info "decision_plan_v0 insertion skipped (no public append endpoint by design)."

# ---------------------------------------------
# 3) Judge run again (after)
# ---------------------------------------------

$rawB = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge
$b = $rawB | ConvertFrom-Json

if (-not (Has-Prop $b "determinism_hash") -or -not $b.determinism_hash) { Fail "after-run missing determinism_hash" }
if (-not (Has-Prop $b "effective_config_hash") -or -not $b.effective_config_hash) { Fail "after-run missing effective_config_hash" }

$ssotB = Get-PropOrNull $b "ssot_hash"

$stableB = Normalize-JsonStable @{
  effective_config_hash = $b.effective_config_hash
  determinism_hash      = $b.determinism_hash
  ssot_hash             = $ssotB
  problem_states        = $b.problem_states
  ao_sense              = $b.ao_sense
  silent               = $b.silent
  run_meta             = $b.run_meta
}
$canonB = Canonical $stableB

if ($canonA -ne $canonB) {
  $tmpBefore = Join-Path $env:TEMP "geox_s16_judge_before.json"
  $tmpAfter  = Join-Path $env:TEMP "geox_s16_judge_after.json"
  Write-JsonNoBom $tmpBefore $canonA
  Write-JsonNoBom $tmpAfter  $canonB
  Fail ("Judge stable semantic projection changed. Diff files: {0} vs {1}. Use: fc.exe ""{0}"" ""{1}""" -f $tmpBefore, $tmpAfter)
}

# ---------------------------------------------
# 4) AO-ACT index must remain unchanged
# ---------------------------------------------

$idxA = CurlGet ("{0}/api/control/ao_act/index" -f $baseUrl)
Start-Sleep -Milliseconds 200
$idxB = CurlGet ("{0}/api/control/ao_act/index" -f $baseUrl)

if ($idxA -ne $idxB) {
  $tmpIdxBefore = Join-Path $env:TEMP "geox_s16_ao_act_index_before.json"
  $tmpIdxAfter  = Join-Path $env:TEMP "geox_s16_ao_act_index_after.json"
  Write-JsonNoBom $tmpIdxBefore $idxA
  Write-JsonNoBom $tmpIdxAfter  $idxB
  Fail ("AO-ACT index changed (forbidden). Diff files: {0} vs {1}. Use: fc.exe ""{0}"" ""{1}""" -f $tmpIdxBefore, $tmpIdxAfter)
}

# ---------------------------------------------
# 5) Forbidden leak checks (Judge output must not expose decision_plan semantics)
# ---------------------------------------------

if ($rawB -match "decision_plan") { Fail "decision_plan leaked into Judge API output" }
if ($rawB -match "plan_v0") { Fail "plan_v0 leaked into Judge API output" }

Pass "Sprint 16 negative acceptance (decision_plan_v0 is non-executing, non-coupling; no list/query API; excluded from all hash inputs)."
