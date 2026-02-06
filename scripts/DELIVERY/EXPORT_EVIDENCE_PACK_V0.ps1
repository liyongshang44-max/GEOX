# GEOX/scripts/DELIVERY/EXPORT_EVIDENCE_PACK_V0.ps1
# Sprint 23: Evidence Pack v0 export entrypoint (PowerShell).

param(
  [Parameter(Mandatory=$true)][string]$TenantId, # Tenant id (SSOT field name).
  [Parameter(Mandatory=$true)][string]$ProjectId, # Project id within the tenant.
  [Parameter(Mandatory=$true)][string]$GroupId, # Group id within the project.
  [Parameter(Mandatory=$true)][string]$TaskId, # act_task_id for AO-ACT task.
  [string]$BaseUrl = "http://localhost:3000" # Base URL for server (used for 404 isolation check).
)

$ErrorActionPreference = "Stop" # Fail fast on any error.

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")) # Resolve repo root.
$runner = (Join-Path $PSScriptRoot "EXPORT_EVIDENCE_PACK_V0_RUNNER.cjs") # Node runner path.
$nodeCmd = $env:NODE_CMD # Optional override for Node executable.
if ([string]::IsNullOrWhiteSpace($nodeCmd)) { $nodeCmd = "node" } # Default to node.

Write-Host "[INFO] repoRoot=$repoRoot" # Print repo root for audit.
Write-Host "[INFO] runner=$runner" # Print runner path for audit.
Write-Host "[INFO] baseUrl=$BaseUrl" # Print base URL for audit.
Write-Host "[INFO] tenant_id=$TenantId project_id=$ProjectId group_id=$GroupId task_id=$TaskId" # Print inputs for audit.

& $nodeCmd $runner --baseUrl $BaseUrl --tenant_id $TenantId --project_id $ProjectId --group_id $GroupId --task_id $TaskId # Run runner.
if ($LASTEXITCODE -ne 0) { throw "EVIDENCE_PACK_EXPORT_FAILED" } # Fail on non-zero.

Write-Host "[OK] Evidence Pack v0 export complete" # Success marker.
