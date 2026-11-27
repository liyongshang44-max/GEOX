param([Parameter(Mandatory=$true)][string]$Subject,[Parameter(Mandatory=$true)][string]$ManagerSubject,[Parameter(Mandatory=$true)][string]$PgContainerId,[Parameter(Mandatory=$true)][string]$MigrationSubject,[Parameter(Mandatory=$true)][string]$MigrationSource,[Parameter(Mandatory=$true)][string]$MigrationPhysical,[switch]$ResumeAfterWebBuild)
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$Kit='D:\gptdown\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117'
$Ca=Join-Path $Kit '.local\secrets\fdw-idp.pem'
$Local=Join-Path $HOME 'GEOX-E2E01-LOCAL'
$Pg='geox-product-e2e01-postgres'
$OldPg='geox-v1-postgres'
if($Subject -notmatch '^[a-f0-9]{40}$' -or (git -C $Repo rev-parse HEAD) -cne $Subject -or @(git -C $Repo status --porcelain --untracked-files=no).Count){throw 'HOLD_EXACT_PRODUCT_SOURCE'}
if($ManagerSubject -notmatch '^[a-f0-9-]{36}$' -or $PgContainerId -notmatch '^[a-f0-9]{64}$' -or $MigrationSubject -notmatch '^[a-f0-9]{40}$' -or $MigrationSource -notmatch '^[a-f0-9]{64}$' -or $MigrationPhysical -notmatch '^[a-f0-9]{64}$'){throw 'HOLD_INPUT_IDENTITY'}
if(Test-Path -LiteralPath $Local){throw 'HOLD_LOCAL_CONFIG_ALREADY_EXISTS'}
if((docker inspect --format '{{.Id}}' $Pg) -cne $PgContainerId -or
 (docker inspect --format '{{.State.Status}}' $Pg) -cne 'running' -or
 (docker inspect --format '{{.State.Status}}' $OldPg) -cne 'exited' -or
 (docker port $Pg 5432/tcp) -cne '127.0.0.1:15435'){throw 'HOLD_PG_IDENTITY'}
