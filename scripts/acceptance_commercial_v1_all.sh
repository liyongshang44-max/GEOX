#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

run_ps() {
  local file="$1"
  if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -ExecutionPolicy Bypass -File "$ROOT/$file"
  elif command -v powershell >/dev/null 2>&1; then
    powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/$file"
  else
    echo "[commercial_v1] missing powershell/pwsh for $file" >&2
    return 1
  fi
}

echo "[commercial_v1] running acceptance suite..."
run_ps ACCEPTANCE_SPRINTA2_DEVICE_CREDENTIALS_SMOKE.ps1
run_ps ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE.ps1
run_ps ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1
run_ps ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1
run_ps ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE.ps1

echo "[commercial_v1] acceptance suite done."
