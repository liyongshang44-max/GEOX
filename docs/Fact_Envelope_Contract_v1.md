# GEOX Contract v1 (事实协议层)

> 本文是 **协议**，不是建议。实现若与本文冲突，以本文为准。

## 1. RawSample v1（append-only）

RawSample 是系统的“事实原子”。一旦写入，不允许 update/delete。

### JSON 结构

```json
{
  "ts": 1734307200000,
  "sensorId": "soil_node_001",
  "groupId": "plotA_group1",
  "metric": "soil_ec_ds_m",
  "value": 1.2,
  "unit": "dS/m",
  "quality": "ok",
  "source": "device"
}
```

### 字段说明（只读解释）

- `ts`: 采样时间（Unix ms）
- `sensorId`: 物理传感器/通道标识
- `groupId`: 点位组（可选；用于阵列/对照）
- `metric`: 指标名（字符串；v1 不强制闭集）
- `value`: 数值（finite number）
- `unit`: 单位（可选，但 **EC 必须提供且冻结为 dS/m**）
- `quality`: `unknown|ok|suspect|bad`（可选；只做标记不做修正）
- `source`: `device|gateway|import|sim`（可选）

### 单位冻结（强约束）

- 当 `metric` 属于土壤电导类（例如：`soil_ec_ds_m` / `soil_ec_bulk` / `soil_ec`），`unit` **必须为** `dS/m`。
- 禁止在协议层出现 `mS/cm` / `µS/cm` 等其他 EC 单位（避免歧义）。

## 2. SeriesResponse v1（回放）

后端只读查询返回结构固定：

```json
{
  "range": { "startTs": 0, "endTs": 0, "maxPoints": 2000 },
  "samples": [],
  "gaps": [],
  "overlays": []
}
```

- `samples`: RawSample 原样序列（允许降采样，但不得插值、不得伪造）
- `gaps`: 断点段（诚实表达“没有数据”）
- `overlays`: 覆盖层（只允许“候选/标记”，不允许建议/结论）
