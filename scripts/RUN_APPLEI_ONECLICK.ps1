# RUN_APPLEI_ONECLICK.ps1
# One-click Apple I end-to-end (backend+web+device ingest + acceptance)
# - Starts geox-server (docker) on Base port (default :3000)
# - Starts geox-web   (docker) on Web port (default :5173)
# - Starts device ingest via venv python (COM port -> /api/raw)
# - Asserts series sample count grows (3 rounds)
# - Runs backend acceptance script: scripts/ACCEPTANCE_WEB2_BACKEND.ps1 -DisableCanopy
#
# IMPORTANT (A mode = LIVE):
# - Device ingest is kept running by default (live streaming).
# - Use -StopIngestOnExit if you want the script to stop ingest at the end.
# - Containers are kept by default.

param(
  [string]$Base = "http://127.0.0.1:3000",
  [string]$Web  = "http://127.0.0.1:5173",

  # Device / ingest
  [string]$Port = "COM4",
  [int]$DeviceId = 1,
  [string]$SensorId = "S1",
  [int]$IntervalSec = 5,

  # Behavior toggles
  [switch]$ForceRestart,
  [switch]$StopContainersOnExit,
  [switch]$StopIngestOnExit,   # <--- NEW: default False (LIVE mode keeps ingest running)
  [switch]$SkipWeb,
  [switch]$SkipDeviceIngest,
  [switch]$SkipAcceptance
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red; throw $m }

function Require-Command($name){
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { Fail "Missing command: $name" }
}

function Port-InUse([int]$port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400, $false)
    if ($ok) { $c.EndConnect($iar); $c.Close(); return $true }
    $c.Close(); return $false
  } catch { return $false }
}

function Stop-ContainerIfExists($name){
  $id = (docker ps -aq -f "name=^${name}$" 2>$null)
  if ($id) {
    Warn "Stopping existing container: $name"
    docker rm -f $name | Out-Null
  }
}

function Wait-HttpOk([string]$url, [int]$timeoutSec = 60){
  $start = Get-Date
  while ($true){
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { return $true }
    } catch {
      Start-Sleep -Milliseconds 500
    }
    if (((Get-Date) - $start).TotalSeconds -gt $timeoutSec) { return $false }
  }
}

function Get-SeriesSampleCount([string]$baseUrl, [string]$sensorId){
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $start = $now - 600000  # last 10 min
  $url = "$baseUrl/api/series?sensorId=$sensorId&metrics=moisture,soil_temp_c&startTs=$start&endTs=$now&maxPoints=2000"
  $r = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 10
  if ($null -eq $r) { Fail "series response null" }
  if (-not ($r.PSObject.Properties.Name -contains "samples")) { Fail "series.samples missing" }
  return [int](@($r.samples).Count)
}

function Find-RepoRoot([string]$startDir) {
  $p = (Resolve-Path $startDir).Path
  while ($true) {
    $hasPkg  = Test-Path (Join-Path $p "package.json")
    $hasApps = Test-Path (Join-Path $p "apps")
    $hasTs   = Test-Path (Join-Path $p "tsconfig.json")
    if ($hasPkg -and $hasApps -and $hasTs) { return $p }

    $parent = Split-Path $p -Parent
    if ($parent -eq $p) { throw "Cannot find GEOX repo root from startDir=$startDir" }
    $p = $parent
  }
}

function Tail-File([string]$path, [int]$n = 30) {
  if (-not (Test-Path $path)) { return @() }
  try { return Get-Content -Path $path -Tail $n -ErrorAction SilentlyContinue }
  catch { return @() }
}

# -------------------------
# Resolve repo root
# -------------------------
$repoRoot = Find-RepoRoot $PSScriptRoot

# Parse ports from Base/Web
try { $basePort = ([Uri]$Base).Port } catch { Fail "Invalid -Base URL: $Base" }
try { $webPort  = ([Uri]$Web).Port  } catch { Fail "Invalid -Web URL:  $Web"  }

Info "repoRoot = $repoRoot"
Info "Base     = $Base (port=$basePort)"
Info "Web      = $Web  (port=$webPort)"
Info "Device   = port=$Port deviceId=$DeviceId sensorId=$SensorId interval=${IntervalSec}s"
Info "Flags    = ForceRestart=$($ForceRestart.IsPresent) StopContainersOnExit=$($StopContainersOnExit.IsPresent) StopIngestOnExit=$($StopIngestOnExit.IsPresent) SkipWeb=$($SkipWeb.IsPresent) SkipDeviceIngest=$($SkipDeviceIngest.IsPresent) SkipAcceptance=$($SkipAcceptance.IsPresent)"

# -------------------------
# Preconditions
# -------------------------
Require-Command docker

