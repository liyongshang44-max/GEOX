
⸻

GEOX 项目 · 开发与运行说明

⸻

一、项目状态说明（重要）

当前仓库处于 可运行、可复现、可持续开发 状态：
	•	✅ 后端（Server / Judge）可通过 Docker 启动
	•	✅ 前端（Web）可通过 Vite 启动
	•	✅ 数据库统一使用 Postgres
	•	✅ pnpm workspace 已稳定
	•	✅ 依赖 / 构建产物 / 运行态数据 均不进入仓库

当前设计中：
	•	Groups 的事实来源为 Postgres 表 sensor_groups / sensor_group_members
	•	Groups / Judge / UI 的读取路径已经明确
	•	已彻底移除对 SQLite / Monitor 旧逻辑的依赖

⸻

二、环境要求

必须组件
	•	Node.js ≥ 20
	•	Docker Desktop（包含 docker compose）
	•	pnpm（通过 corepack）
	•	Windows PowerShell（本文示例基于 PowerShell）

版本确认

node -v
docker -v
docker compose version

⸻

三、仓库约定（非常重要）

本仓库 不包含 以下内容（这是正确状态）：
	•	node_modules
	•	dist / build
	•	*.sqlite / *.wal / *.shm
	•	任何运行期生成的数据

这些内容 必须在本地或容器内生成，而不是提交或打包。

⸻

四、初始化与依赖安装

1. 启用 pnpm

corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v

2. 安装 workspace 依赖

