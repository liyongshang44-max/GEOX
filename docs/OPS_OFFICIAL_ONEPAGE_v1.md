# GEOX v1.19 · 导入数据与 Judge 验收（官方一页手册）

本页目标：在一台新机器上，从“空环境”到“CAF009 / 1h 的冻结验收 PASS/FAIL 产物落盘”。

一、启动后端（Postgres + Server）

1) 进入仓库根目录（含 docker-compose.yml），启动：

```powershell
docker compose up --build server
```

2) 成功标志（示例）：
- Server 日志出现 `Server listening on http://0.0.0.0:3000`
- 健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

二、数据库 bootstrap（无需手动建表）

本仓库已将 DB bootstrap 固化在 `docker/postgres/init/`。首次启动 Postgres 会自动创建：
- facts（append-only ledger）
- raw_samples（append-only projection）
- markers（append-only projection）
- sensor_groups / sensor_group_members（显式配置组）
- facts_replay_v1（replay 视图）

校验（可选）：

```powershell
docker exec -it geox-postgres psql -U landos -d landos -c "\dt"
```

三、导入 CAF009 数据（写入 facts + raw_samples + markers）

1) 准备 CAF009 的 `*.txt` 数据文件（tab 分隔 TSV），字段契约见：`docs/data_import_contract_v0.md`。

2) 在本机 PowerShell 设置 DB 连接：

```powershell
$env:DATABASE_URL = "postgres://landos:landos_pwd@127.0.0.1:5432/landos"
```

3) 执行导入（推荐开启 raw_samples/markers 投影）：

```powershell
pnpm exec ts-node .\scripts\loadfact.ts --file .\path\to\CAF009.txt --projectId P_DEFAULT --groupId CAF009 --writeRawSamples 1 --writeMarkers 1
```

4) 导入质量快速检查（可选）：

```powershell
docker exec -i geox-postgres psql -U landos -d landos -f sql/caf_import_acceptance.sql
```

四、（可选）配置 group 与 member（仅影响 UI 选择，不影响 Judge 验收）

系统的 Groups 冻结事实来源为：`sensor_groups + sensor_group_members`（不再使用 `public.groups`）。

```powershell
docker exec -it geox-postgres psql -U landos -d landos -c "
INSERT INTO sensor_groups (group_id, project_id, created_at)
VALUES ('CAF009', 'P_DEFAULT', NOW())
ON CONFLICT (group_id) DO NOTHING;

INSERT INTO sensor_group_members (group_id, sensor_id)
VALUES ('CAF009','CAF009')
ON CONFLICT DO NOTHING;
"
```

五、运行 Judge（冻结验收入口）

1) 运行冻结脚本（仅 CAF009 / 1h）：

```powershell
.\scripts\judge_acceptance.ps1
```

2) 产物目录（自动创建）：
- `acceptance/caf009_1h_YYYYMMDDTHHMMSSZ/`
  - `run.json`（原始 HTTP 返回）
  - `summary.json`（扁平摘要）
  - `window.json`（窗口与 maxTs）
  - `facts_sample.txt`（facts 抽样）
  - `README.txt`（PASS/FAIL）

六、常见失败定位（只给“验收定位”，不改 Judge 逻辑）

- FAIL: `raw_samples has no data for sensor_id=CAF009`
  - 说明：导入时未写 raw_samples，或导入的 sensor_id 不是 CAF009。
  - 处理：重跑导入并确保 `--writeRawSamples 1`，并确认文件 Location/override 映射为 CAF009。

- API probe 失败：`GET /api/groups` 非 2xx
  - 说明：server 未启动或 DB schema 未就绪（缺表会导致 500）。
  - 处理：确认 docker compose server 正常；`docker/postgres/init/` 是否已执行（新卷）。
