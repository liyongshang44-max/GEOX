# GEOX/scripts/ACCEPTANCE_DEVICE_INGEST.ps1
# End-to-end acceptance for real device ingest:
# - assumes backend is already running
# - starts ingest_soilprobe_modbus.py for ~70s
# - verifies /api/series returns moisture + soil_temp_c samples for the window
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\ACCEPTANCE_DEVICE_INGEST.ps1 -Base http://127.0.0.1:3000 -Port COM4 -SensorId S1
#
param(
  [string]$Base = "http://127.0.0.1:3000",
  [string]$Port = "COM4",
  [int]$DeviceId = 1,
  [string]$SensorId = "S1",
  [int]$IntervalSec = 30
)

$ErrorActionPreference = "Stop"

function OK($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function INFO($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function FAIL($m){ Write-Host "[FAIL] $m" -ForegroundColor Red; throw $m }

# --- sanity: backend reachable
INFO "Check backend: $Base/api/groups?projectId=P_DEFAULT"
try { Invoke-RestMethod "$Base/api/groups?projectId=P_DEFAULT" -TimeoutSec 3 | Out-Null }
catch { FAIL "Backend not reachable at $Base" }
OK "Backend reachable"

# --- start ingest in background
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  $py = "python"
}

$scriptPath = Join-Path $repoRoot "scripts\ingest_soilprobe_modbus.py"
if (-not (Test-Path $scriptPath)) { FAIL "Missing $scriptPath" }

$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$startTs = $now - 120000

INFO "Start ingest for ~70s (interval=$IntervalSec sec) ..."
$proc = Start-Process -PassThru -WindowStyle Minimized -FilePath $py -ArgumentList @(
  $scriptPath,
  "--port",$Port,
  "--device-id",$DeviceId,
  "--base",$Base,
  "--sensor-id",$SensorId,
  "--interval",$IntervalSec
)

INFO "ProcessId=$($proc.Id)"
Start-Sleep -Seconds 70

# --- query series for the last few minutes
$endTs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$url = "$Base/api/series?sensorId=$SensorId&metrics=moisture,soil_temp_c&startTs=$startTs&endTs=$endTs&maxPoints=20000"
INFO "GET $url"
$series = Invoke-RestMethod $url -TimeoutSec 10

if (-not $series.samples) { FAIL "series.samples missing" }

$mo = @($series.samples | Where-Object { $_.metric -eq "moisture" })
$tp = @($series.samples | Where-Object { $_.metric -eq "soil_temp_c" })

INFO ("samples total=" + $series.samples.Count + " moisture=" + $mo.Count + " soil_temp_c=" + $tp.Count)

if ($mo.Count -lt 1) { FAIL "No moisture samples found (check wiring / mapping / port)" }
if ($tp.Count -lt 1) { FAIL "No soil_temp_c samples found (check wiring / mapping / port)" }

OK "Device ingest looks OK"

# --- stop ingest process
try {
  INFO "Stopping ingest process ..."
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
} catch {}

OK "ACCEPTANCE PASS"