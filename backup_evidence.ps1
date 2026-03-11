# GEOX/scripts/ops/backup_evidence.ps1
# Ops1: archive local evidence export artifacts into a zip file.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path, # Resolve repository root from script location by default.
  [string]$EvidenceRoot = ".\apps\server\runtime\evidence_exports_v1", # Default evidence artifact directory.
  [string]$BackupRoot = ".\backups\ops", # Default backup output directory.
  [string]$OutputFile = "", # Optional explicit zip file path.
  [switch]$AllowEmpty # Allow archiving an empty or missing source by creating an empty marker archive.
)

Set-StrictMode -Version Latest # Enforce strict PowerShell semantics.
$ErrorActionPreference = "Stop" # Stop immediately on any error.

function Assert([bool]$cond, [string]$msg){ # Define simple assertion helper.
  if (-not $cond) { throw ("ASSERT_FAIL: " + $msg) } # Throw descriptive error on failed assertion.
} # End assertion helper.

$repoRootResolved = (Resolve-Path $RepoRoot).Path # Normalize repo root to an absolute path.
$evidenceRootResolved = if ([System.IO.Path]::IsPathRooted($EvidenceRoot)) { $EvidenceRoot } else { Join-Path $repoRootResolved $EvidenceRoot } # Normalize evidence path to absolute path.
$backupRootResolved = if ([System.IO.Path]::IsPathRooted($BackupRoot)) { $BackupRoot } else { Join-Path $repoRootResolved $BackupRoot } # Normalize backup root to absolute path.
New-Item -ItemType Directory -Force -Path $backupRootResolved | Out-Null # Ensure backup output directory exists.

$ts = Get-Date -Format "yyyyMMdd_HHmmss" # Generate timestamp for output naming.
$outputPath = if ([string]::IsNullOrWhiteSpace($OutputFile)) { Join-Path $backupRootResolved ("geox_evidence_exports_" + $ts + ".zip") } else { if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path $repoRootResolved $OutputFile } } # Resolve final zip path.
$outputDir = Split-Path -Parent $outputPath # Read parent directory of zip file.
if (-not [string]::IsNullOrWhiteSpace($outputDir)) { New-Item -ItemType Directory -Force -Path $outputDir | Out-Null } # Ensure parent directory exists.
if (Test-Path $outputPath) { Remove-Item -Force $outputPath } # Remove existing zip file before recreation.

$sourceExists = Test-Path $evidenceRootResolved # Check whether evidence source directory exists.
if (-not $sourceExists -and -not $AllowEmpty) { throw ("EVIDENCE_ROOT_NOT_FOUND: " + $evidenceRootResolved) } # Require source directory unless empty archive is explicitly allowed.

$stageDir = Join-Path $env:TEMP ("geox_evidence_backup_stage_" + [guid]::NewGuid().ToString("N")) # Create unique staging directory for deterministic archive content.
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null # Ensure stage directory exists.
try { # Ensure staging directory is always cleaned up.
  $stageContentRoot = Join-Path $stageDir "evidence_exports_v1" # Use a stable top-level folder name inside the zip.
  New-Item -ItemType Directory -Force -Path $stageContentRoot | Out-Null # Create staged top-level folder.
  if ($sourceExists) { # Copy source contents when present.
    Copy-Item -Path (Join-Path $evidenceRootResolved "*") -Destination $stageContentRoot -Recurse -Force # Copy evidence artifacts into staging folder.
  } else { # Create marker file for empty archive when explicitly allowed.
    Set-Content -Path (Join-Path $stageContentRoot "README_EMPTY_BACKUP.txt") -Value "No evidence export files present at backup time."  # Record empty-backup marker.
  } # End staging content branch.

  Compress-Archive -Path (Join-Path $stageDir "*")-DestinationPath $outputPath -CompressionLevel Optimal # Create final zip from staged content.
} finally { # Always remove temporary staging directory.
  if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir } # Clean up temp dir.
} # End staging cleanup.

Assert (Test-Path $outputPath) *ef:sip archive not created*" # Require zip file existence.
$size = (Get-Item $outputPath).Length # Read zip size.
if (-sourceExists) { Assert ($size -gt 0) "zip archive is empty" } # For normal cases require non-empty archive.

Write-Host ("OK: evidence backup created " + $outputPath) # Print success marker with output path.
Write-Host ("OK: bytes=" + $size) # Print output size for audit trail.
