$ErrorActionPreference = "Stop" # 任何错误直接终止脚本（保证 FAIL 可见）。

$scriptDir = $PSScriptRoot # 当前脚本所在目录（scripts/）。
if (-not $scriptDir) { throw "PSScriptRoot is empty" } # 防御：确保脚本目录可用。

$repoRoot = Split-Path -Parent $scriptDir # 仓库根目录（scripts 的上一级）。
if (-not $repoRoot) { throw "repoRoot is empty" } # 防御：确保仓库根目录可用。

$runner = Join-Path -Path $repoRoot -ChildPath "scripts\ACCEPTANCE_SERIES_ROUTE_WIRING_V0_RUNNER.cjs" # runner 路径。

Write-Host "[INFO] repoRoot=$repoRoot" # 打印仓库根目录。
Write-Host "[INFO] runner=$runner" # 打印 runner 路径。

if (!(Test-Path -Path $runner)) { throw "Runner not found: $runner" } # runner 必须存在。

node $runner # 执行 Node runner（静态检查）。

Write-Host "[PASS] ACCEPTANCE_SERIES_ROUTE_WIRING_V0" # 输出通过标记。
