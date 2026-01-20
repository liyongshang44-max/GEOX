# GEOX/scripts/RUN_APPLEI_LOCAL.ps1
# Apple I local one-click runner (Windows / PowerShell)

$ErrorActionPreference = "Stop"

function INFO($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function OK($m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function FAIL($m){ Write-Host "[FAIL] $m" -ForegroundColor Red; throw $m }

$BASE = "http://127.0.0.1:3000"
$PORT = "COM4"
$DEVICE_ID = 1
$SENSOR_ID = "S1"

INFO "Check backend..."
try {
  Invoke-RestMethod "$BASE/api/groups?projectId=P_DEFAULT" | Out-Null
  OK "Backend reachable"
} catch {
  FAIL "Backend not reachable at $BASE (is Docker running?)"
}

INFO "Activate venv"
. .\.venv\Scripts\Activate.ps1

INFO "Start device ingest (background)"
$ingest = Start-Process `
  -FilePath "python" `
  -ArgumentList ".\scripts\ingest_soilprobe_modbus.py --port $PORT --device-id $DEVICE_ID --sensor-id $SENSOR_ID --base $BASE --interval 5" `
  -PassThru `
  -WindowStyle Minimized

INFO "Ingest PID=$($ingest.Id)"

INFO "Start frontend (Vite)"
Start-Process `
  -FilePath "npm" `
  -ArgumentList "run dev" `
  -WorkingDirectory ".\apps\web" `
  -WindowStyle Normal

OK "Apple I local stack started"
INFO "Open: http://localhost:5173/group/G_DEFAULT"