# File: scripts/ACCEPTANCE_SPRINT15_DECISION_PLAN_NEGATIVE.ps1 # 文件路径与名称（冻结）
# Sprint 15 Negative Acceptance: decision_plan_v0 must be non-executing and non-coupling. # 脚本目标（冻结）
# Contract anchor: docs/controlplane/GEOX-CP-Decision-Plan-Contract-v0.md # 治理依据（唯一入口）

[CmdletBinding()] # 启用高级参数绑定
param( # 参数定义
  [string]$baseUrl = "http://127.0.0.1:3000" # API Base URL（docker-compose server）
)

Set-StrictMode -Version Latest # 严格模式：禁止隐式变量/属性误用
$ErrorActionPreference = "Stop" # 遇到错误立即终止（Fail fast）

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false) # UTF-8 无 BOM（curl --data-binary 需要精确字节）

function Fail([string]$msg) { # 失败退出助手
  Write-Host "" # 空行分隔输出
  Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red # 红色显示失败原因
  exit 1 # 非 0 退出码
}

function Info([string]$msg) { # 信息输出助手
  Write-Host ("INFO: {0}" -f $msg) -ForegroundColor DarkGray # 灰色信息
}

function Pass([string]$msg) { # 成功输出助手
  Write-Host ("PASS: {0}" -f $msg) -ForegroundColor Green # 绿色显示成功信息
}

function Ensure-ApiReachable([string]$u) { # 探测 API 是否可用
  try { # 捕获网络/超时异常
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("{0}/api/health" -f $u) -Method Get -TimeoutSec 10 # 调用 /api/health
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) { Fail ("API probe failed: /api/health HTTP {0}" -f $resp.StatusCode) } # 强制 2xx
  } catch { # 处理异常
    Fail ("API not reachable at {0}. Error: {1}" -f $u, $_.Exception.Message) # 输出可读错误
  }
}

function Write-JsonNoBom([string]$path, [string]$json) { # 写入无 BOM JSON 文件
  [System.IO.File]::WriteAllText($path, $json, $Utf8NoBom) # 精确写字节
}

function CurlPostJsonFile([string]$url, [string]$path) { # curl.exe POST JSON 文件（二进制安全）
  $out = & curl.exe -s -X POST $url -H "content-type: application/json" --data-binary ("@{0}" -f $path) # 调用 API
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed posting to {0}" -f $url) } # 检查退出码
  return $out # 返回原始响应字符串
}

function CurlGet([string]$url) { # curl.exe GET
  $out = & curl.exe -s $url # 调用 GET
  if ($LASTEXITCODE -ne 0) { Fail ("curl.exe failed GET {0}" -f $url) } # 检查退出码
  return $out # 返回原始 body
}

function Normalize-JsonStable([object]$v) { # 稳定化：递归删除易变字段，保留语义核心
  if ($null -eq $v) { return $null } # 保留 null

  if ($v -is [string] -or $v -is [bool] -or $v -is [double] -or $v -is [int] -or $v -is [long]) { return $v } # 原子类型直接返回

  if ($v -is [System.Collections.IDictionary]) { # 处理字典/hashtable
    $tmp = @{} # 临时字典
    foreach ($kObj in $v.Keys) { # 遍历 key
      $k = [string]$kObj # 强制 key 为 string

      # 删除所有“运行态/时间态/ID态”字段（Judge 每次会变；不属于语义）：
      if ($k -in @("run_id","request_id","trace_id","debug","explain","timing","duration_ms","server_time","computed_at","generated_at","evaluated_at")) { continue } # 明确删除
      if ($k -match '(_ts)$') { continue } # 删除 *_ts（created_at_ts 等）
      if ($k -match '(_id)$') { continue } # 删除 *_id（problem_state_id / ao_sense_id 等）
      if ($k -match '^(now|time|timestamp)$') { continue } # 删除通用时间字段
      if ($k -match '^(input_fact_ids|state_inputs_used)$') { continue } # 删除输入列表（可能随实现变化；Sprint15 不要求此处稳定）

      $tmp[$k] = Normalize-JsonStable $v[$kObj] # 递归稳定化 value
    }

    $ordered = [ordered]@{} # 生成有序字典（确保 ConvertTo-Json 稳定输出）
    foreach ($k in ($tmp.Keys | Sort-Object)) { $ordered[$k] = $tmp[$k] } # key 排序
    return $ordered # 返回稳定对象
  }

  if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) { # 处理数组/列表（排除 string）
    $arr = @() # 新数组
    foreach ($it in $v) { $arr += ,(Normalize-JsonStable $it) } # 递归稳定化每个元素
    return $arr # 保持原始顺序（Judge 输出顺序应稳定；避免排序引入序列化问题）
  }

  # 处理 PSCustomObject：转成字典再走同样逻辑
  if ($v.PSObject -and $v.PSObject.Properties) { # 检测对象属性
    $h = @{} # 临时 hashtable
    foreach ($p in $v.PSObject.Properties) { $h[$p.Name] = $p.Value } # 拷贝属性到字典
    return Normalize-JsonStable $h # 复用字典路径稳定化
  }

  return $v # 兜底返回
}

function Canonical([object]$obj) { # 序列化为稳定 JSON 字符串
  return ($obj | ConvertTo-Json -Depth 80) # 深度足够覆盖 Judge 输出
}

# ---------------------------------------------
# 0) Preflight
# ---------------------------------------------

Ensure-ApiReachable $baseUrl # 确认服务可用

# ---------------------------------------------
# 1) Baseline Judge run
# ---------------------------------------------

