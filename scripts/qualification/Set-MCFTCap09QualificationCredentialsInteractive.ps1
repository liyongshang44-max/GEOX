[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBucket = 'geox-mcft-cap09-formal-raw-v1'
$ExpectedParentDatabase = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5'

function Read-SecretText {
    param([Parameter(Mandatory = $true)][string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

$endpoint = (Read-Host 'Cloudflare R2 S3 endpoint (https://<ACCOUNT_ID>.r2.cloudflarestorage.com)').Trim()
$bucketInput = (Read-Host "R2 bucket [$ExpectedBucket]").Trim()
$bucket = if ([string]::IsNullOrWhiteSpace($bucketInput)) { $ExpectedBucket } else { $bucketInput }
$regionInput = (Read-Host 'R2 region [auto]').Trim()
$region = if ([string]::IsNullOrWhiteSpace($regionInput)) { 'auto' } else { $regionInput }
$accessKey = Read-SecretText 'R2 Access Key ID'
$secretKey = Read-SecretText 'R2 Secret Access Key'
$databaseUrl = Read-SecretText "Neon connection string for $ExpectedParentDatabase"

$endpointUri = [uri]$endpoint
if ($endpointUri.Scheme -ne 'https' -or $endpointUri.AbsolutePath -ne '/' -or $endpointUri.Query -or $endpointUri.Fragment) {
    throw 'CONTROLLED_CAPTURE_S3_ENDPOINT_INVALID'
}
if (@('localhost', '127.0.0.1', '::1') -contains $endpointUri.Host) {
    throw 'CONTROLLED_CAPTURE_REMOTE_S3_ENDPOINT_REQUIRED'
}
if ($bucket -ne $ExpectedBucket) {
    throw "CONTROLLED_CAPTURE_EXISTING_PRIVATE_BUCKET_BINDING_REQUIRED:${ExpectedBucket}:$bucket"
}
if ([string]::IsNullOrWhiteSpace($accessKey) -or [string]::IsNullOrWhiteSpace($secretKey)) {
    throw 'CONTROLLED_CAPTURE_R2_CREDENTIAL_REQUIRED'
}
if ($accessKey -eq 'minioadmin' -or $secretKey -eq 'minioadmin123') {
    throw 'CONTROLLED_CAPTURE_CI_CREDENTIAL_FORBIDDEN'
}

$dbUri = [uri]$databaseUrl
if (@('postgres', 'postgresql') -notcontains $dbUri.Scheme) {
    throw 'CONTROLLED_CAPTURE_POSTGRES_PARENT_REQUIRED'
}
$dbName = [uri]::UnescapeDataString($dbUri.AbsolutePath.TrimStart('/'))
if ($dbName -ne $ExpectedParentDatabase) {
    throw "CONTROLLED_CAPTURE_T4R1_PARENT_DATABASE_REQUIRED:${ExpectedParentDatabase}:$dbName"
}

[Environment]::SetEnvironmentVariable('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT', $endpointUri.GetLeftPart([System.UriPartial]::Authority) + '/', 'Process')
[Environment]::SetEnvironmentVariable('MCFT_EA5E2_TRANSIENT_S3_BUCKET', $bucket, 'Process')
[Environment]::SetEnvironmentVariable('MCFT_EA5E2_TRANSIENT_S3_REGION', $region, 'Process')
[Environment]::SetEnvironmentVariable('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID', $accessKey, 'Process')
[Environment]::SetEnvironmentVariable('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY', $secretKey, 'Process')
[Environment]::SetEnvironmentVariable('MCFT_CAP09_PARENT_DATABASE_URL', $databaseUrl, 'Process')
[Environment]::SetEnvironmentVariable('MCFT_QMIG_CREDENTIAL_BINDING_READY', 'true', 'Process')

[pscustomobject]@{
    schema_version = 'geox_mcft_cap09_controlled_host_interactive_binding_v1'
    status = 'PASS'
    mode = 'PROCESS_ONLY_NONPERSISTENT'
    private_bucket_identity = $ExpectedBucket
    parent_database_identity = $ExpectedParentDatabase
    region = $region
    secret_values_emitted = $false
    values_persisted_to_disk = $false
    production_mutation = $false
} | ConvertTo-Json -Depth 5