# venv python path (must live under repo root)
$venvPy = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  Warn "venv python not found: $venvPy"
  Warn "If you want device ingest, create venv under repo root:"
  Warn "  cd $repoRoot"
  Warn "  python -m venv .venv"
  Warn "  .\.venv\Scripts\Activate.ps1"
  Warn "  python -m pip install -U pip"
  Warn "  python -m pip install ""pymodbus==3.*"" pyserial requests"
}

# logs dir
$logsDir = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

# -------------------------
# Start backend (docker) [detached]
# -------------------------
if (Port-InUse $basePort) {
  Warn "Port $basePort already has a listener. If that's not your backend, stop it or change -Base."
}

if ($ForceRestart.IsPresent) {
  Stop-ContainerIfExists "geox-server"
} else {
  # if container exists and running, reuse
  $running = (docker ps -q -f "name=^geox-server$" 2>$null)
  if ($running) {
    Info "Backend container already running: geox-server (reuse)"
  } else {
    Stop-ContainerIfExists "geox-server"
  }
}

$running2 = (docker ps -q -f "name=^geox-server$" 2>$null)
if (-not $running2) {
  Info "Starting backend container (geox-server) [detached] ..."
  $serverArgs = @(
    "run","-d","--name","geox-server",
    "-p","$basePort`:3000",
    "-e","HOST=0.0.0.0",
    "-e","PORT=3000",
    "-e","TS_NODE_PROJECT=/app/tsconfig.json",
    "-v","${repoRoot}:/app",
    "-w","/app",
    "node:20",
    "sh","-lc","npm -s install && npx ts-node --skipIgnore apps/server/src/server.ts"
  )
  docker @serverArgs | Out-Null
}

Info "Waiting backend: GET $Base/api/groups?projectId=P_DEFAULT"
if (-not (Wait-HttpOk "$Base/api/groups?projectId=P_DEFAULT" 180)) {
  Warn "Backend still not reachable. Dump last logs: geox-server"
  try { docker logs --tail 120 geox-server | ForEach-Object { Warn $_ } } catch { Warn "Failed to dump docker logs for ${name}: $($_.Exception.Message)" }
  Fail "Backend not reachable at $Base (timeout)"
}
Ok "Backend ready"

# -------------------------
# Start web (docker) [detached]
# -------------------------
if (-not $SkipWeb.IsPresent) {
  if ($ForceRestart.IsPresent) {
    Stop-ContainerIfExists "geox-web"
  } else {
    $wRunning = (docker ps -q -f "name=^geox-web$" 2>$null)
    if ($wRunning) {
      Info "Web container already running: geox-web (reuse)"
    } else {
      Stop-ContainerIfExists "geox-web"
    }
  }

  $wRunning2 = (docker ps -q -f "name=^geox-web$" 2>$null)
  if (-not $wRunning2) {
    Info "Starting web container (geox-web) [detached] ..."
    $webArgs = @(
      "run","-d","--name","geox-web",
      "-p","$webPort`:5173",
      "-e","VITE_API_BASE=$Base",
      "-v","${repoRoot}:/app",
      "-w","/app/apps/web",
      "node:20",
      "sh","-lc","npm -s install --legacy-peer-deps && npm run dev -- --host 0.0.0.0 --port 5173"
    )
    docker @webArgs | Out-Null
  }

  Info "Waiting web: GET $Web/"
  if (-not (Wait-HttpOk "$Web/" 240)) {
    Warn "Web still not reachable. Dump last logs: geox-web"
    try { docker logs --tail 120 geox-web | ForEach-Object { Warn $_ } } catch { Warn "Failed to dump docker logs for geox-web: $($_.Exception.Message)" }
    Fail "Web not reachable at $Web (timeout)"
  }
  Ok "Web ready"
  Info "Open browser: $Web/"
  Info "Web logs: docker logs -f geox-web"
} else {
  Warn "SkipWeb enabled; not starting frontend"
}

# -------------------------
# Start device ingest (python)
# -------------------------
$ingestProc = $null
$ingestOut  = Join-Path $logsDir "ingest_device.out.log"
$ingestErr  = Join-Path $logsDir "ingest_device.err.log"

