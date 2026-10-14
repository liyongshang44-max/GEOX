#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$ConfigPath,
  [ValidateSet('ReleaseOnly','HostPreflight','FullReadOnly')]
  [string]$Mode = 'HostPreflight',
  [string]$ReleaseArchivePath,
  [string]$ReleaseManifestPath,
  [string]$EvidenceRoot = 'D:\gptdown',
  [string]$AwsProfile,
  [string]$MinioPolicyPath,
  [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:CurrentStage = 'BOOT'
$script:FailureDetail = $null
$script:Result = $null
$script:EvidenceDir = $null
$script:PayloadDir = $null

function Get-Sha256File([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-Sha256Text([string]$Text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Write-NewUtf8File([string]$Path, [string]$Text) {
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
  }
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    $writer = New-Object -TypeName System.IO.StreamWriter -ArgumentList $stream,$encoding
    try {
      $writer.Write($Text)
      $writer.Flush()
      $stream.Flush()
    } finally {
      $writer.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Stop-Runner([string]$Code, [string]$RootCause, [string]$Remedy, [string]$RegressionGuard) {
  $script:FailureDetail = [ordered]@{
    stage = $script:CurrentStage
    code = $Code
    root_cause = $RootCause
    remedy = $Remedy
    regression_guard = $RegressionGuard
  }
  throw $Code
}

function Assert-SafeRelativePath([string]$Rel) {
  if ([string]::IsNullOrWhiteSpace($Rel) -or $Rel.Contains('\') -or $Rel.Contains(':') -or $Rel.StartsWith('/')) {
    throw 'UNSAFE_MANIFEST_PATH'
  }
  $parts = @($Rel.Split('/'))
  if ($parts.Count -eq 0) { throw 'UNSAFE_MANIFEST_PATH' }
  foreach ($part in $parts) {
    if ([string]::IsNullOrWhiteSpace($part) -or $part -eq '.' -or $part -eq '..') { throw 'UNSAFE_MANIFEST_PATH' }
  }
  if (($parts -join '/') -ne $Rel) { throw 'UNSAFE_MANIFEST_PATH' }
}

function Assert-PathInside([string]$Root, [string]$Candidate) {
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
  if (-not $candidateFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'PATH_ESCAPES_ROOT'
  }
}

function Assert-NoReparseInChain([string]$Root, [string]$Path) {
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
  $cursor = [System.IO.Path]::GetFullPath($Path)
  while ($cursor.Length -ge $rootFull.Length) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'REPARSE_POINT_FORBIDDEN'
      }
    }
    if ($cursor.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $next = Split-Path -Parent $cursor
    if ($next -eq $cursor -or [string]::IsNullOrWhiteSpace($next)) { break }
    $cursor = $next
  }
}

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'JSON_FILE_MISSING' }
  return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Assert-Config($Config) {
  if ($Config.schema_version -ne 'MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_CONFIG_V1') { throw 'CONFIG_SCHEMA_MISMATCH' }
  if ([string]$Config.run_id -notmatch '^[0-9a-f]{12}$') { throw 'CONFIG_RUN_ID_INVALID' }
  if ([string]$Config.subject_commit_sha -notmatch '^[0-9a-f]{40}$') { throw 'CONFIG_SUBJECT_INVALID' }
  if ([string]$Config.source.repo_full_name -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'CONFIG_REPO_INVALID' }
  if ([string]$Config.source.trusted_release_manifest_sha256 -notmatch '^[0-9a-f]{64}$') { throw 'CONFIG_MANIFEST_DIGEST_INVALID' }
  if ([int]$Config.source.expected_release_files -le 0) { throw 'CONFIG_RELEASE_FILE_COUNT_INVALID' }
  $entries = @($Config.source.expected_entrypoints)
  if ($entries.Count -le 0) { throw 'CONFIG_ENTRYPOINTS_REQUIRED' }
  foreach ($entry in $entries) { Assert-SafeRelativePath ([string]$entry) }

  if ([string]$Config.pg.host -ne '127.0.0.1') { throw 'CONFIG_PG_LOOPBACK_REQUIRED' }
  if ([int]$Config.pg.port -le 0) { throw 'CONFIG_PG_PORT_INVALID' }
  if (-not ([string]$Config.pg.container_name).Contains([string]$Config.run_id)) { throw 'CONFIG_PG_CONTAINER_RUN_SCOPE_REQUIRED' }
  foreach ($name in @([string]$Config.pg.positive_db,[string]$Config.pg.negative_db)) {
    if ($name -notmatch '^[a-z0-9_]+$' -or -not $name.Contains([string]$Config.run_id)) { throw 'CONFIG_PG_DATABASE_RUN_SCOPE_REQUIRED' }
  }
  foreach ($roleProp in @('positive_evidence','positive_twin','negative_evidence','negative_twin')) {
    $role = [string]$Config.pg.roles.$roleProp
    if ($role -notmatch '^[a-z0-9_]+$' -or -not $role.Contains([string]$Config.run_id)) { throw 'CONFIG_PG_LOGIN_RUN_SCOPE_REQUIRED' }
  }
  foreach ($privProp in @('evidence','twin')) {
    $priv = [string]$Config.pg.privilege_roles.$privProp
    if ($priv -notmatch '^[a-z0-9_]+$') { throw 'CONFIG_PG_PRIVILEGE_ROLE_INVALID' }
  }

  if ([string]$Config.minio.endpoint -notmatch '^http://127\.0\.0\.1:[0-9]+$') { throw 'CONFIG_MINIO_LOOPBACK_REQUIRED' }
  if (-not [string]::IsNullOrWhiteSpace([string]$Config.minio.bucket) -and -not ([string]$Config.minio.bucket).Contains([string]$Config.run_id)) {
    throw 'CONFIG_MINIO_BUCKET_RUN_SCOPE_REQUIRED'
  }
}

function New-EvidenceState($Config) {
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
  $evidence = Join-Path $EvidenceRoot ('MCFT-CAP09-DEPLOYMENT-RUNNER-' + $Config.run_id + '-' + $stamp)
  $payload = Join-Path $EvidenceRoot ('MCFT-CAP09-RELEASE-PAYLOAD-' + $Config.run_id + '-' + $stamp)
  if (Test-Path -LiteralPath $evidence) { throw 'EVIDENCE_PATH_ALREADY_EXISTS' }
  if (Test-Path -LiteralPath $payload) { throw 'PAYLOAD_PATH_ALREADY_EXISTS' }
  [System.IO.Directory]::CreateDirectory($evidence) | Out-Null
  $script:EvidenceDir = $evidence
  $script:PayloadDir = $payload
  $script:Result = [ordered]@{
    schema_version = 'MCFT_CAP09_WINDOWS_DEPLOYMENT_RUNNER_RESULT_V1'
    timestamp_utc = [DateTime]::UtcNow.ToString('o')
    mode = $Mode
    run_id = [string]$Config.run_id
    subject_commit_sha = [string]$Config.subject_commit_sha
    evidence_dir = $evidence
    payload_dir = $payload
    stages = @()
    failure = $null
    admission_input_ready = $false
    execution_authorized = $false
    production_authorized = $false
    producer_started = $false
    permit_consumed = $false
    database_write_performed = $false
    object_storage_write_performed = $false
    container_restart_performed = $false
    status = 'IN_PROGRESS_EXECUTE_HOLD'
  }
}

function Add-Stage([string]$Name, [string]$Status, $Detail) {
  $script:Result.stages += [ordered]@{
    stage = $Name
    status = $Status
    detail = $Detail
  }
}

function Save-Result {
  if ($null -eq $script:Result -or [string]::IsNullOrWhiteSpace($script:EvidenceDir)) { return }
  $path = Join-Path $script:EvidenceDir 'RESULT.json'
  if (Test-Path -LiteralPath $path) { return }
  $json = $script:Result | ConvertTo-Json -Depth 20
  Write-NewUtf8File $path ($json + [Environment]::NewLine)
}

function Get-ReleaseArchive($Config) {
  $script:CurrentStage = 'RELEASE_FETCH'
  if (-not [string]::IsNullOrWhiteSpace($ReleaseArchivePath)) {
    if (-not (Test-Path -LiteralPath $ReleaseArchivePath -PathType Leaf)) {
      Stop-Runner 'RELEASE_ARCHIVE_MISSING' 'The supplied release archive does not exist.' 'Provide the exact immutable archive or omit the parameter to fetch the exact commit archive.' 'Archive presence is checked before extraction.'
    }
    $resolved = (Resolve-Path -LiteralPath $ReleaseArchivePath).Path
    Add-Stage 'RELEASE_FETCH' 'PASS' ([ordered]@{source='operator_supplied_exact_archive'; archive_sha256=(Get-Sha256File $resolved)})
    return $resolved
  }

  $cache = Join-Path $script:EvidenceDir ('source-' + $Config.subject_commit_sha + '.zip')
  $url = 'https://github.com/' + $Config.source.repo_full_name + '/archive/' + $Config.subject_commit_sha + '.zip'
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $cache -Headers @{'User-Agent'='GEOX-MCFT-CAP09-Windows-Deployment-Runner-V1'}
  } catch {
    Stop-Runner 'EXACT_COMMIT_ARCHIVE_FETCH_FAILED' 'The exact-SHA source archive could not be downloaded.' 'Use the already retained original release archive with -ReleaseArchivePath, or restore network access and retry with the same subject SHA.' 'The runner never falls back to branch HEAD or mutable main.'
  }
  Add-Stage 'RELEASE_FETCH' 'PASS' ([ordered]@{source='github_exact_commit_archive'; subject=[string]$Config.subject_commit_sha; archive_sha256=(Get-Sha256File $cache)})
  return $cache
}

function Find-ArchiveRoot([string]$ExtractRoot, [string]$FirstManifestPath) {
  $direct = Join-Path $ExtractRoot ($FirstManifestPath.Replace('/','\'))
  if (Test-Path -LiteralPath $direct -PathType Leaf) { return $ExtractRoot }
  $dirs = @(Get-ChildItem -LiteralPath $ExtractRoot -Directory -Force)
  $matches = @()
  foreach ($dir in $dirs) {
    $candidate = Join-Path $dir.FullName ($FirstManifestPath.Replace('/','\'))
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $matches += $dir.FullName }
  }
  if ($matches.Count -ne 1) { throw 'ARCHIVE_ROOT_AMBIGUOUS' }
  return $matches[0]
}

function Copy-VerifiedManifestPayload($Config, $Manifest, [string]$SourceRoot, [string]$DestinationRoot) {
  $files = @($Manifest.files)
  if ($files.Count -ne [int]$Config.source.expected_release_files) { throw 'RELEASE_FILE_COUNT_MISMATCH' }
  if ($files.Count -eq 0) { throw 'RELEASE_MANIFEST_EMPTY' }
  if ([string]$Manifest.subject_commit_sha -ne [string]$Config.subject_commit_sha) { throw 'RELEASE_SUBJECT_MISMATCH' }

  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  [System.IO.Directory]::CreateDirectory($DestinationRoot) | Out-Null
  $verified = 0

  foreach ($row in $files) {
    $rel = [string]$row.path
    Assert-SafeRelativePath $rel
    if (-not $seen.Add($rel)) { throw 'RELEASE_DUPLICATE_OR_CASE_COLLISION' }
    $expectedHash = ([string]$row.sha256).ToLowerInvariant()
    if ($expectedHash -notmatch '^[0-9a-f]{64}$') { throw 'RELEASE_ROW_HASH_INVALID' }
    $expectedSize = [int64]$row.size_bytes
    if ($expectedSize -lt 0) { throw 'RELEASE_ROW_SIZE_INVALID' }

    $source = Join-Path $SourceRoot ($rel.Replace('/','\'))
    Assert-PathInside $SourceRoot $source
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'RELEASE_FILE_MISSING' }
    Assert-NoReparseInChain $SourceRoot $source
    $sourceInfo = Get-Item -LiteralPath $source -Force
    if ([int64]$sourceInfo.Length -ne $expectedSize) { throw 'RELEASE_SOURCE_SIZE_MISMATCH' }
    if ((Get-Sha256File $source) -ne $expectedHash) { throw 'RELEASE_SOURCE_HASH_MISMATCH' }

    $dest = Join-Path $DestinationRoot ($rel.Replace('/','\'))
    Assert-PathInside $DestinationRoot $dest
    $destParent = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destParent -PathType Container)) {
      [System.IO.Directory]::CreateDirectory($destParent) | Out-Null
    }
    [System.IO.File]::Copy($source, $dest, $false)
    if ((Get-Sha256File $dest) -ne $expectedHash) { throw 'RELEASE_DESTINATION_HASH_MISMATCH' }
    $verified++
  }

  $actualFiles = @(Get-ChildItem -LiteralPath $DestinationRoot -File -Recurse -Force)
  if ($actualFiles.Count -ne $files.Count) { throw 'RELEASE_PAYLOAD_EXTRA_OR_MISSING_FILES' }

  foreach ($entry in @($Config.source.expected_entrypoints)) {
    $entryRel = [string]$entry
    Assert-SafeRelativePath $entryRel
    if (-not $seen.Contains($entryRel)) { throw 'RELEASE_ENTRYPOINT_NOT_MANIFEST_BOUND' }
    $entryPath = Join-Path $DestinationRoot ($entryRel.Replace('/','\'))
    if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw 'RELEASE_ENTRYPOINT_MISSING' }
  }
  return $verified
}

function Invoke-ReleaseStage($Config) {
  $script:CurrentStage = 'RELEASE_VERIFY'
  if ([string]::IsNullOrWhiteSpace($ReleaseManifestPath)) {
    Stop-Runner 'TRUSTED_RELEASE_MANIFEST_REQUIRED' 'A reviewed release manifest file was not supplied.' 'Provide -ReleaseManifestPath for the A44 release material manifest whose SHA-256 equals the trusted config digest.' 'No manifest is learned from the archive itself.'
  }
  if (-not (Test-Path -LiteralPath $ReleaseManifestPath -PathType Leaf)) {
    Stop-Runner 'TRUSTED_RELEASE_MANIFEST_MISSING' 'The reviewed release manifest path is absent.' 'Restore the retained manifest without regenerating or normalizing it.' 'Exact manifest bytes are required.'
  }
  $manifestHash = Get-Sha256File $ReleaseManifestPath
  if ($manifestHash -ne ([string]$Config.source.trusted_release_manifest_sha256).ToLowerInvariant()) {
    Stop-Runner 'UNTRUSTED_OR_CHANGED_RELEASE_MANIFEST' 'Release manifest bytes do not match the reviewed digest.' 'Recover the exact reviewed manifest; do not weaken or recompute the trusted digest from the candidate file.' 'Trusted digest is config-pinned and compared before parsing.'
  }
  $manifest = Read-JsonFile $ReleaseManifestPath
  $archive = Get-ReleaseArchive $Config
  $extract = Join-Path $script:EvidenceDir 'archive-extract'
  [System.IO.Directory]::CreateDirectory($extract) | Out-Null
  try {
    Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
    $firstRel = [string](@($manifest.files)[0].path)
    Assert-SafeRelativePath $firstRel
    $archiveRoot = Find-ArchiveRoot $extract $firstRel
    $verified = Copy-VerifiedManifestPayload $Config $manifest $archiveRoot $script:PayloadDir
  } catch {
    Stop-Runner 'RELEASE_CANONICAL_BYTE_VERIFICATION_FAILED' 'Archive extraction or manifest-bound canonical byte verification failed.' 'Use the exact immutable archive and reviewed manifest; do not use a CRLF-mutated worktree or normalize bytes after the fact.' 'Every manifest file is size/hash checked before and after copy into a fresh manifest-only payload.'
  }
  Add-Stage 'RELEASE_VERIFY' 'PASS' ([ordered]@{
    manifest_sha256 = $manifestHash
    files_verified = $verified
    expected_files = [int]$Config.source.expected_release_files
    entrypoints_verified = @($Config.source.expected_entrypoints).Count
    payload_source = 'manifest_only_from_canonical_archive_bytes'
    mutable_checkout_used = $false
  })
}

function Assert-CleanInheritedEnvironment {
  $script:CurrentStage = 'ENVIRONMENT_GUARD'
  $bad = @()
  foreach ($item in Get-ChildItem Env:) {
    $name = [string]$item.Name
    if ($name.StartsWith('PG', [System.StringComparison]::OrdinalIgnoreCase) -and $name -ne 'PGPASSFILE') {
      if (-not [string]::IsNullOrWhiteSpace([string]$item.Value)) { $bad += $name }
    }
  }
  foreach ($name in @('AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_PROFILE','AWS_DEFAULT_PROFILE','MINIO_ROOT_USER','MINIO_ROOT_PASSWORD','MINIO_ACCESS_KEY','MINIO_SECRET_KEY')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) { $bad += $name }
  }
  $bad = @($bad | Sort-Object -Unique)
  if ($bad.Count -gt 0) {
    Stop-Runner 'INHERITED_CREDENTIAL_OR_ENDPOINT_ENV_FORBIDDEN' ('Potentially stale or privileged environment variables are set: ' + ($bad -join ', ')) 'Open a clean shell or unset only the listed variables. Do not rotate or reset any credential.' 'Runner uses explicit run-scoped endpoints and named non-admin profiles; ambient secret/endpoint state is rejected.'
  }
  Add-Stage 'ENVIRONMENT_GUARD' 'PASS' ([ordered]@{ambient_pg_state='clean_except_optional_PGPASSFILE'; ambient_aws_secret_state='absent'; root_minio_env='absent'})
}

function Assert-Command([string]$Name) {
  if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) { throw ('COMMAND_MISSING:' + $Name) }
}

function Invoke-External([string]$Exe, [string[]]$Arguments) {
  $output = & $Exe @Arguments 2>&1
  $code = $LASTEXITCODE
  return [ordered]@{ exit_code=$code; text=([string[]]@($output) -join [Environment]::NewLine).Trim() }
}

function Invoke-HostInventory($Config) {
  $script:CurrentStage = 'HOST_RESOURCE_IDENTITY'
  foreach ($cmd in @('docker','psql','aws')) {
    try { Assert-Command $cmd } catch {
      Stop-Runner 'REQUIRED_HOST_TOOL_MISSING' ('Required tool is unavailable: ' + $cmd) 'Install or restore the already-approved host toolchain; do not add guessed runtime dependencies to the release payload.' 'Tool discovery is explicit and separate from application dependency inference.'
    }
  }

  $inspect = Invoke-External 'docker' @('inspect',[string]$Config.pg.container_name)
  if ($inspect.exit_code -ne 0) {
    Stop-Runner 'DEDICATED_PG_CONTAINER_MISSING' 'The configured run-scoped PostgreSQL container was not found.' 'Restore or select the exact existing run-scoped container; do not reuse an older run container.' 'Container name must include the current Run ID.'
  }
  $obj = $inspect.text | ConvertFrom-Json
  if (-not [bool]$obj[0].State.Running) { Stop-Runner 'DEDICATED_PG_CONTAINER_NOT_RUNNING' 'The exact PostgreSQL container exists but is not running.' 'Stop and obtain operator approval before any restart; this runner never restarts containers.' 'Container restarts are intentionally absent from the runner.' }
  $portsProp = $obj[0].NetworkSettings.Ports.PSObject.Properties['5432/tcp']
  if ($null -eq $portsProp -or $null -eq $portsProp.Value -or @($portsProp.Value).Count -ne 1) {
    Stop-Runner 'DEDICATED_PG_PORT_BINDING_INVALID' 'PostgreSQL container does not expose exactly one 5432/tcp binding.' 'Reconcile the run-scoped provisioning record; do not fall back to shared 55432.' 'Exact host/port binding is validated from Docker inspection.'
  }
  $binding = @($portsProp.Value)[0]
  if ([string]$binding.HostIp -ne [string]$Config.pg.host -or [int]$binding.HostPort -ne [int]$Config.pg.port) {
    Stop-Runner 'DEDICATED_PG_ENDPOINT_MISMATCH' 'Docker endpoint differs from the run-scoped config.' 'Use the dedicated run endpoint from authoritative provisioning.' 'No shared-instance or old-run port fallback exists.'
  }

  $minioTransport = 'not_observed'
  if (-not [string]::IsNullOrWhiteSpace([string]$Config.minio.endpoint_observation_container)) {
    $mi = Invoke-External 'docker' @('inspect',[string]$Config.minio.endpoint_observation_container)
    if ($mi.exit_code -eq 0) {
      $mobj = $mi.text | ConvertFrom-Json
      if ([bool]$mobj[0].State.Running) { $minioTransport = 'running_transport_only_not_resource_identity' }
    }
  }
  Add-Stage 'HOST_RESOURCE_IDENTITY' 'PASS' ([ordered]@{
    pg_container = [string]$Config.pg.container_name
    pg_host = [string]$Config.pg.host
    pg_port = [int]$Config.pg.port
    minio_endpoint = [string]$Config.minio.endpoint
    minio_transport_observation = $minioTransport
    minio_transport_is_resource_identity = $false
  })
}

function Write-ProbeSql([string]$Name, [string]$Sql) {
  $path = Join-Path $script:EvidenceDir $Name
  Write-NewUtf8File $path ($Sql + [Environment]::NewLine)
  return $path
}

function Invoke-PsqlProbe($Config, [string]$Role, [string]$Db, [string]$SqlFile) {
  return Invoke-External 'psql' @('-X','-w','-h',[string]$Config.pg.host,'-p',[string]$Config.pg.port,'-U',$Role,'-d',$Db,'-v','ON_ERROR_STOP=1','-A','-t','-f',$SqlFile)
}

function Get-AclProbeSql([string]$PrivilegeRole) {
  return @"
SELECT json_build_object(
  'role_safety', (
    SELECT json_build_object(
      'canlogin',r.rolcanlogin,'inherit',r.rolinherit,'superuser',r.rolsuper,
      'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,
      'replication',r.rolreplication,'bypassrls',r.rolbypassrls
    ) FROM pg_catalog.pg_roles r WHERE r.rolname=current_user
  ),
  'member_expected_privilege_role', pg_has_role(current_user,'$PrivilegeRole','MEMBER'),
  'database_connect', has_database_privilege(current_user,current_database(),'CONNECT'),
  'schema_usage', has_schema_privilege(current_user,'public','USAGE'),
  'schema_create', has_schema_privilege(current_user,'public','CREATE'),
  'tables', (
    SELECT COALESCE(json_agg(json_build_array(
      c.relname,
      has_table_privilege(current_user,c.oid,'SELECT'),
      has_table_privilege(current_user,c.oid,'INSERT'),
      has_table_privilege(current_user,c.oid,'UPDATE'),
      has_table_privilege(current_user,c.oid,'DELETE'),
      has_table_privilege(current_user,c.oid,'TRUNCATE'),
      has_table_privilege(current_user,c.oid,'REFERENCES'),
      has_table_privilege(current_user,c.oid,'TRIGGER')
    ) ORDER BY c.relname),'[]'::json)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  ),
  'sequences', (
    SELECT COALESCE(json_agg(json_build_array(
      c.relname,
      has_sequence_privilege(current_user,c.oid,'USAGE'),
      has_sequence_privilege(current_user,c.oid,'SELECT'),
      has_sequence_privilege(current_user,c.oid,'UPDATE')
    ) ORDER BY c.relname),'[]'::json)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S'
  ),
  'routines', (
    SELECT COALESCE(json_agg(json_build_array(
      p.oid::regprocedure::text,
      has_function_privilege(current_user,p.oid,'EXECUTE')
    ) ORDER BY p.oid::regprocedure::text),'[]'::json)
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
  )
)::text;
"@
}

function Assert-AclObject($Acl) {
  if (-not [bool]$Acl.role_safety.canlogin) { throw 'PG_RUNTIME_LOGIN_REQUIRED' }
  if (-not [bool]$Acl.role_safety.inherit) { throw 'PG_RUNTIME_INHERIT_REQUIRED' }
  foreach ($prop in @('superuser','createdb','createrole','replication','bypassrls')) {
    if ([bool]$Acl.role_safety.$prop) { throw ('PG_RUNTIME_ROLE_UNSAFE:' + $prop) }
  }
  if (-not [bool]$Acl.member_expected_privilege_role) { throw 'PG_EXPECTED_PRIVILEGE_ROLE_MEMBERSHIP_REQUIRED' }
  if (-not [bool]$Acl.database_connect) { throw 'PG_MATCHING_DATABASE_CONNECT_REQUIRED' }
  if (-not [bool]$Acl.schema_usage) { throw 'PG_PUBLIC_SCHEMA_USAGE_REQUIRED' }
  if ([bool]$Acl.schema_create) { throw 'PG_PUBLIC_SCHEMA_CREATE_FORBIDDEN' }
}

function Invoke-PgReadOnly($Config) {
  $script:CurrentStage = 'PG_RESTRICTED_IDENTITY_AND_ACL'
  $pgpass = [Environment]::GetEnvironmentVariable('PGPASSFILE')
  if ([string]::IsNullOrWhiteSpace($pgpass) -or -not (Test-Path -LiteralPath $pgpass -PathType Leaf)) {
    Stop-Runner 'PGPASSFILE_REQUIRED_FOR_NONINTERACTIVE_RESTRICTED_PROBE' 'No existing PGPASSFILE is available for the four run-scoped restricted login identities.' 'Point PGPASSFILE to the already-provisioned protected credential file. Do not set PGPASSWORD, reset passwords, or print secrets.' 'psql runs with -w and explicit host/port/user/database; no prompt or ambient password is accepted.'
  }

  $loginSql = @('BEGIN READ ONLY;',"SELECT current_database()||'|'||current_user||'|'||current_setting('transaction_read_only');",'ROLLBACK;') -join [Environment]::NewLine
  $loginSqlPath = Write-ProbeSql 'PG_LOGIN_READONLY.sql' $loginSql
  $pairs = @(
    [ordered]@{role=[string]$Config.pg.roles.positive_evidence; db=[string]$Config.pg.positive_db; opposite=[string]$Config.pg.negative_db; kind='evidence'; privilege=[string]$Config.pg.privilege_roles.evidence},
    [ordered]@{role=[string]$Config.pg.roles.positive_twin; db=[string]$Config.pg.positive_db; opposite=[string]$Config.pg.negative_db; kind='twin'; privilege=[string]$Config.pg.privilege_roles.twin},
    [ordered]@{role=[string]$Config.pg.roles.negative_evidence; db=[string]$Config.pg.negative_db; opposite=[string]$Config.pg.positive_db; kind='evidence'; privilege=[string]$Config.pg.privilege_roles.evidence},
    [ordered]@{role=[string]$Config.pg.roles.negative_twin; db=[string]$Config.pg.negative_db; opposite=[string]$Config.pg.positive_db; kind='twin'; privilege=[string]$Config.pg.privilege_roles.twin}
  )

  $observed = @()
  foreach ($pair in $pairs) {
    $ok = Invoke-PsqlProbe $Config $pair.role $pair.db $loginSqlPath
    $needle = $pair.db + '|' + $pair.role + '|on'
    if ($ok.exit_code -ne 0 -or -not $ok.text.Contains($needle)) {
      Stop-Runner 'PG_MATCHING_RESTRICTED_LOGIN_FAILED' ('Restricted login did not produce the required READ ONLY identity tuple for ' + $pair.role) 'Repair the protected credential mapping or authoritative run-scoped ACL; do not use qual_dedicated_admin as a substitute.' 'Each of four runtime logins must authenticate independently as itself.'
    }
    $deny = Invoke-PsqlProbe $Config $pair.role $pair.opposite $loginSqlPath
    if ($deny.exit_code -eq 0 -or $deny.text -notmatch '(?i)permission denied for database') {
      Stop-Runner 'PG_CROSS_DATABASE_DENIAL_NOT_PROVEN' ('Cross-database denial was not an explicit database ACL denial for ' + $pair.role) 'Verify the run-scoped CONNECT ACL and credential coverage. Authentication failure, missing password, timeout, or success are not accepted as ACL-denial evidence.' 'Negative proof requires the server error class "permission denied for database".'
    }

    $aclFile = Write-ProbeSql ('PG_ACL_' + $pair.role + '.sql') (Get-AclProbeSql $pair.privilege)
    $aclOut = Invoke-PsqlProbe $Config $pair.role $pair.db $aclFile
    if ($aclOut.exit_code -ne 0) {
      Stop-Runner 'PG_ACL_READBACK_FAILED' ('Effective ACL readback failed for ' + $pair.role) 'Restore read-only catalog visibility under the actual restricted principal; do not elevate the login.' 'ACL evidence is queried under each runtime login, not an admin.'
    }
    $line = @($aclOut.text -split '\r?\n' | Where-Object { $_.Trim().StartsWith('{') -and $_.Trim().EndsWith('}') }) | Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace([string]$line)) { Stop-Runner 'PG_ACL_JSON_MISSING' 'ACL probe returned no machine-readable JSON.' 'Inspect the preserved probe output and query compatibility without changing privileges.' 'Probe format is versioned and fail-closed.' }
    $acl = $line | ConvertFrom-Json
    try { Assert-AclObject $acl } catch {
      Stop-Runner 'PG_RUNTIME_ROLE_OR_SCHEMA_SAFETY_FAILED' $_.Exception.Message 'Restore the exact run-scoped runtime role contract; do not grant broader rights to satisfy the probe.' 'Role attributes, privilege-role membership, CONNECT, schema USAGE and CREATE denial are checked under the login.'
    }
    $digest = Get-Sha256Text $line
    $expected = if ($pair.kind -eq 'evidence') { [string]$Config.pg.expected_acl_digest_sha256.evidence } else { [string]$Config.pg.expected_acl_digest_sha256.twin }
    if ([string]::IsNullOrWhiteSpace($expected) -or $expected -notmatch '^[0-9a-f]{64}$') {
      Stop-Runner 'PG_FROZEN_ACL_DIGEST_REQUIRED' ('No independently frozen effective ACL digest is configured for ' + $pair.kind) 'Derive and review the expected V1 ACL digest from authoritative schema/ACL policy, then pin it in config. Do not bless the observed digest merely because it was observed.' 'Full admission cannot self-authorize its own ACL baseline.'
    }
    if ($digest -ne $expected.ToLowerInvariant()) {
      Stop-Runner 'PG_FROZEN_ACL_DIGEST_MISMATCH' ('Effective ACL digest differs for ' + $pair.role) 'Compare the complete preserved table/sequence/routine matrix with the frozen contract and remediate outside this read-only runner.' 'All public tables, sequences, routines and schema/database effective privileges are digest-bound.'
    }
    $observed += [ordered]@{role=$pair.role; database=$pair.db; kind=$pair.kind; acl_digest_sha256=$digest; matching_login='PASS'; opposite_database='EXPLICIT_PERMISSION_DENIED'}
  }
  Add-Stage 'PG_RESTRICTED_IDENTITY_AND_ACL' 'PASS' ([ordered]@{principals=$observed; admin_identity_used=$false; sql_mode='READ_ONLY_AND_CATALOG_SELECT_ONLY'})
}

function Assert-MinioPolicyReadOnly([string]$Path, [string]$ExpectedSha, [string]$Bucket, [string]$Prefix) {
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'MINIO_POLICY_EVIDENCE_REQUIRED' }
  if ([string]::IsNullOrWhiteSpace($ExpectedSha) -or $ExpectedSha -notmatch '^[0-9a-f]{64}$') { throw 'MINIO_POLICY_DIGEST_REQUIRED' }
  if ([string]::IsNullOrWhiteSpace($Prefix)) { throw 'MINIO_POLICY_PREFIX_REQUIRED' }
  if ((Get-Sha256File $Path) -ne $ExpectedSha.ToLowerInvariant()) { throw 'MINIO_POLICY_DIGEST_MISMATCH' }
  $policy = Read-JsonFile $Path
  $bucketArn = 'arn:aws:s3:::' + $Bucket
  $prefixBase = $Prefix.TrimStart('/')
  $objectArnPrefix = $bucketArn + '/' + $prefixBase
  $allowedActions = @('s3:listbucket','s3:getobject','s3:getobjectversion','s3:getbucketlocation')

  foreach ($statement in @($policy.Statement)) {
    if ([string]$statement.Effect -ne 'Allow') { continue }
    $actions = @($statement.Action)
    foreach ($action in $actions) {
      $a = ([string]$action).ToLowerInvariant()
      if ($allowedActions -notcontains $a) {
        throw 'MINIO_ACTION_NOT_READONLY_WHITELISTED'
      }
    }
    foreach ($resource in @($statement.Resource)) {
      $r = [string]$resource
      if ($r -eq $bucketArn) { continue }
      if (-not $r.StartsWith($objectArnPrefix, [System.StringComparison]::Ordinal)) {
        throw 'MINIO_ALLOW_RESOURCE_OUTSIDE_RUN_PREFIX'
      }
    }
    if (@($actions | Where-Object { ([string]$_).ToLowerInvariant() -eq 's3:listbucket' }).Count -gt 0) {
      if ($null -eq $statement.Condition) { throw 'MINIO_LIST_PREFIX_CONDITION_REQUIRED' }
      $prefixValues = @()
      foreach ($group in $statement.Condition.PSObject.Properties) {
        $prefixProp = $group.Value.PSObject.Properties['s3:prefix']
        if ($null -ne $prefixProp) { $prefixValues += @($prefixProp.Value) }
      }
      if ($prefixValues.Count -eq 0) { throw 'MINIO_LIST_PREFIX_CONDITION_REQUIRED' }
      foreach ($value in $prefixValues) {
        $v = [string]$value
        if (-not $v.StartsWith($prefixBase, [System.StringComparison]::Ordinal)) {
          throw 'MINIO_LIST_PREFIX_CONDITION_OUTSIDE_RUN_PREFIX'
        }
      }
    }
  }
}

function Invoke-MinioReadOnly($Config) {
  $script:CurrentStage = 'MINIO_RESTRICTED_IDENTITY_AND_SCOPE'
  $profile = if (-not [string]::IsNullOrWhiteSpace($AwsProfile)) { $AwsProfile } else { [string]$Config.minio.aws_profile }
  $bucket = [string]$Config.minio.bucket
  $prefix = [string]$Config.minio.prefix
  $deniedBucket = [string]$Config.minio.denied_bucket
  if ([string]::IsNullOrWhiteSpace($profile) -or [string]::IsNullOrWhiteSpace($bucket) -or [string]::IsNullOrWhiteSpace($prefix) -or [string]::IsNullOrWhiteSpace($deniedBucket)) {
    Stop-Runner 'MINIO_SCOPED_RESTRICTED_INPUT_REQUIRED' 'Run-scoped restricted profile, bucket, prefix, or explicit denied-scope bucket is still unresolved.' 'Recover these values from the authoritative 800c provisioning record. Do not use MinIO root/admin and do not infer them from the old 72dc endpoint container.' 'Transport endpoint and resource identity are separate; all four scoped inputs are mandatory.'
  }
  if ($deniedBucket -eq $bucket) {
    Stop-Runner 'MINIO_DENIED_BUCKET_MUST_BE_DISTINCT' 'Negative-scope bucket equals the allowed run bucket.' 'Use a known existing out-of-scope bucket for the restricted identity denial probe.' 'Negative proof cannot target the allowed resource.'
  }
  try {
    Assert-MinioPolicyReadOnly $MinioPolicyPath ([string]$Config.minio.expected_policy_sha256) $bucket $prefix
  } catch {
    Stop-Runner 'MINIO_POLICY_READONLY_CONTRACT_FAILED' $_.Exception.Message 'Use the reviewed non-secret IAM policy evidence for the restricted run identity and pin its digest. Do not call mc admin or change policy from this runner.' 'Policy bytes are digest-bound and Allow statements are rejected if they contain write/admin actions or resources outside the run bucket.'
  }

  $base = @('--profile',$profile,'--region','us-east-1','--endpoint-url',[string]$Config.minio.endpoint,'--no-cli-pager','s3api')
  $head = Invoke-External 'aws' ($base + @('head-bucket','--bucket',$bucket))
  if ($head.exit_code -ne 0) {
    Stop-Runner 'MINIO_IN_SCOPE_HEAD_FAILED' 'Restricted profile cannot head the configured run bucket.' 'Verify the already-provisioned restricted identity and endpoint. No root/admin fallback is permitted.' 'Positive proof runs only under an explicitly named restricted AWS profile.'
  }
  $list = Invoke-External 'aws' ($base + @('list-objects-v2','--bucket',$bucket,'--prefix',$prefix,'--max-keys','1','--query','{KeyCount:KeyCount,IsTruncated:IsTruncated}','--output','json'))
  if ($list.exit_code -ne 0) {
    Stop-Runner 'MINIO_IN_SCOPE_LIST_FAILED' 'Restricted profile cannot list the configured run prefix.' 'Reconcile the exact prefix policy from provisioning; do not widen the IAM policy in this runner.' 'Only non-mutating head/list operations are implemented.'
  }
  $deny = Invoke-External 'aws' ($base + @('head-bucket','--bucket',$deniedBucket))
  if ($deny.exit_code -eq 0 -or $deny.text -notmatch '(?i)(AccessDenied|Forbidden|403)') {
    Stop-Runner 'MINIO_OUT_OF_SCOPE_EXPLICIT_DENIAL_NOT_PROVEN' 'The negative bucket probe was not an explicit authorization denial.' 'Choose a known existing out-of-scope bucket and verify the restricted policy. NoSuchBucket, timeout, or success are not ACL denial evidence.' 'Negative scope requires AccessDenied/Forbidden/403 under the same restricted principal.'
  }
  Add-Stage 'MINIO_RESTRICTED_IDENTITY_AND_SCOPE' 'PASS' ([ordered]@{
    endpoint=[string]$Config.minio.endpoint
    bucket=$bucket
    prefix=$prefix
    restricted_profile_name=$profile
    in_scope_head='PASS'
    in_scope_list='PASS'
    out_of_scope_bucket='EXPLICIT_ACCESS_DENIED'
    policy_sha256=Get-Sha256File $MinioPolicyPath
    write_api_implemented=$false
    admin_api_implemented=$false
  })
}

function Invoke-SelfTest {
  $checks = 0
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('mcft-cap09-deploy-runner-selftest-' + [Guid]::NewGuid().ToString('N'))
  [System.IO.Directory]::CreateDirectory($tmp) | Out-Null
  try {
    try { Assert-SafeRelativePath '../x'; throw 'SELFTEST_EXPECTED_UNSAFE_PATH_FAILURE' } catch { if ($_.Exception.Message -eq 'SELFTEST_EXPECTED_UNSAFE_PATH_FAILURE') { throw }; $checks++ }
    Assert-SafeRelativePath 'scripts/runtime_acceptance/x.ps1'; $checks++

    $src = Join-Path $tmp 'src'
    $dst = Join-Path $tmp 'dst'
    [System.IO.Directory]::CreateDirectory((Join-Path $src 'dir')) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $src 'a.txt'),'alpha',(New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false))
    [System.IO.File]::WriteAllText((Join-Path $src 'dir\b.txt'),'beta',(New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false))
    $rows = @(
      [pscustomobject]@{path='a.txt';size_bytes=(Get-Item (Join-Path $src 'a.txt')).Length;sha256=(Get-Sha256File (Join-Path $src 'a.txt'))},
      [pscustomobject]@{path='dir/b.txt';size_bytes=(Get-Item (Join-Path $src 'dir\b.txt')).Length;sha256=(Get-Sha256File (Join-Path $src 'dir\b.txt'))}
    )
    $cfg = [pscustomobject]@{source=[pscustomobject]@{expected_release_files=2;expected_entrypoints=@('a.txt')};subject_commit_sha=('a'*40)}
    $manifest = [pscustomobject]@{subject_commit_sha=('a'*40);files=$rows}
    if ((Copy-VerifiedManifestPayload $cfg $manifest $src $dst) -ne 2) { throw 'SELFTEST_COPY_COUNT' }
    if ((Get-ChildItem -LiteralPath $dst -File -Recurse).Count -ne 2) { throw 'SELFTEST_PAYLOAD_COUNT' }
    $checks += 2

    $old = [Environment]::GetEnvironmentVariable('PGPASSWORD')
    try {
      [Environment]::SetEnvironmentVariable('PGPASSWORD','synthetic-never-real-secret')
      $script:CurrentStage='SELFTEST_ENV'
      $script:FailureDetail=$null
      try { Assert-CleanInheritedEnvironment; throw 'SELFTEST_EXPECTED_ENV_FAILURE' } catch {
        if ($_.Exception.Message -eq 'SELFTEST_EXPECTED_ENV_FAILURE') { throw }
        if ($null -eq $script:FailureDetail -or $script:FailureDetail.code -ne 'INHERITED_CREDENTIAL_OR_ENDPOINT_ENV_FORBIDDEN') { throw }
        $checks++
      }
    } finally {
      [Environment]::SetEnvironmentVariable('PGPASSWORD',$old)
      $script:FailureDetail=$null
    }

    $policy = Join-Path $tmp 'policy.json'
    [System.IO.File]::WriteAllText($policy,'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::runbucket"],"Condition":{"StringLike":{"s3:prefix":["scope/*"]}}},{"Effect":"Allow","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::runbucket/scope/*"]}]}',(New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false))
    Assert-MinioPolicyReadOnly $policy (Get-Sha256File $policy) 'runbucket' 'scope/'
    $checks++
    [System.IO.File]::WriteAllText($policy,'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject"],"Resource":["arn:aws:s3:::runbucket/scope/*"]}]}',(New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false))
    try { Assert-MinioPolicyReadOnly $policy (Get-Sha256File $policy) 'runbucket' 'scope/'; throw 'SELFTEST_EXPECTED_POLICY_FAILURE' } catch { if ($_.Exception.Message -eq 'SELFTEST_EXPECTED_POLICY_FAILURE') { throw }; $checks++ }

    if ($checks -lt 7) { throw 'SELFTEST_CHECK_COUNT' }
    Write-Host ('WINDOWS_DEPLOYMENT_RUNNER_SELFTEST_PASS checks=' + $checks + ' execution_authorized=false production_authorized=false')
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-Main {
  if ([string]::IsNullOrWhiteSpace($ConfigPath)) { throw 'CONFIG_PATH_REQUIRED' }
  if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { throw 'CONFIG_PATH_MISSING' }
  $config = Read-JsonFile $ConfigPath
  Assert-Config $config
  if (-not (Test-Path -LiteralPath $EvidenceRoot -PathType Container)) {
    [System.IO.Directory]::CreateDirectory($EvidenceRoot) | Out-Null
  }
  New-EvidenceState $config

  try {
    Invoke-ReleaseStage $config
    if ($Mode -eq 'ReleaseOnly') {
      $script:Result.status = 'RELEASE_PREP_PASS_EXECUTE_HOLD'
      Add-Stage 'AUTHORITY_BOUNDARY' 'PASS' ([ordered]@{execution_authorized=$false;production_authorized=$false;admission_input_ready=$false})
      Save-Result
      $script:Result | ConvertTo-Json -Depth 20
      return
    }

    Assert-CleanInheritedEnvironment
    Invoke-HostInventory $config

    if ($Mode -eq 'HostPreflight') {
      $script:Result.status = 'HOST_PREFLIGHT_PASS_RESTRICTED_IDENTITY_PENDING_EXECUTE_HOLD'
      Add-Stage 'AUTHORITY_BOUNDARY' 'PASS' ([ordered]@{execution_authorized=$false;production_authorized=$false;admission_input_ready=$false})
      Save-Result
      $script:Result | ConvertTo-Json -Depth 20
      return
    }

    Invoke-PgReadOnly $config
    Invoke-MinioReadOnly $config
    $script:Result.admission_input_ready = $true
    $script:Result.status = 'LOCAL_ADMISSION_INPUT_READY_EXECUTE_HOLD'
    Add-Stage 'AUTHORITY_BOUNDARY' 'PASS' ([ordered]@{
      signed_adoption_qualification_issued=$false
      permit_issued=$false
      permit_consumed=$false
      execution_authorized=$false
      production_authorized=$false
    })
    Save-Result
    $script:Result | ConvertTo-Json -Depth 20
  } catch {
    if ($null -eq $script:FailureDetail) {
      $script:FailureDetail = [ordered]@{
        stage=$script:CurrentStage
        code='UNCLASSIFIED_RUNNER_FAILURE'
        root_cause=$_.Exception.Message
        remedy='Inspect the preserved evidence directory and fix the specific stage without weakening the guard.'
        regression_guard='Fresh output paths are exclusive and all effectful production operations are absent from this runner.'
      }
    }
    $script:Result.failure = $script:FailureDetail
    $script:Result.status = 'FAIL_CLOSED_EXECUTE_HOLD'
    $script:Result.admission_input_ready = $false
    Save-Result
    $script:Result | ConvertTo-Json -Depth 20
    exit 2
  }
}

if ($SelfTest) {
  Invoke-SelfTest
  exit 0
}

Invoke-Main
