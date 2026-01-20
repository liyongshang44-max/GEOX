# Judge 可重复验收闭环（正确性口径说明）

本文与 `scripts/judge_acceptance.ps1` 绑定，解释验收脚本中几个最容易产生争议的“口径”与其冻结来源。本文不引入任何 Judge 新语义，仅阐明脚本如何计算与断言。

## 1. expected_interval_ms 的来源（SSOT）

`expected_interval_ms` 必须且只能来自单一真值源（SSOT）：

- 文件：`config/judge/default.json`
- 路径：`time_coverage.expected_interval_ms`

脚本只读取该路径；数据侧的 `p50_dt_ms` 仅用于观测与对比，不用于推导 SSOT。

## 2. points_present 的定义（窗口内点数）

`points_present` 的计算口径固定为：

- 数据表：`public.raw_samples`
- 过滤：`sensor_id == <sensor_id>` 且 `ts_ms ∈ [startTs, endTs)`（左闭右开）
- 统计：`count(distinct ts_ms)`

该口径与“每分钟/每秒多指标同一时间戳”兼容：即便同一 `ts_ms` 下有多个 `metric`，也只计 1 个点。

## 3. expected_points / min_points 的定义（与 expected_interval_ms 绑定）

脚本将“窗口内应该看到多少个采样点”与 SSOT 绑定：

- `expected_points = floor(hours * 3600000 / expected_interval_ms)`
- `min_points = ceil(expected_points * 0.9)`（容忍 10% 边界裁剪/少量缺失）

冻结断言：

- 当 `points_present >= min_points` 时，Judge 输出的 `problem_states[*].uncertainty_sources[]` 不得包含 `SAMPLING_DENSITY`

## 4. metrics_present 必须完全匹配 10 个 metric

验收脚本锁定 CAF009 的“黄金路径”数据形态：窗口内 `public.raw_samples.metric` 的 distinct 集合必须严格等于以下 10 个值（缺任何一个即 FAIL）：

- soil_moisture_vwc_30cm
- soil_moisture_vwc_60cm
- soil_moisture_vwc_90cm
- soil_moisture_vwc_120cm
- soil_moisture_vwc_150cm
- soil_temp_c_30cm
- soil_temp_c_60cm
- soil_temp_c_90cm
- soil_temp_c_120cm
- soil_temp_c_150cm

这是一条“数据整齐度 + Judge 可复现”的联合验收。若未来要验收“缺测/NA 也可接受”的路径，应另起新的冻结版本，而不是修改本脚本的断言。

## 5. SAMPLING_DENSITY 的判定来源（唯一允许）

`SAMPLING_DENSITY` 的判定来源只允许来自：

- `problem_states[*].uncertainty_sources[]`

脚本不会读取 `note/summary/problem_type` 等字段来“猜测”采样密度问题，也不会做正则匹配。

## 6. facts_sample.txt 的抽样规则（去除顺序抖动）

为了避免 `input_fact_ids` 返回顺序的非确定性导致产物抖动，抽样规则固定为：

- 对 `input_fact_ids` 做字典序排序
- 取前 N=3
- 每行输出：`fact_id | occurred_at | record_json` 前 220 字符
