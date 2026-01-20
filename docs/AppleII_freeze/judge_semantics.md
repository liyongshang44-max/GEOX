
Judge Semantics（裁判语义说明）

本文档是 GEOX Judge 的语义真值源（human-readable）。
任何实现、测试或配置都必须与本文档保持一致。

——————————————————

一、核心目标（What Judge Does）

Judge 的职责不是判断数据好坏，而是：

在给定时间窗口内，判断是否存在足够、可用、连续的证据来支持后续推断。

Judge 只回答一个问题：

证据是否充分（Sufficient）？

若否，返回 INSUFFICIENT_EVIDENCE
若是，进入后续规则（参考、冲突、推断等）

——————————————————

二、Evidence 类型与角色

Judge 只识别两类一等证据（first-class evidence）。

2.1 raw_sample_v1（原始观测）

表示某一时刻、某一传感器、某一指标的数值观测。

关键字段语义：

ts_ms：观测时间（毫秒）
metric：指标名（可能带深度后缀）
value：数值
quality：ok / suspect / bad
sensorId：传感器标识

2.2 marker_v1（语义标记）

表示对时间轴或证据含义的解释，而不是数值本身。

常见 marker kind 包括：

MISSING_VALUE
MAINTENANCE
CALIBRATION
EXCLUSION_WINDOW_ACTIVE
等

——————————————————

三、Metric 归一化规则（Base Metric）

3.1 为什么需要 Base Metric

现实设备中，一个逻辑指标可能对应多个物理深度或变体，例如 soil_moisture_vwc_30cm、soil_moisture_vwc_60cm 等。

在 Judge 的充分性判断阶段，关心的是是否存在该指标族（family）的证据，而不是具体深度。

3.2 归一化规则（冻结）

Judge 将以下 metric 统一视为同一 base metric：

soil_moisture_vwc
soil_moisture_vwc_任意后缀

统一为 soil_moisture_vwc

soil_temp_c
soil_temp_c_任意后缀

统一为 soil_temp_c

所有匹配逻辑在 SQL 层与内存层保持一致。

——————————————————

四、C-3 规则：Missing-Origin Raw 不等于 Evidence

4.1 定义

如果一个 raw_sample_v1 同时满足：

一，payload.quality 等于 bad
二，在同一 sensor、同一 metric、同一分钟存在 marker_v1，且 kind 为 MISSING_VALUE

则该 raw_sample 被定义为 Missing-Origin Raw（缺失来源样本）。

4.2 语义（非常重要）

Missing-Origin Raw 表示：

设备本应在此时产生数据，但源头缺失。

它的语义是“无证据”，而不是“坏证据”。

4.3 行为规则（冻结）

Missing-Origin Raw：

不计入 coverage
不参与 QC
不作为证据点
但仍然会出现在 input_fact_ids 中

注意：
raw 与 marker 都会进入 input_fact_ids，但该 raw 不会进入 samples 集合。

——————————————————

五、C-2 规则：Maintenance / Exclusion 的作用方式

5.1 核心原则

某些 marker 不是证据质量问题，而是时间轴不可用（time-axis exclusion）。

5.2 属于时间轴剔除的 marker kind

MAINTENANCE
CALIBRATION
DEVICE_OFFLINE
EXCLUSION_WINDOW_ACTIVE

5.3 行为规则（冻结）

当一个分钟 bucket 落入 exclusion window：

该分钟不计入 coverage 分母
不计入 gap 连续性
不影响 max_gap_ms
不参与 QC

Coverage 只在有效时间轴（effective timeline）上计算。

——————————————————

六、Coverage 的数学定义

6.1 时间离散化

设备假设为每分钟一个样本。
时间窗口被离散为 minute buckets。

6.2 有效分钟（Effective Minutes）

effective_minutes 等于：

窗口内所有分钟
减去被 exclusion marker 覆盖的分钟。

6.3 有效证据分钟（Valid Minutes）

一个分钟 bucket 被计为 valid，当且仅当：

存在至少一个 raw_sample_v1
该 raw_sample 非 missing-origin
该 raw_sample 的 quality 不等于 bad
该分钟不在 exclusion window 内

6.4 Coverage Ratio

coverage_ratio 等于：

valid_minutes 除以 effective_minutes。

——————————————————

七、max_gap_ms（连续性）

gap 只在 effective timeline 上计算。
exclusion window 会切断连续性。
连续缺失分钟数乘以 60000，得到 gap 毫秒值。

——————————————————

八、Sufficiency 判定（阶段 2）

在 coverage 判断之前，Judge 会先做样本数量判定。

8.1 Required Metrics

由配置给出，例如 soil_moisture_vwc、soil_temp_c。

8.2 判定规则

要求满足：

最小总样本数（min_total_samples）
每个 required base metric 的最小样本数（min_samples_per_required_metric）

未满足则直接返回 INSUFFICIENT_EVIDENCE。

——————————————————

九、input_fact_ids 的语义

input_fact_ids 表示：

Judge 在本次裁决中实际读取并考虑过的事实集合。

原则：

raw 与 marker 都可以进入
不因为被 C-2 或 C-3 排除而消失
顺序与内容必须可以通过 SQL 重现

——————————————————

十、重要设计结论（冻结）

Judge 不是数据清洗器。
Judge 不是质量打分器。

Judge 是证据可用性裁判（Evidence Availability Judge）。

——————————————————

十一、规则演进约束（非常重要）

未来新增任何规则，必须满足：

一，能够清楚说明它影响的是哪一个维度：
证据是否存在
时间轴是否可用
证据是否可信

二，不得同时影响多个维度。

三，必须能够被：
SQL 验证
SSOT 配置表达
文档解释清楚

否则不得进入 Judge Pipeline。

——————————————————

状态声明

截至当前版本，Judge Pipeline 在数据层面已闭合、可解释、可复现。

——————————————————