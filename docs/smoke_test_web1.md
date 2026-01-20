# GEOX Smoke Test (Web1 + Canopy)

All commands below are designed to be copy/paste runnable on Windows PowerShell.

Assumptions:
- Server listens on `http://localhost:3000`
- DB file is created automatically by the server
- Canopy media is served at `/media/(no further steps in this file)`

---

## 1) Start server (Docker + Node 20)

From repo root `GEOX`:

```powershell
docker run --rm -it `
  -p 3000:3000 `
  -e HOST=0.0.0.0 `
  -e PORT=3000 `
  -e TS_NODE_PROJECT=/app/tsconfig.json `
  -v "${PWD}:/app" `
  -w /app `
  node:20 `
  npx ts-node apps/server/src/server.ts
```

---

## 2) Groups sanity

```powershell
$base="http://localhost:3000"
Invoke-RestMethod "$base/api/groups?projectId=P_DEFAULT" | ConvertTo-Json -Depth 10
```

---

## 3) Insert raw (S1/S2 moisture)

```powershell
$base="http://localhost:3000"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$t0  = $now - 600000
$t1  = $now - 540000
$t2  = $now - 480000
$t3  = $now - 420000

function Post-Json($url, $obj) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($obj | ConvertTo-Json -Compress)
}

# S1 moisture
Post-Json "$base/api/raw" @{ ts=$t0; sensorId="S1"; metric="moisture"; value=10; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t1; sensorId="S1"; metric="moisture"; value=25; quality="ok"; source="device" } | Out-Null

# S2 moisture
Post-Json "$base/api/raw" @{ ts=$t0; sensorId="S2"; metric="moisture"; value=10; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t1; sensorId="S2"; metric="moisture"; value=14; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t2; sensorId="S2"; metric="moisture"; value=18; quality="ok"; source="device" } | Out-Null
Post-Json "$base/api/raw" @{ ts=$t3; sensorId="S2"; metric="moisture"; value=22; quality="ok"; source="device" } | Out-Null
```

---

## 4) Insert marker

```powershell
$base="http://localhost:3000"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$ts  = $now - 480000

function Post-Json($url, $obj) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($obj | ConvertTo-Json -Compress)
}

Post-Json "$base/api/marker" @{ ts=$ts; sensorId="S1"; type="device_fault"; note="signal intermittent"; source="gateway" } | ConvertTo-Json -Depth 5
```

---

## 5) Manual derive overlays (candidate only)

```powershell
$base="http://localhost:3000"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$start = $now - 24*60*60*1000

function Post-Json($url, $obj) {
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body ($obj | ConvertTo-Json -Compress)
}

$deriveRes = Post-Json "$base/api/derive/overlays" @{
  groupId="G_DEFAULT"
  metrics=@("moisture")
  startTs=$start
  endTs=$now
  algoVersion="v0.1"
  params=@{ stepThreshold=5; driftThreshold=10; driftN=3 }
}
$deriveRes | ConvertTo-Json -Depth 10
```

---

## 6) Replay series and inspect overlays

```powershell
$base="http://localhost:3000"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$start = $now - 24*60*60*1000

$seriesUrl = "$base/api/series?groupId=G_DEFAULT&metrics=moisture&startTs=$start&endTs=$now&maxPoints=2000"
$res = Invoke-RestMethod $seriesUrl
"samples=$($res.samples.Count) overlays=$($res.overlays.Count) gaps=$($res.gaps.Count)"

# show first few overlays
$res.overlays | Select-Object -First 10 | ConvertTo-Json -Depth 10
```

Expected properties:
- overlays contain marker kinds (`device_fault` / `local_anomaly`) and candidate kinds (`step_candidate` / `drift_candidate`)
- overlays elements keep the same shape `{startTs,endTs,sensorId,metric,kind,confidence,note,source}`

---

## 7) Canopy smoke test (upload one image + replay frames + fetch url)

Prepare a local image file path (jpg/png):

```powershell
$img = "C:\Users\mylr1\Pictures\test.jpg"
```

Upload:

```powershell
$base="http://localhost:3000"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$form = @{
  ts = "$now"
  projectId = "P_DEFAULT"
  cameraId = "CAM_1"
  source = "device"
}

$res = Invoke-RestMethod -Method Post -Uri "$base/api/canopy/frame" -Form $form -InFile $img -ContentType "multipart/form-data"
$res | ConvertTo-Json -Depth 10
```

Replay list:

```powershell
$start = $now - 3600000
$end = $now + 3600000
$list = Invoke-RestMethod "$base/api/canopy/frames?projectId=P_DEFAULT&startTs=$start&endTs=$end"
$list | ConvertTo-Json -Depth 10
```

Fetch the returned URL (should be accessible):

```powershell
Invoke-WebRequest $list.frames[0].url | Select-Object StatusCode, ContentType
```
