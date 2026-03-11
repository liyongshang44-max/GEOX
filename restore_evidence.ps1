# GEOX/scripts/ops/restore_evidence.ps1
# Ops1: restore a local evidence export archive from a zip file.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path, # Resolve repository root from script location by default.
  [string]$ArchiveFile, # Require input archive file path.
  [string]$EvidenceRoot = ".\apps\server\runtime\evidence_exports_v1" # Default evidence output directory.
)

Set-StrictMode -Version Latest # Enforce strict PowerShell semantics.
$ErrorActionPreference = "Stop" # Stop immediately on any error.

function Assert([bool]$cond, [string]$msg){ # Define simple assertion helper.
  if (-not $cond) { throw ("ASSERT_FAIL: " + $msg) } # Throw descriptive error on failed assertion.
} # End assertion helper.

Assert (-not [string]::IsNullOrWhiteSpace($ArchiveFile)) "ArchiveFile is required" # Require caller provide archive path.
$repoRootResolved = (Resolve-Path $RepoRoot).Path # Normalize repo root to absolute path.
$archivePathResolved = if ([System.IO.Path]::IsPathRooted($ArchiveFile)) { $ArchiveFile } else { Join-Path $repoRootResolved $ArchiveFile } # Normalize archive path to absolute path.
Assert (Test-Path $archivePathResolved) ("archive file not found: " + $archivePathResolved) # Require archive file to exist.
$evidenceRootResolved = if ([System.IO.Path]::IsPathRooted($EvidenceRoot)) { $EvidenceRoot } else { Join-Path $repoRootResolved $EvidenceRoot } # Normalize evidence output path.
if (Test-Path $evidenceRootResolved) { Remove-Item -Recurse -Force $evidenceRootResolved } # Remove existing evidence directory before restoring.
New-Item -ItemType Directory -Force -Path $evidenceRootResolved | Out-Null # Ensure target evidence directory exists.

$stageDir = Join-Path $env:TEMP ("geox_evidence_restore_stage_" + [guid]::NewGuid().ToString("N")) # Create unique temp dir for unzip.
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null # Ensure stage directory exists.
try { # Ensure temp dir is always cleaned up.
  Expand-Archive -Path $archivePathResolved -DestinationPath $stageDir -Force # Extract archive to temp staging dir.
  $extractedRoot = Join-Path $stageDir "evidence_exports_v1" # Expect stable top-level folder from backup script.
  Assert (Test-Path $extractedRoot) "archive missing evidence_exports_v1 folder" # Require expected folder structure.
  Copy-Item -Path (Join-Path $extractedRoot "*")-Destination $evidenceRootResolved -Recurse -Force  # Copy extracted contents into live evidence directory.
} finally { # Always remove temp staging directory.
  if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir } # Clean up temp dir.
} # End cleanup.

Write-Host ("OK: evidence restored from " + $archivePathResolved) # Print success marker with input path.
Write-Host ("OK: evidence_root=" + $evidenceRootResolved) # Print target directory for audit trail.