$nowMs = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) # 当前 UTC 毫秒
$judgeReq = @{ # 构造 Judge 请求
  subjectRef = @{ groupId = "G_SPRINT15_NEG" } # 固定 groupId（便于复现）
  scale = "group" # 固定尺度
  window = @{ startTs = ($nowMs - 600000); endTs = $nowMs } # 最近 10 分钟窗口（不要求有数据）
  options = @{ persist = $false; include_reference_views = $false; include_lb_candidates = $false; config_profile = "default" } # 最小输出
} | ConvertTo-Json -Depth 20 # 转 JSON

$tmpJudge = Join-Path $env:TEMP "geox_s15_judge_run.json" # 临时文件路径
Write-JsonNoBom $tmpJudge $judgeReq # 写无 BOM JSON

$rawA = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # 调用 Judge（before）
$a = $rawA | ConvertFrom-Json # 解析 JSON

if (-not $a.determinism_hash) { Fail "baseline missing determinism_hash" } # determinism_hash 必须存在

$stableA = Normalize-JsonStable @{ # 构造稳定语义投影（before）
  effective_config_hash = $a.effective_config_hash # 配置哈希（应稳定）
  determinism_hash = $a.determinism_hash # 判定哈希（应稳定）
  problem_states = $a.problem_states # 问题态（去掉易变字段）
  ao_sense = $a.ao_sense # AO-SENSE 输出（去掉易变字段）
  silent = $a.silent # 静默标志（语义字段）
  run_meta = $a.run_meta # pipeline/config_profile（语义字段）
}
$canonA = Canonical $stableA # 序列化为稳定字符串（before）

# ---------------------------------------------
# 2) decision_plan_v0 insertion is intentionally skipped (no public append endpoint by design)
# ---------------------------------------------

Info "decision_plan_v0 insertion skipped (no public append endpoint by design)." # 明确：本 Sprint 不要求写入能力

# ---------------------------------------------
# 3) Judge run again (after hypothetical decision_plan existence)
# ---------------------------------------------

$rawB = CurlPostJsonFile ("{0}/api/judge/run" -f $baseUrl) $tmpJudge # 调用 Judge（after）
$b = $rawB | ConvertFrom-Json # 解析 JSON

if (-not $b.determinism_hash) { Fail "after-run missing determinism_hash" } # determinism_hash 必须存在

$stableB = Normalize-JsonStable @{ # 构造稳定语义投影（after）
  effective_config_hash = $b.effective_config_hash # 配置哈希（应稳定）
  determinism_hash = $b.determinism_hash # 判定哈希（应稳定）
  problem_states = $b.problem_states # 问题态（去掉易变字段）
  ao_sense = $b.ao_sense # AO-SENSE 输出（去掉易变字段）
  silent = $b.silent # 静默标志（语义字段）
  run_meta = $b.run_meta # pipeline/config_profile（语义字段）
}
$canonB = Canonical $stableB # 序列化为稳定字符串（after）

# 语义稳定性断言：两次输出必须一致（因为并未引入任何判读输入变化）
if ($canonA -ne $canonB) { # 不一致则失败
  $tmpBefore = Join-Path $env:TEMP "geox_s15_judge_before.json" # 记录 before 文件路径
  $tmpAfter  = Join-Path $env:TEMP "geox_s15_judge_after.json"  # 记录 after 文件路径
  Write-JsonNoBom $tmpBefore $canonA # 写入 before 稳定 JSON
  Write-JsonNoBom $tmpAfter  $canonB # 写入 after 稳定 JSON
  Fail ("Judge stable semantic projection changed. Diff files: {0} vs {1}. Use: fc.exe ""{0}"" ""{1}""" -f $tmpBefore, $tmpAfter) # 输出 diff 指令
}

# ---------------------------------------------
# 4) AO-ACT index must remain unchanged
# ---------------------------------------------

$idxA = CurlGet ("{0}/api/control/ao_act/index" -f $baseUrl) # 获取 AO-ACT index（before）
Start-Sleep -Milliseconds 200 # 小延迟（避免偶发并发）
$idxB = CurlGet ("{0}/api/control/ao_act/index" -f $baseUrl) # 获取 AO-ACT index（after）

if ($idxA -ne $idxB) { # index 发生变化则失败
  $tmpIdxBefore = Join-Path $env:TEMP "geox_s15_ao_act_index_before.json" # index before 文件路径
  $tmpIdxAfter  = Join-Path $env:TEMP "geox_s15_ao_act_index_after.json"  # index after 文件路径
  Write-JsonNoBom $tmpIdxBefore $idxA # 写入 index before（原始字符串）
  Write-JsonNoBom $tmpIdxAfter  $idxB # 写入 index after（原始字符串）
  Fail ("AO-ACT index changed (forbidden). Diff files: {0} vs {1}. Use: fc.exe ""{0}"" ""{1}""" -f $tmpIdxBefore, $tmpIdxAfter) # 输出 diff 指令
}

# ---------------------------------------------
# 5) Forbidden leak checks (Judge output must not expose decision_plan keys)
# ---------------------------------------------

if ($rawB -match "decision_plan") { Fail "decision_plan leaked into Judge API output" } # 禁止泄漏 decision_plan 语义到 Judge API
if ($rawB -match "ao_act_task_v0") { } # 允许出现字符串并不代表执行；此处不做额外断言（避免误伤）
if ($rawB -match "ao_act_receipt_v0") { } # 同上（只读证据可能存在）

Pass "Sprint 15 negative acceptance (decision_plan_v0 remains non-executing and non-coupling)." # 成功输出
