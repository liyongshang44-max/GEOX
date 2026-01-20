# 数据导入契约（v0）

适用范围：CAF003/CAF009 这类 `*.txt`（tab 分隔）观测数据文件，导入到 Postgres 的 `facts`（证据账本）并生成投影表 `raw_samples`/`markers`。

一、输入文件格式

1.1 文件编码

- UTF-8（推荐）。允许包含 CRLF / LF。导入时逐行处理，保留每一行原始文本作为证据。

1.2 表头（第一行）

必须包含：

- `Date`（例：`01/14/2026`）
- `Time`（例：`09:18` 或 `09:18:00`）
- `Location`（例：`CAF009`）

可选：任意数量的传感列，命名规则：

- 湿度体积含水率：`VW_30cm`, `VW_60cm`, `VW_90cm`, `VW_120cm`, `VW_150cm` …
- 温度：`T_30cm`, `T_60cm`, `T_90cm`, `T_120cm`, `T_150cm` …

1.3 数据行

- 每一行对应一个时间戳（通常为分钟或小时），一个 Location，若干 metric 列。
- 缺失值：`NA`（大小写不敏感）或空字符串视为缺失。

二、字段映射（facts / raw_samples / markers）

2.1 时间戳

- `ts_ms`：由 `Date + Time` 解析得到 UTC 时间的毫秒（按文件提供的时刻解析）。
- `occurred_at`：`ts_ms` 对应的 ISO 时间字符串（`YYYY-MM-DDTHH:MM:SSZ`）。

2.2 sensor / group / project

- `sensor_id`：来自 `Location`。
- `project_id`：命令行参数 `--project` / `--projectId`。
- `group_id`：命令行参数 `--group` / `--groupId`。

2.3 metric 名称映射

- `VW_<depth>cm` → `soil_moisture_vwc_<depth>cm`
- `T_<depth>cm` → `soil_temp_c_<depth>cm`

2.4 facts.record_json（证据约束）

- `facts.record_json` 必须是 TEXT，存入时以 JSON 字符串形式写入。
- 每条写入都必须包含：
  - `type: "raw_sample_v1"` 或 `type: "marker_v1"`
  - `occurred_at`（ISO）
  - `entity: {project_id, group_id, sensor_id}`
  - `payload.sensorId`, `payload.metric`, `payload.ts_ms`
  - `payload.source_line_text`: 原始输入行文本（不含换行）
  - `payload.source_line_no`: 原始行号（从 2 开始）
  - `payload.source_file`: 源文件路径（脚本接收到的 `--file`）

三、缺失处理

3.1 缺失值（NA / 空）

- 默认不写 `raw_sample_v1`。
- 若启用 `--writeMarkers=1`（或 `--write-markers`）：对每个缺失的 metric 写入：
  - `marker_v1`（kind=`MISSING_VALUE`）到 facts
  - 同步写入 `markers` 投影表

3.2 非数值

- 无法解析为有限数的值视为缺失，规则同 3.1。

四、去重键与幂等

4.1 raw_sample_v1

- 事实 ID（`fact_id`）必须是确定性的，建议键：
  - `projectId | groupId | sensorId(Location) | metric | ts_ms`
- 同一键重复导入必须幂等（`ON CONFLICT DO NOTHING`）。

4.2 marker_v1（缺失）

- 事实 ID（`fact_id`）确定性键：
  - `projectId | groupId | sensorId | metric | ts_ms | MISSING_VALUE`

说明：你提出的“Location + occurred_at”是最小锚点；在 v0 里，为避免同一时刻多 metric 冲突，我们将 metric 作为扩展维度纳入去重键。

五、最小验收指标

- 行数：导入的 raw_samples 行数与（有效时间戳数 × metric 数）一致（或按缺失扣减）。
- 时间范围：raw_samples.min(ts_ms)/max(ts_ms) 与文件覆盖一致。
- 缺失率：按 metric 统计 `n_null`，并对 marker 缺失记录计数。
- 覆盖窗口：按 sensor_id 分段识别长连续窗口（例如 dt <= 2×期望采样间隔）。
