param([Parameter(Mandatory=$true)][string]$Subject)
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$root=Join-Path $HOME 'GEOX-E2E01-LOCAL'
$cfgFile=Join-Path $root 'config.json'
$cfg=Get-Content -LiteralPath $cfgFile -Raw|ConvertFrom-Json
$policyFile=Join-Path $root 'owner-land-grants.json'
$policy=Get-Content -LiteralPath $policyFile -Raw|ConvertFrom-Json
$Kit='D:\gptdown\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117'
$Ca=Join-Path $Kit '.local\secrets\fdw-idp.pem'
if((git -C $Repo rev-parse HEAD) -cne $Subject -or @(git -C $Repo status --porcelain --untracked-files=no).Count){throw 'HOLD_EXACT_PRODUCT_SOURCE'}
if($cfg.fdwKit -cne $Kit -or $cfg.ownerPolicy -cne (Join-Path $root 'owner-land-grants.json') -or $cfg.writeAdmitted -ne $false -or $cfg.subject -cne '2bb8822d-1b7f-4ad5-9cc7-9dd99aee2083' -or $policy.subject -cne $cfg.subject -or $policy.phase -cne 'PREWRITE' -or $policy.create_status -cne 'REVOKED' -or $policy.revision -ne 2 -or @($policy.field_grants).Count){throw 'HOLD_REVOKED_PREWRITE_POLICY'}
if($policy.schema -cne 'geox.local-owner-land-grants.e2e01.v1' -or $policy.decision -cne 'AUTHORIZE_BOUNDED_MANAGER_INTEGRATION'){throw 'HOLD_POLICY_DECISION'}
if($cfg.pgContainerId -cne '46af2e6fdd7be1a1b09ce641a7b311f99fb93c1b6ea201bd08edcc23d34d6179' -or $cfg.migrationSubject -cne '77f0295b9be1a4f6011415424b9ae071a6367c4e' -or $cfg.migrationSource -cne '153ebdba8f2955233ef0d23fcc6953469d77847e41af645f1d319e5035d67569' -or $cfg.migrationPhysical -cne 'a912055d60488910f0861efda98bb6eb71ce196dd3ab0f78b0daa38fb9a5a07b'){throw 'HOLD_MIGRATION_BINDING'}
$policyBefore=[IO.File]::ReadAllText($policyFile)
$configBefore=[IO.File]::ReadAllText($cfgFile)
foreach($f in @($policyFile+'.revision2.bak',$cfgFile+'.prewrite.bak',$policyFile+'.create.new',$cfgFile+'.create.new')){
 if(Test-Path -LiteralPath $f){throw 'HOLD_EXISTING_CREATE_TRANSITION'}
}
& (Join-Path $PSScriptRoot 'Read-DatabaseProof.ps1') -Stage After
$pg='geox-product-e2e01-postgres'
$oldPg=@(docker inspect geox-v1-postgres|ConvertFrom-Json)[0]
$admin=@($oldPg.Config.Env|Where-Object{$_ -like 'POSTGRES_USER=*'})
if($admin.Count -ne 1){throw 'HOLD_ADMIN_IDENTITY'}
$admin=$admin[0].Substring(14)
Remove-Variable oldPg
$sql="BEGIN READ ONLY; SELECT NOT EXISTS(SELECT 1 FROM public.field_index_v1 WHERE field_id='field_geox_e2e01_001') AND NOT EXISTS(SELECT 1 FROM public.field_polygon_v1 WHERE field_id='field_geox_e2e01_001') AND NOT EXISTS(SELECT 1 FROM public.facts WHERE fact_id='field_'||encode(sha256(convert_to('field_created_v1|tenant_geox_e2e01|field_geox_e2e01_001','UTF8')),'hex')) AND has_table_privilege('geox_runtime_v1','public.field_index_v1','SELECT') AND has_table_privilege('geox_runtime_v1','public.field_index_v1','INSERT') AND has_table_privilege('geox_runtime_v1','public.facts','SELECT') AND has_table_privilege('geox_runtime_v1','public.facts','INSERT'); ROLLBACK;"
$proof=@(docker exec $pg psql -X -w -qAt -U $admin -d landos -v ON_ERROR_STOP=1 -c $sql)
if($LASTEXITCODE -ne 0 -or $proof.Count -ne 1 -or $proof[0] -cne 't'){throw 'HOLD_CREATE_TARGET_OR_PUBLIC_ACL'}
Write-Host 'TARGET_ABSENT_AND_NATIVE_CREATE_ACL=PASS'

