# RAIN_IRRIGATION_FILTER_POLICY_V1

## 目标

防止系统把“降雨导致的土壤湿度上升”误判为“灌溉效果提升”，避免灌溉技能（irrigation skill）绩效被污染。

---

## 策略版本

- Policy ID: `rain_irrigation_filter_policy_v1`
- Version: `v1`
- Status: `active`

---

## 适用范围

本策略适用于以下场景的效果归因（performance attribution）：

- 作业类型为灌溉（`IRRIGATE` / `IRRIGATION`）
- 使用作业后土壤湿度变化（`soil_moisture delta`）评估技能表现
- 评估窗口内可获取天气/降雨事件（history 或 forecast 回填）

---

## 核心规则

**规则 R1（降雨过滤）**：

如果作业后 `soil_moisture` 上升窗口内存在**明显 rainfall event**，
则该次 `moisture delta` **不直接计入** irrigation skill performance。

即：

- `include_in_skill_performance = false`
- `exclusion_reason = RAIN_CONFOUNDED`

---

## 判定要素

在作业完成时间 `t_done` 之后定义湿度观测窗口：

- `window_start = t_done`
- `window_end = t_done + observation_window`

其中 `observation_window` 默认建议：`6h`（可配置）。

对该窗口进行天气事件检索：

- 来源：`GET /api/v1/weather/history?field_id=&from=&to=`
- 事件类型：`RAIN`（历史）优先；`UNKNOWN` 仅作弱证据

当满足以下任一条件时，认定为“明显 rainfall event”：

1. 窗口内累计 `rainfall_mm >= rain_significant_threshold_mm`（默认建议 `2.0mm`）；
2. 出现与湿度上升时间重叠的 `RAIN` 事件，且事件 `confidence >= confidence_threshold`（默认建议 `0.6`）；
3. 多个低强度降雨事件在窗口内累计达到阈值。

---

## 处置策略

当命中 R1：

1. 不将该次 `moisture delta` 直接作为灌溉技能正向效果样本；
2. 将该样本标记为 `RAIN_CONFOUNDED`，进入“待判定/需更多证据”集合；
3. 可选：若有流量计、阀门状态、施灌量回执等独立证据，再进行二次归因。

当未命中 R1：

- 按常规流程参与 irrigation skill performance 计算。

---

## 数据字段建议

为便于后续审计与解释，建议在评估结果中至少记录：

- `rain_filter_applied: boolean`
- `rainfall_mm_in_window: number | null`
- `rain_event_count: number`
- `rain_filter_reason: "RAIN_CONFOUNDED" | null`
- `rain_filter_policy_id: "rain_irrigation_filter_policy_v1"`

---

## 与天气接口契约关系

本策略依赖 P2-E1 定义的天气契约：

- `GET /api/v1/weather/history?field_id=&from=&to=`
- `GET /api/v1/weather/forecast?field_id=`

其中：

- 历史评估优先使用 `history`
- 预测信息用于提前抑制“即将降雨时段”的灌溉效果乐观估计

---

## 非目标（v1）

v1 不强制解决：

- 不同土壤类型的渗透滞后建模
- 微地块降雨空间差异（同 field 内局部对流）
- 降雨与灌溉叠加时的精细因果分解

以上留待后续版本（v2+）演进。
