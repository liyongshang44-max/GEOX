[CmdletBinding()]
param(
    [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedParentDatabase = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5'
$Bindings = [ordered]@{
    'MCFT_EA5E2_TRANSIENT_S3_ENDPOINT'          = 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT'
    'MCFT_EA5E2_TRANSIENT_S3_BUCKET'            = 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET'
    'MCFT_EA5E2_TRANSIENT_S3_REGION'            = 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION'
    'MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID'     = 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID'
    'MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY' = 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY'
    'MCFT_CAP09_PARENT_DATABASE_URL'             = 'GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL'
}

function Resolve-EnvironmentValue {
    param(
        [Parameter(Mandatory = $true)][string]$TargetName,
        [Parameter(Mandatory = $true)][string]$SourceName
    )

    foreach ($scope in @('Process', 'User', 'Machine')) {
        $targetValue = [Environment]::GetEnvironmentVariable($TargetName, $scope)
        if (-not [string]::IsNullOrWhiteSpace($targetValue)) {
            return [pscustomobject]@{
                Value      = $targetValue
                BoundFrom  = $TargetName
                Scope      = $scope
            }
        }
    }

    foreach ($scope in @('Process', 'User', 'Machine')) {
        $sourceValue = [Environment]::GetEnvironmentVariable($SourceName, $scope)
        if (-not [string]::IsNullOrWhiteSpace($sourceValue)) {
            return [pscustomobject]@{
                Value      = $sourceValue
                BoundFrom  = $SourceName
                Scope      = $scope
            }
        }
    }

    return $null
}

$ResolvedValues = @{}
$Report = @()
$Missing = @()

foreach ($entry in $Bindings.GetEnumerator()) {
    $resolution = Resolve-EnvironmentValue -TargetName $entry.Key -SourceName $entry.Value
    if ($null -eq $resolution) {
        $Missing += $entry.Key
        $Report += [pscustomobject]@{
            target = $entry.Key
            source = $entry.Value
            status = 'MISSING'
            scope  = $null
        }
        continue
    }

    $ResolvedValues[$entry.Key] = $resolution.Value
    $Report += [pscustomobject]@{
        target = $entry.Key
        source = $entry.Value
        status = 'PRESENT'
        scope  = $resolution.Scope
    }
}

if ($Missing.Count -gt 0) {
    [pscustomobject]@{
        schema_version = 'geox_mcft_cap09_controlled_host_credential_binding_v1'
        status         = 'FAIL'
        missing        = $Missing
        bindings       = $Report
        secret_values_emitted = $false
    } | ConvertTo-Json -Depth 6
    throw ('CONTROLLED_CAPTURE_HOST_ENV_REQUIRED:' + ($Missing -join ','))
}

$Endpoint = [uri]$ResolvedValues['MCFT_EA5E2_TRANSIENT_S3_ENDPOINT']
if ($Endpoint.Scheme -ne 'https') {
    throw 'CONTROLLED_CAPTURE_S3_HTTPS_ENDPOINT_REQUIRED'
}
if (@('localhost', '127.0.0.1', '::1') -contains $Endpoint.Host) {
    throw 'CONTROLLED_CAPTURE_REMOTE_S3_ENDPOINT_REQUIRED'
}
if ($ResolvedValues['MCFT_EA5E2_TRANSIENT_S3_BUCKET'] -ne 'geox-mcft-cap09-formal-raw-v1') {
    throw 'CONTROLLED_CAPTURE_EXISTING_PRIVATE_BUCKET_BINDING_REQUIRED'
}
if ($ResolvedValues['MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID'] -eq 'minioadmin' -or
    $ResolvedValues['MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY'] -eq 'minioadmin123') {
    throw 'CONTROLLED_CAPTURE_CI_CREDENTIAL_FORBIDDEN'
}

$Parent = [uri]$ResolvedValues['MCFT_CAP09_PARENT_DATABASE_URL']
if (@('postgres', 'postgresql') -notcontains $Parent.Scheme) {
    throw 'CONTROLLED_CAPTURE_POSTGRES_PARENT_REQUIRED'
}
$ParentDatabase = [uri]::UnescapeDataString($Parent.AbsolutePath.TrimStart('/'))
if ($ParentDatabase -ne $ExpectedParentDatabase) {
    throw "CONTROLLED_CAPTURE_T4R1_PARENT_DATABASE_REQUIRED:${ExpectedParentDatabase}:$ParentDatabase"
}

if (-not $PreflightOnly) {
    foreach ($entry in $Bindings.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, [string]$ResolvedValues[$entry.Key], 'Process')
    }
    [Environment]::SetEnvironmentVariable('MCFT_QMIG_CREDENTIAL_BINDING_READY', 'true', 'Process')
}

[pscustomobject]@{
    schema_version = 'geox_mcft_cap09_controlled_host_credential_binding_v1'
    status         = 'PASS'
    mode           = $(if ($PreflightOnly) { 'PREFLIGHT_ONLY' } else { 'PROCESS_INJECTED' })
    binding_count  = $Bindings.Count
    parent_database_identity = $ExpectedParentDatabase
    private_bucket_identity  = 'geox-mcft-cap09-formal-raw-v1'
    secret_values_emitted    = $false
    production_mutation      = $false
    bindings                 = $Report
} | ConvertTo-Json -Depth 6
