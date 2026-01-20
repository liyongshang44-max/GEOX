param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ProjectId = "P_DEFAULT",
  [string]$GroupId = "G_CAF",
  [string]$ExecutorKind = "human",     # "human" | "device" (audit only; no auth semantics)
  [string]$ExecutorId = "demo_executor_001",
  [int]$PollMaxAttempts = 30,
  [int]$PollSleepMs = 1000,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-WithRetry($fn, [int]$MaxAttempts = 15, [int]$SleepMs = 250) {
  $lastErr = $null
  for ($i=1; $i -le $MaxAttempts; $i++) {
    try { return & $fn } catch { $lastErr = $_; Start-Sleep -Milliseconds $SleepMs }
  }
  throw ("RETRY_EXHAUSTED: " + $lastErr)
}

function Get-NextTaskHttp($projectId, $groupId) {
  $hdr = Join-Path $env:TEMP ("geox_hdr_{0}.txt" -f ([guid]::NewGuid().ToString("N")))
  $body = Join-Path $env:TEMP ("geox_body_{0}.txt" -f ([guid]::NewGuid().ToString("N")))
  $url = "$BaseUrl/api/control/ao_sense/next_task?projectId=$projectId&groupId=$groupId"
  $null = curl.exe -sS -D $hdr -o $body $url
  $statusLine = (Get-Content $hdr | Select-Object -First 1)
  $status = [int]($statusLine.Split(" ")[1])
  $content = ""
  if (Test-Path $body) { $content = (Get-Content $body -Raw) }
  Remove-Item $hdr,$body -Force -ErrorAction SilentlyContinue
  return @{ status = $status; body = $content }
}

function Post-Json($url, $obj) {
  $tmp = Join-Path $env:TEMP ("geox_post_{0}.json" -f ([guid]::NewGuid().ToString("N")))
  ($obj | ConvertTo-Json -Depth 30) | Out-File -Encoding utf8 -FilePath $tmp
  try {
    return Invoke-WithRetry {
      $raw = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$tmp"
      if (-not $raw) { throw "EMPTY_RESPONSE" }
      return ($raw | ConvertFrom-Json)
    } 15 250
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "== Apple III Executor Demo (Sprint 5) =="
Write-Host ("BaseUrl={0} ProjectId={1} GroupId={2} Executor={3}:{4} DryRun={5}" -f $BaseUrl,$ProjectId,$GroupId,$ExecutorKind,$ExecutorId,$DryRun.IsPresent)

$taskItem = $null
for ($i=1; $i -le $PollMaxAttempts; $i++) {
  $nt = Invoke-WithRetry { Get-NextTaskHttp $ProjectId $GroupId } 5 250
  if ($nt.status -eq 204) {
    Write-Host ("No task (204). poll={0}/{1}" -f $i,$PollMaxAttempts)
    Start-Sleep -Milliseconds $PollSleepMs
    continue
  }
  if ($nt.status -ne 200) {
    throw ("NEXT_TASK_BAD_STATUS: " + $nt.status + " body=" + $nt.body)
  }
  $ntObj = $nt.body | ConvertFrom-Json
  if ($ntObj.ok -ne $true -or $null -eq $ntObj.item) {
    throw ("NEXT_TASK_BAD_BODY: " + $nt.body)
  }
  $taskItem = $ntObj.item
  break
}

if ($null -eq $taskItem) { throw "NO_TASK_AVAILABLE" }

$taskId = $taskItem.record_json.task_id
Write-Host ("Picked task_id={0}" -f $taskId)

if ($DryRun.IsPresent) {
  Write-Host "DRY_RUN: stop before writing marker/receipt"
  exit 0
}

# Audit marker: no contract change; store executor+task binding as structured JSON in note.
$markerTs = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$executorMeta = @{ executor_kind=$ExecutorKind; executor_id=$ExecutorId; task_id=$taskId } | ConvertTo-Json -Compress

$markerBody = @{
  ts = $markerTs
  sensorId = "CAF009"
  groupId = $GroupId
  type = "local_anomaly"
  source = "human"
  note = ("AO_SENSE_EXECUTION " + $executorMeta)
}

$marker = Post-Json "$BaseUrl/api/marker" $markerBody
if ($marker.ok -ne $true) { throw ("MARKER_CREATE_FAILED: " + ($marker | ConvertTo-Json -Depth 20)) }
Write-Host ("OK marker fact_id={0}" -f $marker.fact_id)

# Receipt: evidence_refs must include the marker fact_id (kind=marker_v1)
$receiptBody = @{
  task_id = $taskId
  executed_at_ts = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  result = "success"
  evidence_refs = @(@{ kind="marker_v1"; ref_id=$marker.fact_id })
}

$receipt = Post-Json "$BaseUrl/api/control/ao_sense/receipt" $receiptBody
if ($receipt.ok -ne $true) { throw ("RECEIPT_CREATE_FAILED: " + ($receipt | ConvertTo-Json -Depth 20)) }
Write-Host ("OK receipt_id={0} fact_id={1}" -f $receipt.receipt_id, $receipt.fact_id)

Write-Host "DONE executor cycle"