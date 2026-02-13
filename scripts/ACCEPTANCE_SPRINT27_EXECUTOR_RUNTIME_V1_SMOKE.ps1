param(
  [string]$baseUrl = "http://127.0.0.1:3000",
  [string]$token = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$m){ throw ("FAIL: " + $m) }
function Info([string]$m){ Write-Host ("INFO: " + $m) }

function Has-Prop($obj, [string]$name){
  if ($null -eq $obj) { return $false }
  return ($obj.PSObject.Properties.Name -contains $name)
}

function Get-Token {
  if ($token -and $token.Trim() -ne "") { return $token.Trim() }
  if ($env:GEOX_AO_ACT_TOKEN -and $env:GEOX_AO_ACT_TOKEN.Trim() -ne "") { return $env:GEOX_AO_ACT_TOKEN.Trim() }

  $p = Join-Path $PSScriptRoot "..\config\auth\ao_act_tokens_v0.json"
  if (!(Test-Path $p)) { return "" }
  $j = Get-Content $p -Raw | ConvertFrom-Json

  if (Has-Prop $j "dev_ao_act_admin_v0") {
    $t = [string]$j.dev_ao_act_admin_v0
    if (-not [string]::IsNullOrWhiteSpace($t)) { return $t.Trim() }
  }

  if (Has-Prop $j "tokens" -and $j.tokens) {
    foreach ($rec in $j.tokens) {
      if (Has-Prop $rec "token") {
        $t = [string]$rec.token
        if (-not [string]::IsNullOrWhiteSpace($t)) { return $t.Trim() }
      }
    }
  }

  return ""
}

function Curl-Get([string]$url, [string]$t){
  $args = @("-s","-m","20","-H","Accept: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += $url
  return & curl.exe @args
}

function Curl-PostJsonFile([string]$url, [string]$jsonPath, [string]$t){
  $args = @("-s","-m","20","-X","POST","-H","Content-Type: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += @("--data-binary", ("@" + $jsonPath), $url)
  return & curl.exe @args
}

$tok = Get-Token
if ($tok -eq "") { Fail "no token found (set -token or GEOX_AO_ACT_TOKEN or config/auth/ao_act_tokens_v0.json)" }

Info ("using baseUrl=" + $baseUrl)
Info ("using token=" + $tok + " (len=" + $tok.Length + ")")

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1") -baseUrl $baseUrl | Out-Null
Info "Sprint16 guardrail ok."

$rawS25 = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1") -baseUrl $baseUrl -token $tok 2>&1 | Out-String
if ($rawS25 -notmatch "\[PASS\] ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE") { Fail ("Sprint25 prerequisite failed. output=" + $rawS25) }
Info "Sprint25 prerequisite ok."

$actTaskId = $null
foreach ($line in ($rawS25 -split "`r?`n")) {
  if ($line -match "act_task_id=([a-zA-Z0-9_\-]+)") { $actTaskId = $Matches[1] }
}
if ([string]::IsNullOrWhiteSpace($actTaskId)) { Fail ("could not extract act_task_id from sprint25 output. output=" + $rawS25) }
Info ("using act_task_id=" + $actTaskId)

$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$idem = ("sprint27_smoke_" + [guid]::NewGuid().ToString("N"))

$receipt = @{
  tenant_id = "tenantA"
  project_id = "projectA"
  group_id = "groupA"
  act_task_id = $actTaskId
  executor_id = @{ kind = "script"; id = "executor_runtime_v1_smoke"; namespace = "geox" }
  execution_time = @{ start_ts = $now; end_ts = $now }
  execution_coverage = @{ kind = "field"; ref = "groupA" }
  resource_usage = @{ fuel_l = $null; electric_kwh = $null; water_l = $null; chemical_ml = $null }
  logs_refs = @(@{ kind = "stdout"; ref = ("executor://smoke/" + $idem) })
  status = "executed"
  constraint_check = @{ violated = $false; violations = @() }
  observed_parameters = @{} # Keep empty: schema forbids unknown keys
  meta = @{ idempotency_key = $idem; note = "Sprint27 run-once smoke" }
}

$tmp = Join-Path $env:TEMP ("geox_s27_receipt_" + [guid]::NewGuid().ToString("N") + ".json")
$json = $receipt | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

$rawReceipt = Curl-PostJsonFile ("{0}/api/control/ao_act/receipt" -f $baseUrl) $tmp $tok
Remove-Item -Force $tmp -ErrorAction SilentlyContinue
Info ("receipt raw=" + $rawReceipt)

$robj = $null
try { $robj = $rawReceipt | ConvertFrom-Json } catch { Fail ("receipt returned non-json: " + $rawReceipt) }
if (-not (Has-Prop $robj "ok") -or $robj.ok -ne $true) { Fail ("receipt write failed: " + $rawReceipt) }

# Verify linkage via AO-ACT index (do NOT pass unsupported query params).
$rawIndex = Curl-Get ("{0}/api/control/ao_act/index?tenant_id=tenantA&project_id=projectA&group_id=groupA" -f $baseUrl) $tok
Info ("index raw bytes=" + $rawIndex.Length)

$idx = $null
try { $idx = $rawIndex | ConvertFrom-Json } catch { Fail ("index returned non-json: " + $rawIndex) }
if (-not (Has-Prop $idx "ok") -or $idx.ok -ne $true) { Fail ("index returned error: " + $rawIndex) }

$idxText = $rawIndex
if ($idxText -notmatch [regex]::Escape($actTaskId)) { Fail ("index does not contain act_task_id=" + $actTaskId) }
if ($idxText -notmatch '"receipt' ) { Fail ("index payload did not include receipt info after writing receipt. raw=" + $rawIndex) }
Info ("receipt visible in index for act_task_id=" + $actTaskId)

$rawS26 = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1") -baseUrl $baseUrl -token $tok 2>&1 | Out-String
if ($rawS26 -notmatch "\[PASS\] ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE") { Fail ("Sprint26 export pipeline failed. output=" + $rawS26) }
Info "Sprint26 pipeline ok."

Write-Host "[PASS] ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE"