说明：
	•	使用 pnpm-workspace.yaml
	•	@geox/* 包通过 workspace link
	•	禁止使用 npm / yarn

⸻

五、启动后端（Postgres + Server）

1. 启动服务

docker compose up --build server

首次启动会：
	•	创建 Postgres 数据卷
	•	在容器内执行 pnpm install
	•	启动 @geox/server（tsx watch）

成功标志（示例）：

Server listening on http://0.0.0.0:3000

⸻

六、数据库初始化（Groups）

从 v1.19 起，Groups 的稳定事实来源为：
	•	sensor_groups
	•	sensor_group_members

这些表会在 docker compose 首次启动 Postgres 时，由 docker/postgres/init/ 自动创建（无需手动建表）。

可选：插入一个最小 group（仅用于 UI 下拉/手动测试）

```powershell
docker exec -it geox-postgres psql -U landos -d landos -c "
INSERT INTO sensor_groups (group_id, project_id, created_at)
VALUES ('CAF009', 'P_DEFAULT', NOW())
ON CONFLICT (group_id) DO NOTHING;
"
```

可选：将传感器绑定到 group（当你需要按 group 过滤/展示 sensor 列表时）

```powershell
docker exec -it geox-postgres psql -U landos -d landos -c "
INSERT INTO sensor_group_members (group_id, sensor_id)
VALUES ('CAF009','CAF009')
ON CONFLICT DO NOTHING;
"
```

⸻

七、启动前端（Web）

新开一个 PowerShell 窗口：

pnpm --filter @geox/web dev


⸻

八、Groups 接口设计说明（正式）

接口
	GET /api/groups?projectId=P_DEFAULT[&sensorId=...]

数据来源（冻结口径）
	•	sensor_groups + sensor_group_members（稳定投影表，不从 facts 推导）

返回结构（以 contracts/SensorGroupV1 为准；字段命名与前端一致）

```json
{
  "groups": [
    {
      "groupId": "CAF009",
      "subjectRef": { "projectId": "P_DEFAULT" },
      "displayName": "CAF009",
      "sensors": ["CAF009"],
      "createdAt": 1700000000000
    }
  ]
}
```

设计原则
	•	Groups 是显式配置对象（可审计、可复现）
	•	UI/Judge 以 group 作为稳定输入，但不要求 group 必须存在才能导入 raw_samples（导入仅依赖 sensor_id）

⸻

九、Judge 规则与语义（重要）

9.1 单一真值源（SSOT）

Judge 的所有规则 只认一个地方：
	•	config/judge/default.json ← 唯一规则真值源
	•	apps/judge/src/ssot/* ← 配置加载与校验

任何 pipeline / reader / evidence 逻辑，都必须是对该 JSON 的直接实现。

⸻

9.2 Evidence 语义（已定型）

C-2：Maintenance / Calibration
	•	MAINTENANCE / CALIBRATION / DEVICE_OFFLINE 等 marker
	•	不会触发 QC 降级
	•	而是作为 时间轴排除（time-axis exclusion）
	•	Coverage 在 剔除这些分钟后的有效时间轴 上计算

C-3：Missing-origin Raw Sample
Raw sample 被视为 “missing-origin（无证据）” 当且仅当：
	•	payload.quality === "bad"
	•	且同一 (sensor, metric, minute) 存在
marker_v1(kind="MISSING_VALUE")

Missing-origin raw：
	•	❌ 不计入 coverage
	•	❌ 不参与 QC
	•	❌ 不是“坏证据”
	•	✅ 表示“该分钟无观测”

实现位置：
	•	apps/judge/src/evidence.ts

⸻

9.3 Metric 归一化规则（关键）

Judge 只基于 base metric 判定规则：

示例：
	•	soil_moisture_vwc_30cm
	•	soil_moisture_vwc_60cm
→ base metric：soil_moisture_vwc

匹配规则：
	•	精确匹配 base
	•	或前缀匹配：base + "_*"

该规则在两层同时实现：
	•	SQL（AppleIReader）
	•	内存（evidence.ts）

⸻

十、Judge 使用说明

调用接口 POST /api/judge/run

官方可重复验收入口（冻结 v1）
	•	scripts/judge_acceptance.ps1

PowerShell 示例（注意：endTs 不要用“当前时间”，应取 raw_samples 的 max(ts_ms) 以避免 NA tail）

$endTs   = 0  # TODO: set to max(raw_samples.ts_ms)
$startTs = $endTs - 30*60*1000

Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/judge/run" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{
    subjectRef = @{
      projectId = "P_DEFAULT"
      groupId   = "G_CAF"
    }
    scale  = "group"
    window = @{
      startTs = $startTs
      endTs   = $endTs
    }
  } | ConvertTo-Json -Depth 10)

正常返回标志
	•	有 run_id
	•	input_fact_ids 非空
	•	problem_states 有值

常见结果
	•	INSUFFICIENT_EVIDENCE
→ 时间覆盖 / 样本密度不足（预期行为）

⸻

十一、工程约束与注意事项

必须遵守
	•	使用 pnpm workspace
	•	Server / Judge 只使用 Postgres
	•	node_modules 仅存在于本地或 Docker volume

明确禁止
	•	提交 node_modules
	•	提交 dist
	•	使用 docker compose down -v（会清空数据库）

⸻

十二、项目结构概览

GEOX/
├─ apps/
│  ├─ server/
│  ├─ web/
│  └─ judge/
├─ packages/
│  ├─ contracts/
│  └─ guardrails/
├─ docker/
│  └─ postgres/init/
├─ config/
│  └─ judge/default.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ docker-compose.yml
└─ README.md

⸻

十三、当前阶段结论
	•	基础设施：稳定
	•	依赖体系：清晰
	•	数据来源：明确
	•	Groups / Judge / UI：已完成对齐
	•	Judge 规则语义：已定型并可复现

该仓库可作为 后续功能演进的基线版本。

⸻

十四、推荐“一键清理命令”（PowerShell）

在 仓库根目录 执行

# 关闭可能占用 node_modules 的进程
taskkill /F /IM node.exe 2>$null

# 清理依赖 / 构建 / 运行态
Remove-Item -Recurse -Force `
  node_modules, `
  .pnpm-store, `
  apps\*\node_modules, `
  packages\*\node_modules, `
  apps\*\dist, `
  packages\*\dist, `
  apps\server\data, `
  apps\server\media, `
  apps\server\apps\judge\data, `
  logs `
  -ErrorAction SilentlyContinue

# 清理 sqlite 文件
Get-ChildItem -Recurse -Include *.sqlite,*.sqlite-wal,*.sqlite-shm |
  Remove-Item -Force -ErrorAction SilentlyContinue


打包前自检（30 秒）

确认没有 node_modules

Test-Path node_modules
返回必须false

确认体积在合理范围

Get-ChildItem apps,packages -Directory | % {
  [pscustomobject]@{
    Path = $_.FullName
    MB   = [math]::Round(
      (Get-ChildItem $_.FullName -Recurse -Force |
       Measure-Object Length -Sum).Sum / 1MB, 2)
  }
} | Sort-Object MB -Descending

## Judge 可重复验收闭环（冻结版 v1）

官方验收入口是 PowerShell 脚本：`scripts/judge_acceptance.ps1`。本脚本不修改任何 Judge 配置，不引入新语义，只固化一条“CAF009 最近 1 小时”演示链路，并输出可审计产物。

前置条件（固定）
- 已通过 docker compose 启动 server + postgres，并且 `http://127.0.0.1:3000` 可访问（验收脚本会以 `POST /api/judge/run` 作为最终可达性检查）。
- Postgres 容器名固定为 `geox-postgres`，脚本通过 `docker exec ... psql -U landos -d landos` 访问数据库
- SSOT 固定为 `config/judge/default.json`，脚本只读取 `time_coverage.expected_interval_ms`

运行
```powershell
# 仓库根目录
.\scripts\judge_acceptance.ps1
```

可选参数（冻结）
```powershell
.\scripts\judge_acceptance.ps1 -sensor_id CAF009 -hours 1
```

输出目录（冻结命名）
- `acceptance/caf009_1h_YYYYMMDDTHHMMSSZ/`（UTC 时间戳）
- 目录内产物：
  - `run.json`：Judge 原始返回（保存为原始 JSON 文本，不做重排）
  - `summary.json`：验收摘要（顶层字段固定：run_id/determinism_hash/effective_config_hash/groupId/hours/expected_interval_ms/points_present/expected_points/metrics_present/problem_types/uncertainty_sources/ao_sense_kinds/ao_sense_focus）
  - `window.json`：窗口参数与点数口径（顶层字段固定：startTs/endTs/hours/expected_interval_ms/expected_points/min_points_required/points_present/metrics_present）
  - `facts_sample.txt`：抽样 facts（N=3；按 input_fact_ids 字典序排序取前 3；head=220 字符）
  - `README.txt`：机器生成（PASS/FAIL 与关键口径）

正确性口径
- 见 `docs/judge_correctness.md`

## Web 前端：Judge Run 页面（运行参数输入器）

`apps/web/src/views/JudgeRunPage.tsx` 仅作为“运行参数输入器”，不具备配置能力，不写入 SSOT，也不会修改 `config/judge/default.json`。

保留字段（冻结）
- projectId：映射到 `POST /api/judge/run` 的 `subjectRef.projectId`
- groupId：映射到 `POST /api/judge/run` 的 `subjectRef.groupId`
- window_days：映射为“从当前时间回溯 N 天”的窗口（startTs/endTs 由前端计算）
- dryRun：映射到请求体 `dryRun`（若后端忽略也允许；前端只负责传递）

固定行为（冻结）
- scale 固定为 `group`