if(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue){throw 'HOLD_MANAGER_PORT_IN_USE'}
$api=@(Get-NetTCPConnection -LocalPort 14174 -State Listen -ErrorAction SilentlyContinue)
$gw=@(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue)
if($api.Count -ne 1 -or $gw.Count -ne 1 -or $api[0].LocalAddress -cne '127.0.0.1' -or $gw[0].LocalAddress -cne '127.0.0.1'){throw 'HOLD_EXISTING_FDW_RUNTIME'}
$proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($gw[0].OwningProcess)"
if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'oidc-session-gateway\.mjs' -or $proc.CommandLine -match 'e2e01'){throw 'HOLD_GATEWAY_PROCESS_IDENTITY'}
$Node=$proc.ExecutablePath
if((& $Node --version) -notmatch '^v24\.'){throw 'HOLD_NODE24'}
if(-not(Test-Path -LiteralPath $Ca -PathType Leaf)){throw 'HOLD_CA'}
$cert=New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($Ca)
if($cert.Thumbprint -cne '9DDB1DE78D7FFE64A78C8FF70AD48696F8569400'){throw 'HOLD_CA_IDENTITY'}
$fdwCfg=Get-Content -Raw -LiteralPath (Join-Path $Kit '.local\runtime-config.json')|ConvertFrom-Json
if($fdwCfg.expectedHead -cne '526138b81d35688b28c9184d665b6e972899a0c0' -or (git -C $fdwCfg.fdwCheckout rev-parse HEAD) -cne $fdwCfg.expectedHead){throw 'HOLD_FDW_SUBJECT'}
Remove-Variable fdwCfg
$original=Join-Path $Kit 'oidc-session-gateway.mjs'
$derived=Join-Path $Kit 'oidc-session-gateway-e2e01.mjs'
if(Test-Path -LiteralPath $derived){throw 'HOLD_GATEWAY_COPY_EXISTS'}
$originalHash=(Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
$oldServer=@(docker inspect geox-v1-server | ConvertFrom-Json)[0]
if($oldServer.State.Status -cne 'exited'){throw 'HOLD_OLD_SERVER_STATE'}
$urls=@($oldServer.Config.Env|Where-Object {$_ -like 'GEOX_RUNTIME_DATABASE_URL=*'})
if($urls.Count -ne 1){throw 'HOLD_EXISTING_RUNTIME_CREDENTIAL'}
$originalUrl=$urls[0].Substring('GEOX_RUNTIME_DATABASE_URL='.Length)
try{$u=[Uri]$originalUrl}catch{throw 'HOLD_RUNTIME_URL_FORMAT'}
if($u.Scheme -notin @('postgres','postgresql') -or $u.Host -cne 'postgres' -or $u.Port -ne 5432 -or $u.AbsolutePath -cne '/landos' -or $u.UserInfo -notmatch '^geox_runtime_v1:.+' -or $u.Query -or $u.Fragment){throw 'HOLD_RUNTIME_CREDENTIAL_BINDING'}
$runtimeUrl=$u.Scheme+'://'+$u.UserInfo+'@127.0.0.1:15435/landos'
Remove-Variable oldServer,urls,originalUrl,u
$utf8=New-Object Text.UTF8Encoding($false)
Push-Location $Repo
try{
 & $Node --test scripts/product/e2e01/contract.test.mjs
 if($LASTEXITCODE -ne 0){throw 'HOLD_CONTRACT_TEST'}
 if($ResumeAfterWebBuild){
  $priorWeb='f07df587180949549246f90d33b91c22c89fada2'
  $changed=@(git diff --name-only $priorWeb HEAD -- apps/web packages pnpm-lock.yaml package.json pnpm-workspace.yaml scripts/product/e2e01/build-web.mjs)
  if($LASTEXITCODE -ne 0 -or $changed.Count){throw 'HOLD_WEB_SOURCE_CHANGED'}
  $dist=Join-Path $Repo 'apps\web\.local-manager-e2e01\dist'
  if(-not(Test-Path -LiteralPath (Join-Path $dist 'index.html') -PathType Leaf)){throw 'HOLD_PRIOR_WEB_BUILD_MISSING'}
  Write-Host 'PRIOR_WEB_BUILD_REUSED=PASS'
 }else{
  & $Node scripts/product/e2e01/build-web.mjs
  if($LASTEXITCODE -ne 0){throw 'HOLD_WEB_BUILD'}
 }
 & $Node scripts/product/e2e01/prepare-gateway.mjs $Kit
 if($LASTEXITCODE -ne 0){throw 'HOLD_GATEWAY_PREPARATION'}
 & $Node --check $derived
 if($LASTEXITCODE -ne 0){throw 'HOLD_GATEWAY_SYNTAX'}
 New-Item -ItemType Directory -Path $Local|Out-Null
 $policyFile=Join-Path $Local 'owner-land-grants.json'
 $cfgFile=Join-Path $Local 'config.json'
 $policy=[ordered]@{schema='geox.local-owner-land-grants.e2e01.v1';decision='AUTHORIZE_BOUNDED_MANAGER_INTEGRATION';subject=$ManagerSubject;revision=1;phase='PREWRITE';create_status='ACTIVE';field_grants=@()}
 $cfg=[ordered]@{fdwKit=$Kit;ownerPolicy=$policyFile;subject=$ManagerSubject;writeAdmitted=$false;pgContainerId=$PgContainerId;migrationSubject=$MigrationSubject;migrationSource=$MigrationSource;migrationPhysical=$MigrationPhysical}
 [IO.File]::WriteAllText($policyFile,($policy|ConvertTo-Json -Depth 4 -Compress),$utf8)
 [IO.File]::WriteAllText($cfgFile,($cfg|ConvertTo-Json -Depth 4 -Compress),$utf8)
 & (Join-Path $PSScriptRoot 'Read-DatabaseProof.ps1') -Stage Before
 function Start-Visible([string]$Command){
  $enc=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
  Start-Process powershell.exe -ArgumentList @('-NoProfile','-NoExit','-EncodedCommand',$enc) -WindowStyle Normal
 }
 function Wait-Http([string]$Url,[string]$Want){
  for($i=0;$i -lt 15;$i++){
   $s=curl.exe -s --noproxy '*' --connect-timeout 1 --max-time 2 -o NUL -w '%{http_code}' $Url
   if($LASTEXITCODE -eq 0 -and $s -ceq $Want){return}
   Start-Sleep -Seconds 1
  }
  throw 'HOLD_HTTP_READINESS'
 }
 $keys=@('GEOX_E2E01_CONFIG','GEOX_E2E01_DATABASE_URL','NODE_EXTRA_CA_CERTS')
 $backup=@{}
 try{
  foreach($k in $keys){$backup[$k]=[Environment]::GetEnvironmentVariable($k,'Process')}
  $env:GEOX_E2E01_CONFIG=$cfgFile
  $env:GEOX_E2E01_DATABASE_URL=$runtimeUrl
  $env:NODE_EXTRA_CA_CERTS=$Ca
  $cmd='Set-Location -LiteralPath ''{0}''; & ''{1}'' --import tsx ''scripts/product/e2e01/manager-local.mjs''; Write-Host (''MANAGER_EXIT=''+$LASTEXITCODE)' -f $Repo,$Node
  Start-Visible $cmd
 }finally{
  foreach($k in $backup.Keys){[Environment]::SetEnvironmentVariable($k,$backup[$k],'Process')}
  Remove-Variable runtimeUrl -ErrorAction SilentlyContinue
 }
 Wait-Http 'http://127.0.0.1:14175/api/v1/manager/fields' '401'
 Write-Host 'MANAGER_PREWRITE_API_READY=PASS'
 $now=@(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue)
 if($now.Count -ne 1 -or $now[0].OwningProcess -ne $proc.ProcessId){throw 'HOLD_GATEWAY_PROCESS_CHANGED'}
 if((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -cne $originalHash){throw 'HOLD_ORIGINAL_GATEWAY_CHANGED'}
 Stop-Process -Id $proc.ProcessId -ErrorAction Stop
 for($i=0;$i -lt 10;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Seconds 1
 }
 if(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue){throw 'HOLD_OLD_GATEWAY_STILL_LISTENING'}
 $prior=[Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS','Process')
 try{
  $env:NODE_EXTRA_CA_CERTS=$Ca
  $cmd='Set-Location -LiteralPath ''{0}''; & ''{1}'' ''{2}''; Write-Host (''GATEWAY_EXIT=''+$LASTEXITCODE)' -f $Kit,$Node,$derived
  Start-Visible $cmd
 }finally{[Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS',$prior,'Process')}
 Wait-Http 'http://127.0.0.1:14173/manager' '200'
 Wait-Http 'http://127.0.0.1:14173/api/v1/manager/fields' '401'
 Wait-Http 'http://127.0.0.1:14174/api/bootstrap' '401'
 Write-Host 'E2E01_BROWSER_PREWRITE_READY=PASS'
 Write-Host 'WRITE_ADMITTED=FALSE'
 Write-Host 'OPEN=http://127.0.0.1:14173/manager'
}finally{Pop-Location;Remove-Variable runtimeUrl -ErrorAction SilentlyContinue}
