# GEOX/scripts/ops/backup_db.ps1
# Ops1: create a PostgreSQL logical backup file via pg_dump inside docker container.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path, # Resolve repository root from script location by default.
  [string]$BackupRoot = ".\backups\ops", # Default backup output directory relative to repo root.
  [string]$ContainerName = "geox-postgres", # Default postgres container name from docker-compose.
  [string]$DatabaseName = "landos", # Default GEOX database name.
  [string]$DbUser = "landos", # Default postgres user.
  [string]$OutputFile = "", # Optional explicit output file path.
  [switch]$SkipContainerCheck # Allow callers to skip container running verification when needed.
)

Set-StrictMode -Version Latest # Enforce strict PowerShell semantics.
$ErrorActionPreference = "Stop" # Stop immediately on any error.

function Assert([bool]$cond, [string]$msg){ # Define simple assertion helper.
  if (-not $cond) { throw ("ASSERT_FAIL: " + $msg) } # Throw descriptive error on failed assertion.
} # End assertion helper.

$repoRootResolved = (Resolve-Path $RepoRoot).Path # Normalize repo root to an absolute path.
$backupRootResolved = if ([System.IO.Path]::IsPathRooted($BackupRoot)) { $BackupRoot } else { Join-Path $repoRootResolved $BackupRoot } # Normalize backup directory to absolute path.
New-Item -ItemType Directory -Force -Path $backupRootResolved | Out-Null # Ensure backup output directory exists.

if (-not $SkipContainerCheck) { # Run container preflight by default.
  $containerId = (& docker ps -q -f "name=^${ContainerName}$").Trim() # Query running container id by exact name.
  Assert (-not [string]::IsNullOrWhiteSpace($containerId)) ("postgres container not running: " + $ContainerName) # Require running postgres container.
} # End container preflight.

$ts = Get-Date -Format "yyyyMMdd_HHmmss" # Generate timestamp for output naming.
$outputPath = if ([string]::IsNullOrWhiteSpace($OutputFile)) { Join-Path $backupRootResolved ("geox_db_" + $DatabaseName + "_" + $ts + ".dump") } else { if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path $repoRootResolved $OutputFile } } # Resolve final dump path.
$outputDir = Split-Path -Parent $outputPath # Read parent directory of dump file.
if (-not [string]::IsNullOrWhiteSpace($outputDir)) { New-Item -ItemType Directory -Force -Path $outputDir | Out-Null } # Ensure parent directory exists.
if (Test-Path $outputPath) { Remove-Item -Force $outputPath } # Remove existing output file to avoid append/corruption.

$argList = @("exec", $ContainerName, "sh", "-lc", ("pg_dump -U {0} -d {1} -Fc" -f $DbUser, $DatabaseName)) # Build docker exec command for pg_dump.
$psi = New-Object System.Diagnostics.ProcessStartInfo # Allocate process start info for binary-safe piping.
$psi.FileName = "docker" # Execute docker CLI.
$psi.RedirectStandardOutput = $true # Capture binary dump stream from stdout.
$psi.RedirectStandardError = $true # Capture stderr for diagnostics.
$psi.UseShellExecute = $false # Disable shell execute to allow redirection.
foreach ($a in $argList) { [void]$psi.ArgumentList.Add($a) } # Append each docker argument safely.
$proc = [System.Diagnostics.Process]::Start($psi) # Start docker process.
Assert ($null -ne $proc) "failed to start docker pg_dump process" # Require process start success.
$fileStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None) # Open output file for binary write.
try { # Guard stream copy with finally cleanup.
  $proc.StandardOutput.BaseStream.CopyTo($fileStream) # Copy pg_dump binary stream to backup file.
} finally { # Always close output file.
  $fileStream.Dispose() # Close file stream.
} # End stream copy cleanup.
$stderr = $proc.StandardError.ReadToEnd() # Read textual stderr after stdout copy finishes.
$proc.WaitForExit() # Wait for docker process completion.
if ($proc.ExitCode -ne 0) { # Fail if pg_dump command returned non-zero.
  if (Test-Path $outputPath) { Remove-Item -Force $outputPath } # Delete incomplete dump file on failure.
  throw ("BACKUP_DB_FAILED: exit=" + $proc.ExitCode + " stderr=" + $stderr) # Throw diagnostic error.
} # End backup failure guard.

Assert (Test-Path $outputPath) "dump file not created" # Require dump file existence.
$size = (Get-Item $outputPath).Length # Read output file size.
Assert ($size -gt 0) "dump file is empty" # Require non-empty dump.

Write-Host ("OK: db backup created " + $outputPath) # Print success marker with output path.
Write-Host ("OK: bytes=" + $size) # Print output size for audit trail.
