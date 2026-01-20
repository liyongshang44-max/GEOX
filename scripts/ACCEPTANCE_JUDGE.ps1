param(
  [string]$BaseUrl = "http://localhost:3000",
  [Parameter(Mandatory=$true)][string]$InputJsonPath
)

$ErrorActionPreference = "Stop"

function Post-Run($path) {
  $raw = curl.exe -s -X POST "$BaseUrl/api/judge/run" -H "Content-Type: application/json" --data-binary "@$path"
  return ($raw | ConvertFrom-Json)
}

function Get-Json($url) {
  $raw = curl.exe -s "$url"
  return ($raw | ConvertFrom-Json)
}

function Assert($cond, $msg) {
  if (-not $cond) { throw "ASSERT FAILED: $msg" }
}

Write-Host "== 0) API availability ==" -ForegroundColor Cyan
$psList = Get-Json "$BaseUrl/api/judge/problem_states?limit=5"
$rvList = Get-Json "$BaseUrl/api/judge/reference_views?limit=5"
$aoList = Get-Json "$BaseUrl/api/judge/ao_sense?limit=5"
Assert ($psList -ne $null) "problem_states endpoint not reachable"
Assert ($rvList -ne $null) "reference_views endpoint not reachable"
Assert ($aoList -ne $null) "ao_sense endpoint not reachable"
Write-Host "OK"

Write-Host "== 1) Run 3x, deterministic_hash stable ==" -ForegroundColor Cyan
$r1 = Post-Run $InputJsonPath
Start-Sleep -Milliseconds 50
$r2 = Post-Run $InputJsonPath
Start-Sleep -Milliseconds 50
$r3 = Post-Run $InputJsonPath

Assert ($r1.determinism_hash -eq $r2.determinism_hash) "determinism_hash changed between run1/run2"
Assert ($r2.determinism_hash -eq $r3.determinism_hash) "determinism_hash changed between run2/run3"
Write-Host ("determinism_hash = {0}" -f $r1.determinism_hash)

Write-Host "== 2) 0 or 1 ProblemState per run ==" -ForegroundColor Cyan
Assert (($r1.problem_states.Count -le 1) -and ($r2.problem_states.Count -le 1) -and ($r3.problem_states.Count -le 1)) "problem_states length > 1"
Write-Host "OK"

Write-Host "== 3) Silent-by-default invariants ==" -ForegroundColor Cyan
# If silent=true, must NOT emit PS or AO-SENSE.
foreach ($r in @($r1,$r2,$r3)) {
  if ($r.silent -eq $true) {
    Assert (($r.problem_states.Count -eq 0) -or ($null -eq $r.problem_states)) "silent=true but problem_states not empty"
    Assert (($r.ao_sense.Count -eq 0) -or ($null -eq $r.ao_sense)) "silent=true but ao_sense not empty"
  }
}
Write-Host "OK"

Write-Host "== 4) If ProblemState exists, AO-SENSE must bind it ==" -ForegroundColor Cyan
foreach ($r in @($r1,$r2,$r3)) {
  if ($r.problem_states.Count -eq 1) {
    $psid = $r.problem_states[0].problem_state_id
    # AO-SENSE is optional, but if present must bind
    if ($r.ao_sense -ne $null -and $r.ao_sense.Count -gt 0) {
      foreach ($ao in $r.ao_sense) {
        Assert ($ao.supporting_problem_state_id -eq $psid) "AO-SENSE not bound to problem_state_id"
      }
    }
  } else {
    # If no ProblemState, AO-SENSE must be empty
    Assert (($r.ao_sense.Count -eq 0) -or ($null -eq $r.ao_sense)) "ao_sense present while no problem_state"
  }
}
Write-Host "OK"

Write-Host "== 5) include_reference_views does not change judgment path ==" -ForegroundColor Cyan
# Create two inputs: same except include_reference_views toggled.
$inputObj = Get-Content $InputJsonPath -Raw | ConvertFrom-Json
if ($null -eq $inputObj.options) { $inputObj | Add-Member -NotePropertyName options -NotePropertyValue (@{}) }
$inputObj.options.include_reference_views = $false
$pathA = Join-Path $env:TEMP "judge_in_a.json"
($inputObj | ConvertTo-Json -Depth 50) | Set-Content -Encoding UTF8 $pathA

$inputObj.options.include_reference_views = $true
$pathB = Join-Path $env:TEMP "judge_in_b.json"
($inputObj | ConvertTo-Json -Depth 50) | Set-Content -Encoding UTF8 $pathB

$ra = Post-Run $pathA
$rb = Post-Run $pathB

# Compare judgment-relevant fields only (ignore ids/timestamps, allow payload to differ)
$ja = @{
  silent = $ra.silent
  determinism_hash = $ra.determinism_hash
  problem_states = $ra.problem_states | ForEach-Object {
    @{
      problem_type = $_.problem_type
      uncertainty_sources = $_.uncertainty_sources
      problem_scope = $_.problem_scope
      metrics_involved = $_.metrics_involved
      sensors_involved = $_.sensors_involved
    }
  }
} | ConvertTo-Json -Depth 50

$jb = @{
  silent = $rb.silent
  determinism_hash = $rb.determinism_hash
  problem_states = $rb.problem_states | ForEach-Object {
    @{
      problem_type = $_.problem_type
      uncertainty_sources = $_.uncertainty_sources
      problem_scope = $_.problem_scope
      metrics_involved = $_.metrics_involved
      sensors_involved = $_.sensors_involved
    }
  }
} | ConvertTo-Json -Depth 50

Assert ($ja -eq $jb) "include_reference_views changed judgment path"
Write-Host "OK"

Write-Host "== 6) Append-only smoke check (list endpoints should grow or stay) ==" -ForegroundColor Cyan
$before = (Get-Json "$BaseUrl/api/judge/problem_states?limit=50").problem_states.Count
$r = Post-Run $InputJsonPath
$after = (Get-Json "$BaseUrl/api/judge/problem_states?limit=50").problem_states.Count
Assert ($after -ge $before) "problem_states list count decreased (should be append-only)"
Write-Host "OK"

Write-Host "`nALL CHECKS PASSED." -ForegroundColor Green