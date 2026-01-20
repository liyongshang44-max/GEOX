 # GEOX/scripts/ACCEPTANCE_WEB2_BACKEND.ps1
# GEOX Backend Web2 (Apple I aligned) acceptance script
#
# Notes / guardrails:
# - Overlay kind allowlist is enforced by THIS script.
#   Any contracts-layer expansion MUST update this script's allowlist in sync.
#
# Environment:
# - Windows PowerShell
# - Backend must already be running at $base (default http://127.0.0.1:3000)
# - Does NOT start Web frontend
# - Uses Invoke-RestMethod + curl.exe (multipart)

param(
  [Parameter(Mandatory = $false)]
  [string]$base = "http://127.0.0.1:3000",

  # Use switch + Disable semantics (most stable to call)
  [Parameter(Mandatory = $false)]
  [switch]$DisableCanopy
)

# One internal gate (ALL canopy code must use this)
$EnableCanopy = -not $DisableCanopy.IsPresent

$ErrorActionPreference = "Stop"

function OK([string]$msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function WARN([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function FAIL([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing command: $name"
  }
}

function FailFast([string]$msg) {
  FAIL $msg
  throw $msg
}

function Assert([bool]$cond, [string]$msg) {
  if (-not $cond) { FailFast $msg }
}

function Has-Field($obj, [string]$name) {
  return ($null -ne $obj) -and ($obj.PSObject.Properties.Name -contains $name)
}

function In-Set([string]$v, [string[]]$set) {
  foreach ($x in $set) { if ($x -eq $v) { return $true } }
  return $false
}

function Get-Json([string]$url) {
  try {
    return Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 10
  } catch {
    FailFast "GET failed: $url  ($($_.Exception.Message))"
  }
}

function Post-Json([string]$url, [object]$obj) {
  try {
    return Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($obj | ConvertTo-Json -Compress) -TimeoutSec 10
  } catch {
    FailFast "POST failed: $url  ($($_.Exception.Message))"
  }
}

function Assert-WriteOkOrCompatible($resp, [string]$ctx) {
  # P0 hardening:
  # - if response contains "ok", it MUST be true
  # - if response lacks "ok", allow (compat mode), but still fail if obvious error-like fields exist
  if ($null -eq $resp) { return }
  if ($resp -is [string]) { return }

  if (Has-Field $resp "ok") {
    Assert ($resp.ok -eq $true) "$ctx response ok != true"
  } else {
    if (Has-Field $resp "error")      { FailFast "$ctx response contains error field" }
    if (Has-Field $resp "errors")     { FailFast "$ctx response contains errors field" }
    if (Has-Field $resp "statusCode") { FailFast "$ctx response contains statusCode field" }
  }
}

function Assert-SeriesTopLevelStrict($series, [string]$ctx) {
  # P0 anti-boundary-drift:
  # top-level must be exactly: range,samples,gaps,overlays
  $allow = @("gaps","overlays","range","samples")
  $names = @($series.PSObject.Properties.Name | Sort-Object)
  $allowSorted = @($allow | Sort-Object)

  $sameNames = $true
  if ($names.Count -ne $allowSorted.Count) {
    $sameNames = $false
  } else {
    for ($i=0; $i -lt $names.Count; $i++) {
      if ($names[$i] -ne $allowSorted[$i]) { $sameNames = $false; break }
    }
  }

  if (-not $sameNames) {
    $got = ($names -join ",")
    $exp = ($allowSorted -join ",")
    FailFast "$ctx top-level fields drifted. expected={$exp} got={$got}"
  }
}

Require-Command "curl.exe"

$groupId = $null
$runId   = $null

Write-Host ("[INFO] base=" + $base) -ForegroundColor Cyan
Write-Host ("[INFO] canopy=" + $EnableCanopy.ToString()) -ForegroundColor Cyan

# -------------------------
# P0-1: Reachability & basic contract
# -------------------------

# 1) Groups reachable
try {
  $groupsRes = Get-Json "$base/api/groups?projectId=P_DEFAULT"
  Assert (Has-Field $groupsRes "groups") "P0-1.1 groups missing 'groups' field"
  Assert ($groupsRes.groups -is [System.Array]) "P0-1.1 'groups' is not an array"
  Assert ($groupsRes.groups.Count -ge 1) "P0-1.1 groups.length < 1"
  $groupId = $groupsRes.groups[0].groupId
  Assert ([string]::IsNullOrWhiteSpace($groupId) -eq $false) "P0-1.1 groupId empty"
  OK "P0-1.1 Groups OK (groupId=$groupId)"
} catch {
  FailFast "P0-1.1 Groups failed ($($_.Exception.Message))"
}

# Prepare time window
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$t0  = $now - 600000
$t1  = $now - 540000
$t2  = $now - 480000
$t3  = $now - 420000

# 2) Raw write (append-only)
try {
  $raws = @(
    @{ ts=$t0; sensorId="S1"; metric="moisture"; value=10; quality="ok"; source="device" },
    @{ ts=$t1; sensorId="S1"; metric="moisture"; value=25; quality="ok"; source="device" },
    @{ ts=$t0; sensorId="S2"; metric="moisture"; value=10; quality="ok"; source="device" },
    @{ ts=$t1; sensorId="S2"; metric="moisture"; value=14; quality="ok"; source="device" },
    @{ ts=$t2; sensorId="S2"; metric="moisture"; value=18; quality="ok"; source="device" },
    @{ ts=$t3; sensorId="S2"; metric="moisture"; value=22; quality="ok"; source="device" }
  )
  foreach ($r in $raws) {
    $resp = Post-Json "$base/api/raw" $r
    Assert-WriteOkOrCompatible $resp "P0-1.2 Raw write"
  }
  OK "P0-1.2 Raw write OK (>=6)"
} catch {
  FailFast "P0-1.2 Raw write failed ($($_.Exception.Message))"
}

# 3) Marker write
try {
  $mk = Post-Json "$base/api/marker" @{ ts=$t2; sensorId="S1"; type="device_fault"; note="signal intermittent"; source="gateway" }
  Assert (Has-Field $mk "ok") "P0-1.3 Marker response missing 'ok'"
  Assert ($mk.ok -eq $true) "P0-1.3 Marker ok != true"
  OK "P0-1.3 Marker write OK"
} catch {
  FailFast "P0-1.3 Marker write failed ($($_.Exception.Message))"
}

# 4) Series replay fixed structure (group replay)
$series0 = $null
try {
  $series0 = Get-Json "$base/api/series?groupId=$groupId&metrics=moisture&startTs=$t0&endTs=$now&maxPoints=2000"
  Assert-SeriesTopLevelStrict $series0 "P0-1.4 Series"

  Assert (Has-Field $series0 "range")   "P0-1.4 Series missing 'range'"
  Assert (Has-Field $series0.range "startTs") "P0-1.4 range.startTs missing"
  Assert (Has-Field $series0.range "endTs")   "P0-1.4 range.endTs missing"
  Assert (Has-Field $series0 "samples") "P0-1.4 Series missing 'samples'"
  Assert (Has-Field $series0 "gaps")    "P0-1.4 Series missing 'gaps'"
  Assert (Has-Field $series0 "overlays")"P0-1.4 Series missing 'overlays'"
  Assert ($series0.samples.Count -ge 1) "P0-1.4 samples < 1"
  OK "P0-1.4 Series replay OK (samples=$($series0.samples.Count) overlays=$($series0.overlays.Count) gaps=$($series0.gaps.Count))"
} catch {
  FailFast "P0-1.4 Series replay failed ($($_.Exception.Message))"
}

# -------------------------
# P0-2: Overlay contract
# -------------------------

$KIND_ALLOW = @("device_fault","local_anomaly","step_candidate","drift_candidate")
$SRC_ALLOW  = @("device","gateway","system")
$CONF_ALLOW = @("low","med","high")

# 5) Marker overlay degeneration contract
try {
  $marker = $null
  foreach ($o in $series0.overlays) {
    if ($o.kind -eq "device_fault") { $marker = $o; break }
  }
  Assert ($null -ne $marker) "P0-2.5 No device_fault overlay found in series.overlays"
  Assert ($marker.startTs -eq $marker.endTs) "P0-2.5 device_fault startTs != endTs"
  if (Has-Field $marker "metric") {
    Assert ($null -eq $marker.metric) "P0-2.5 device_fault metric must be null"
  }
  if (Has-Field $marker "confidence") {
    Assert ($null -eq $marker.confidence) "P0-2.5 device_fault confidence must be null"
  }
  Assert (In-Set ([string]$marker.source) $SRC_ALLOW) "P0-2.5 device_fault source not in allowlist"
  OK "P0-2.5 Marker overlay contract OK"
} catch {
  FailFast "P0-2.5 Marker overlay contract failed ($($_.Exception.Message))"
}

# 6) Derived overlay write (manual derive)
try {
  $derive = Post-Json "$base/api/derive/overlays" @{
    groupId     = $groupId
    metrics     = @("moisture")
    startTs     = $t0
    endTs       = $now
    algoVersion = "v0.1"
    params      = @{ stepThreshold=5; driftThreshold=10; driftN=3 }
  }
  Assert (Has-Field $derive "runId") "P0-2.6 derive missing runId"
  Assert ([string]::IsNullOrWhiteSpace([string]$derive.runId) -eq $false) "P0-2.6 runId empty"
  Assert (Has-Field $derive "inserted") "P0-2.6 derive missing inserted"
  Assert ([int]$derive.inserted -ge 1) "P0-2.6 inserted < 1"
  $runId = [string]$derive.runId
  OK "P0-2.6 Derived write OK (runId=$runId inserted=$($derive.inserted))"
} catch {
  FailFast "P0-2.6 Derived write failed ($($_.Exception.Message))"
}

# 7) Derived overlay contract
$series1 = $null
try {
  $series1 = Get-Json "$base/api/series?groupId=$groupId&metrics=moisture&startTs=$t0&endTs=$now&maxPoints=2000"
  Assert-SeriesTopLevelStrict $series1 "P0-2.7 Series"

  $foundDerived = $false
  foreach ($o in $series1.overlays) {
    if ($o.kind -eq "step_candidate" -or $o.kind -eq "drift_candidate") { $foundDerived = $true; break }
  }
  Assert $foundDerived "P0-2.7 No derived overlays (step_candidate/drift_candidate) found"

  foreach ($o in $series1.overlays) {
    if ($o.kind -eq "step_candidate" -or $o.kind -eq "drift_candidate") {
      Assert ([string]::IsNullOrWhiteSpace([string]$o.metric) -eq $false) "P0-2.7 derived metric must be non-empty"
      Assert (In-Set ([string]$o.confidence) $CONF_ALLOW) "P0-2.7 derived confidence not in {low,med,high}"
      Assert ($o.source -eq "system") "P0-2.7 derived source must be 'system'"
      Assert ($o.startTs -le $o.endTs) "P0-2.7 derived startTs > endTs"
    }
  }
  OK "P0-2.7 Derived overlay contract OK"
} catch {
  FailFast "P0-2.7 Derived overlay contract failed ($($_.Exception.Message))"
}

# 8) Overlay kind allowlist
try {
  foreach ($o in $series1.overlays) {
    Assert (In-Set ([string]$o.kind) $KIND_ALLOW) "P0-2.8 overlay.kind not in allowlist: $($o.kind)"
  }
  OK "P0-2.8 Overlay kind allowlist OK"
} catch {
  FailFast "P0-2.8 Overlay kind allowlist failed ($($_.Exception.Message))"
}

# -------------------------
# P0-3: Group replay contract (groupId and sensorId modes)
# -------------------------

try {
  $a = Get-Json "$base/api/series?groupId=$groupId&metrics=moisture&startTs=$t0&endTs=$now&maxPoints=2000"
  Assert-SeriesTopLevelStrict $a "P0-3.9 Series(groupId)"
  $b = Get-Json "$base/api/series?sensorId=S1&metrics=moisture&startTs=$t0&endTs=$now&maxPoints=2000"
  Assert-SeriesTopLevelStrict $b "P0-3.9 Series(sensorId)"
  OK "P0-3.9 Series supports groupId + sensorId modes"
} catch {
  FailFast "P0-3.9 Group/Sensor replay contract failed ($($_.Exception.Message))"
}

# -------------------------
# P1: Weather channel
# -------------------------

try {
  $wNow = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $w0 = $wNow - 3600000
  $w1 = $wNow - 1800000

  Post-Json "$base/api/raw" @{ ts=$w0; sensorId="WX_1"; metric="rain_mm";    value=0.0;  quality="ok"; source="device" } | Out-Null
  Post-Json "$base/api/raw" @{ ts=$w1; sensorId="WX_1"; metric="rain_mm";    value=1.2;  quality="ok"; source="device" } | Out-Null
  Post-Json "$base/api/raw" @{ ts=$w0; sensorId="WX_1"; metric="air_temp_c"; value=18.5; quality="ok"; source="device" } | Out-Null
  Post-Json "$base/api/raw" @{ ts=$w1; sensorId="WX_1"; metric="air_temp_c"; value=18.9; quality="ok"; source="device" } | Out-Null

  $wStart = $wNow - 7200000
  $wRes = Get-Json "$base/api/series?sensorId=WX_1&metrics=rain_mm,air_temp_c&startTs=$wStart&endTs=$wNow&maxPoints=2000"
  Assert-SeriesTopLevelStrict $wRes "P1-10 Series(weather)"

  Assert ($wRes.samples.Count -ge 4) "P1-10 Weather samples < 4"

  $rain = @($wRes.samples | Where-Object { $_.metric -eq "rain_mm" })
  $temp = @($wRes.samples | Where-Object { $_.metric -eq "air_temp_c" })
  Assert ($rain.Count -ge 2) "P1-10 Weather rain_mm samples < 2"
  Assert ($temp.Count -ge 2) "P1-10 Weather air_temp_c samples < 2"

  OK "P1-10 Weather channel OK (samples=$($wRes.samples.Count) rain_mm=$($rain.Count) air_temp_c=$($temp.Count))"
} catch {
  FailFast "P1-10 Weather channel failed ($($_.Exception.Message))"
}

# -------------------------
# P1: Canopy channel (upload/list/media)
# -------------------------

try {
  if (-not $EnableCanopy) {
    WARN "P1-11 Canopy skipped (DisableCanopy)"
  } else {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $imgPath = Join-Path $repoRoot "docs\demo_canopy.jpg"
    if (-not (Test-Path $imgPath)) {
      WARN "P1-11 Canopy skipped (missing $imgPath)"
    } else {
      $cTs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

      $uploadJson = & curl.exe -sS "$base/api/canopy/frame" `
        -F "file=@$imgPath" `
        -F "ts=$cTs" `
        -F "projectId=P_DEFAULT" `
        -F "cameraId=CAM_1" `
        -F "source=device"

      $up = $uploadJson | ConvertFrom-Json
      Assert ($up.ok -eq $true) "P1-11 Canopy upload ok!=true"
      Assert ([string]::IsNullOrWhiteSpace([string]$up.frameId) -eq $false) "P1-11 frameId empty"
      Assert ([string]::IsNullOrWhiteSpace([string]$up.url) -eq $false) "P1-11 url empty"
      OK "P1-11 Canopy upload OK (frameId=$($up.frameId))"

      $cStart = $cTs - 600000
      $cEnd   = $cTs + 600000
      $frames = Get-Json "$base/api/canopy/frames?projectId=P_DEFAULT&startTs=$cStart&endTs=$cEnd"
      Assert (Has-Field $frames "frames") "P1-11 frames response missing 'frames'"
      Assert ($frames.frames.Count -ge 1) "P1-11 frames.length < 1"
      OK "P1-11 Canopy list OK (frames=$($frames.frames.Count))"

      $mediaUrl = "$base$($up.url)"
      $r = Invoke-WebRequest -UseBasicParsing -Uri $mediaUrl -TimeoutSec 10
      Assert ($r.StatusCode -eq 200) "P1-11 media GET != 200"
      OK "P1-11 Canopy media OK ($($up.url))"
    }
  }
} catch {
  FailFast "P1-11 Canopy channel failed ($($_.Exception.Message))"
}

# -------------------------
# Output summary
# -------------------------

$kinds = @()
foreach ($o in $series1.overlays) { $kinds += [string]$o.kind }
$kindSummary = ($kinds | Group-Object | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ", "

Write-Host ""
Write-Host "[INFO] SUMMARY" -ForegroundColor Cyan
Write-Host "base   = $base"
Write-Host "groupId= $groupId"
Write-Host "runId  = $runId"
Write-Host "overlayKinds = $kindSummary"
Write-Host ""

OK "ACCEPTANCE PASS"