$gw=@(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue)
$api=@(Get-NetTCPConnection -LocalPort 14174 -State Listen -ErrorAction SilentlyContinue)
$mgr=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
if($gw.Count -ne 1 -or $api.Count -ne 1 -or $mgr.Count -ne 1 -or @($gw+$api+$mgr|Where-Object{$_.LocalAddress -cne '127.0.0.1'}).Count){throw 'HOLD_RUNTIME_LISTENERS'}
$g=Get-CimInstance Win32_Process -Filter "ProcessId=$($gw[0].OwningProcess)"
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($mgr[0].OwningProcess)"
if($g.Name -ne 'node.exe' -or $g.CommandLine -notmatch 'oidc-session-gateway-e2e01\.mjs' -or $p.Name -ne 'node.exe' -or $p.CommandLine -notmatch 'scripts[/\\]product[/\\]e2e01[/\\]manager-local\.mjs'){throw 'HOLD_PROCESS_IDENTITY'}
$Node=$p.ExecutablePath
if((& $Node --version) -notmatch '^v24\.'){throw 'HOLD_NODE24'}
$cert=New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($Ca)
if($cert.Thumbprint -cne '9DDB1DE78D7FFE64A78C8FF70AD48696F8569400'){throw 'HOLD_CA_IDENTITY'}
$old=@(docker inspect geox-v1-server | ConvertFrom-Json)[0]
if($old.State.Status -cne 'exited'){throw 'HOLD_OLD_SERVER'}
$urls=@($old.Config.Env|Where-Object{$_ -like 'GEOX_RUNTIME_DATABASE_URL=*'})
if($urls.Count -ne 1){throw 'HOLD_RUNTIME_CREDENTIAL'}
$u=[Uri]$urls[0].Substring('GEOX_RUNTIME_DATABASE_URL='.Length)
if($u.Scheme -notin @('postgres','postgresql') -or $u.Host -cne 'postgres' -or $u.Port -ne 5432 -or $u.AbsolutePath -cne '/landos' -or $u.UserInfo -notmatch '^geox_runtime_v1:.+' -or $u.Query -or $u.Fragment){throw 'HOLD_RUNTIME_CREDENTIAL_BINDING'}
$runtimeUrl=$u.Scheme+'://'+$u.UserInfo+'@127.0.0.1:15435/landos'
Remove-Variable old,urls,u
Push-Location $Repo
try{
 & $Node --test scripts/product/e2e01/contract.test.mjs
 if($LASTEXITCODE -ne 0){throw 'HOLD_TEST'}
 & $Node --check scripts/product/e2e01/manager-local.mjs
 if($LASTEXITCODE -ne 0){throw 'HOLD_MANAGER_SYNTAX'}
 $now=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
 if($now.Count -ne 1 -or $now[0].OwningProcess -ne $p.ProcessId){throw 'HOLD_MANAGER_PROCESS_CHANGED'}
 if([IO.File]::ReadAllText($policyFile) -cne $policyBefore -or [IO.File]::ReadAllText($cfgFile) -cne $configBefore){throw 'HOLD_LOCAL_POLICY_DRIFT'}
 Stop-Process -Id $p.ProcessId -ErrorAction Stop
 for($i=0;$i -lt 10;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Seconds 1
 }
 if(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue){throw 'HOLD_MANAGER_PORT_STILL_IN_USE'}
 # Startup remains fail-closed: PREWRITE + REVOKED until the new API is ready.
 $cfg.writeAdmitted=$true
 [IO.File]::WriteAllText($cfgFile+'.create.new',($cfg|ConvertTo-Json -Depth 4 -Compress),(New-Object Text.UTF8Encoding($false)))
 [IO.File]::Replace($cfgFile+'.create.new',$cfgFile,$cfgFile+'.prewrite.bak')

 $keys=@('GEOX_E2E01_CONFIG','GEOX_E2E01_DATABASE_URL','NODE_EXTRA_CA_CERTS')
 $backup=@{}
 try{
  foreach($k in $keys){$backup[$k]=[Environment]::GetEnvironmentVariable($k,'Process')}
  $env:GEOX_E2E01_CONFIG=$cfgFile
  $env:GEOX_E2E01_DATABASE_URL=$runtimeUrl
  $env:NODE_EXTRA_CA_CERTS=$Ca
  $cmd='Set-Location -LiteralPath ''{0}''; $Host.UI.RawUI.WindowTitle=''GEOX MANAGER BOUNDED CREATE - KEEP OPEN''; & ''{1}'' --import tsx ''scripts/product/e2e01/manager-local.mjs''; Write-Host (''MANAGER_EXIT=''+$LASTEXITCODE)' -f $Repo,$Node
  $enc=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  Start-Process powershell.exe -ArgumentList @('-NoProfile','-NoExit','-EncodedCommand',$enc)
 }finally{
  foreach($k in $backup.Keys){[Environment]::SetEnvironmentVariable($k,$backup[$k],'Process')}
  Remove-Variable runtimeUrl -ErrorAction SilentlyContinue
 }
 for($i=0;$i -lt 15;$i++){
  $status=curl.exe -s --noproxy '*' --connect-timeout 1 --max-time 2 -o NUL -w '%{http_code}' http://127.0.0.1:14175/api/v1/manager/fields
  if($LASTEXITCODE -eq 0 -and $status -ceq '401'){
   if([IO.File]::ReadAllText($policyFile) -cne $policyBefore){throw 'HOLD_REVOKED_POLICY_DRIFT'}
   $policy.phase='CREATE'
   $policy.create_status='ACTIVE'
   $policy.revision=3
   [IO.File]::WriteAllText($policyFile+'.create.new',($policy|ConvertTo-Json -Depth 4 -Compress),(New-Object Text.UTF8Encoding($false)))
   [IO.File]::Replace($policyFile+'.create.new',$policyFile,$policyFile+'.revision2.bak')
   Write-Host 'BOUNDED_CREATE_ADMITTED=PASS'
   Write-Host 'CREATE_TARGET=field_geox_e2e01_001'
   Write-Host 'FIELD_ACCESS_GRANTS=0'
   Write-Host 'OPEN=http://127.0.0.1:14173/manager'
   return
  }
  Start-Sleep -Seconds 1
 }
 throw 'HOLD_MANAGER_READINESS'
}finally{Pop-Location;Remove-Variable runtimeUrl -ErrorAction SilentlyContinue}
