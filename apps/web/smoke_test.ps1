# GEOX/apps/web/smoke_test.ps1
# Smoke test: backend + web UI (PowerShell)
$ErrorActionPreference = "Stop"

$base = "http://localhost:3000"

Write-Host "== GET /api/groups?projectId=P_DEFAULT =="
$groups = Invoke-RestMethod "$base/api/groups?projectId=P_DEFAULT"
$groups | ConvertTo-Json -Depth 10

$gid = $groups.groups[0].groupId
Write-Host "Using groupId=$gid"

$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$t0  = $now - 600000
$t1  = $now - 540000
$t2  = $now - 480000
$t3  = $now - 420000

function Post-Json($url, $obj) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($obj | ConvertTo-Json -Compress)
}

Write-Host "== POST /api/raw (S1,S2 moisture) =="
Post-Json "$base/api/raw" @{ ts=$t0; sensorId="S1"; metric="moisture"; value=10; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t1; sensorId="S1"; metric="moisture"; value=25; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t0; sensorId="S2"; metric="moisture"; value=10; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t1; sensorId="S2"; metric="moisture"; value=14; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t2; sensorId="S2"; metric="moisture"; value=18; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t3; sensorId="S2"; metric="moisture"; value=22; quality="ok"; source="device" } | Out-Null

Write-Host "== POST /api/marker =="
Post-Json "$base/api/marker" @{ ts=$t2; sensorId="S1"; type="device_fault"; note="signal intermittent"; source="gateway" } | ConvertTo-Json -Depth 5

Write-Host "== POST /api/derive/overlays (manual) =="
$deriveRes = Post-Json "$base/api/derive/overlays" @{
  groupId=$gid
  metrics=@("moisture")
  startTs=$t0
  endTs=$now
  algoVersion="v0.1"
  params=@{ stepThreshold=5; driftThreshold=10; driftN=3 }
}
$deriveRes | ConvertTo-Json -Depth 10

Write-Host "== GET /api/series (group replay) =="
$seriesUrl = "$base/api/series?groupId=$gid&metrics=moisture&startTs=$t0&endTs=$now&maxPoints=2000"
$series = Invoke-RestMethod $seriesUrl
"Samples: $($series.samples.Count)  Overlays: $($series.overlays.Count)"
$series.overlays | Select-Object startTs,endTs,sensorId,metric,kind,confidence,source,note | ConvertTo-Json -Depth 10

Write-Host "== Web manual steps =="
Write-Host "1) Start web: cd GEOX/apps/web; npm install; npm run dev"
Write-Host "2) Open http://localhost:5173"
Write-Host "3) Open group timeline and verify overlays rendered"