try {
  if (-not $SkipDeviceIngest.IsPresent) {
    if (-not (Test-Path $venvPy)) { Fail "Device ingest requested but venv python missing: $venvPy (use -SkipDeviceIngest to bypass)" }

    $ingestScript = Join-Path $repoRoot "scripts\ingest_soilprobe_modbus.py"
    if (-not (Test-Path $ingestScript)) { Fail "Missing ingest script: $ingestScript" }

    Info "Starting device ingest (background) ..."
    Info "stdout => $ingestOut"
    Info "stderr => $ingestErr"

    # clear old logs (optional)
    try { Remove-Item -Force $ingestOut,$ingestErr -ErrorAction SilentlyContinue } catch {}

    $ingestArgs = @(
      $ingestScript,
      "--port", $Port,
      "--device-id", "$DeviceId",
      "--sensor-id", $SensorId,
      "--base", $Base,
      "--interval", "$IntervalSec"
    )

    $ingestProc = Start-Process -FilePath $venvPy `
      -ArgumentList $ingestArgs `
      -PassThru `
      -WindowStyle Minimized `
      -RedirectStandardOutput $ingestOut `
      -RedirectStandardError  $ingestErr

    Ok "Ingest started (pid=$($ingestProc.Id))"
  } else {
    Warn "SkipDeviceIngest enabled; not starting ingest"
  }

  # -------------------------
  # Growth assertion (device -> backend series)
  # -------------------------
  if (-not $SkipDeviceIngest.IsPresent) {
    Info "Assert device ingestion: /api/series sample count must grow (3 rounds)"
    Info "metric set: moisture,soil_temp_c ; expected +>=2 per round"

    Start-Sleep -Seconds ([Math]::Max(3, $IntervalSec + 1))

    $c0 = Get-SeriesSampleCount $Base $SensorId
    Info "Round0 samples=$c0"

    for ($i=1; $i -le 3; $i++) {
      Start-Sleep -Seconds ([Math]::Max(6, $IntervalSec + 1))
      $ci = Get-SeriesSampleCount $Base $SensorId
      $delta = $ci - $c0
      Info "Round$i samples=$ci (delta=$delta)"
      if ($delta -lt 2) {
        Warn "ingest stdout tail:"
        (Tail-File $ingestOut 30) | ForEach-Object { Warn $_ }
        Warn "ingest stderr tail:"
        (Tail-File $ingestErr 30) | ForEach-Object { Warn $_ }
        Fail "Device ingest not reflected in /api/series (need +>=2; got delta=$delta). Check logs in $logsDir"
      }
      $c0 = $ci
    }

    Ok "Device ingest growth assertion PASS"
  }

  # -------------------------
  # Run backend acceptance
  # -------------------------
  if (-not $SkipAcceptance.IsPresent) {
    $acc = Join-Path $repoRoot "scripts\ACCEPTANCE_WEB2_BACKEND.ps1"
    if (-not (Test-Path $acc)) { Fail "Acceptance script missing: $acc" }

    Info "Running backend acceptance: scripts/ACCEPTANCE_WEB2_BACKEND.ps1 -DisableCanopy -base $Base"
    & powershell -ExecutionPolicy Bypass -File $acc -DisableCanopy -base $Base
    Ok "Backend acceptance PASS"
  } else {
    Warn "SkipAcceptance enabled; not running backend acceptance"
  }

  Write-Host ""
  Ok "ONECLICK PASS"
  Write-Host "Base = $Base"
  if (-not $SkipWeb.IsPresent) { Write-Host "Web  = $Web" }
  Write-Host "Logs = $logsDir"
  if ($null -ne $ingestProc -and -not $ingestProc.HasExited) {
    if ($StopIngestOnExit.IsPresent) {
      Write-Host "Ingest = pid=$($ingestProc.Id) (will stop on exit)"
    } else {
      Write-Host "Ingest = pid=$($ingestProc.Id) (LIVE: kept running)"
      Write-Host "  tail stdout: Get-Content -Tail 30 `"$ingestOut`" -Wait"
      Write-Host "  tail stderr: Get-Content -Tail 30 `"$ingestErr`" -Wait"
    }
  }
  Write-Host ""

} finally {
  # -------------------------
  # Cleanup ingest process (ONLY if StopIngestOnExit)
  # -------------------------
  if ($null -ne $ingestProc) {
    if ($StopIngestOnExit.IsPresent) {
      try {
        if (-not $ingestProc.HasExited) {
          Warn "Stopping ingest (pid=$($ingestProc.Id))"
          Stop-Process -Id $ingestProc.Id -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    } else {
      # LIVE mode: keep running
      if (-not $ingestProc.HasExited) {
        Info "Ingest kept running (LIVE mode). pid=$($ingestProc.Id)"
      }
    }
  }

  # -------------------------
  # Optional: stop containers
  # -------------------------
  if ($StopContainersOnExit.IsPresent) {
    Warn "StopContainersOnExit enabled; stopping containers"
    docker rm -f geox-web geox-server 2>$null | Out-Null
  } else {
    Info "Containers kept (default). To stop manually:"
    Write-Host "  docker rm -f geox-web geox-server"
  }
}