# GEOX GIS 告警热力图升级（2026-03-14）

## 目标

在已完成的实时轨迹流与时间轴回放基础上，补上第三阶段：把田块页里的告警热力层升级成可筛选、可重载、可切图层的真正热力图视图。

本轮仍坚持最小闭环：
- 不改 telemetry ingest 主链路
- 不改 alert_event_index_v1 现有投影结构
- 不引入第三方地图依赖
- 直接基于现有字段详情页 + SVG GIS renderer 完成热力图能力

## 后端新增

### 1. 新接口

`GET /api/v1/fields/:field_id/alert-heat`

支持参数：
- `from_ts_ms`
- `to_ts_ms`
- `metric`
- `object_type` = `ALL | FIELD | DEVICE`
- `precision` = 2..6

返回：
- `points`: 按空间桶聚合后的热力点
- `heat_geojson`: 前端直接可渲染的 GeoJSON

### 2. 聚合逻辑

- FIELD 告警：回落到 field polygon centroid
- DEVICE 告警：使用当前设备最新 geo marker
- 多个点按 `precision` 指定的小数位经纬度做 bucket 聚合
- 当前权重使用 `count`（告警次数）

## 前端升级

### 1. 地图页新增热力图控制

- 时间窗口：24h / 7d / 30d
- metric 文本筛选
- 对象类型筛选：ALL / FIELD / DEVICE
- 聚合精度切换
- 重载热力按钮

### 2. 图层开关

- 地块边界
- 实时设备
- 历史轨迹
- 告警热力

### 3. GIS 渲染增强

热力点由单一红圈改成三层渲染：
- 外层模糊 halo
- 中层橙红扩散圈
- 内层高强度核心点

这样在不引入 Leaflet heat layer 的前提下，也能明显体现空间密度差异。

## 最短验收

1. 打开某个 field 详情页，切到“地图”。
2. 保证该 field 或其绑定 device 在最近窗口内已有 alert_event_index_v1 数据。
3. 点击“重载热力”。
4. 地图出现热力斑块，告警越集中区域越深。
5. 切换 `metric` 后重新加载，热力分布发生变化。
6. 切换 `FIELD / DEVICE` 后热力重新计算。
7. 关闭“告警热力”图层后，地图不再显示热力斑块。
8. 空窗口下显示“当前窗口无告警热力数据”，页面不报错。

## 已知约束

- DEVICE 告警当前使用最新 geo marker，不是告警触发瞬间的历史坐标。
- 热力权重当前为 `count`，还没有 severity 加权。
- 现阶段仍使用 SVG 自绘，不是 Leaflet/canvas 真正像素级 heat layer。

## 下一轮建议

1. 若要进一步逼近 John Deere 风格，可把 GIS renderer 升到 Leaflet + canvas heat layer。
2. 若要提高时空准确度，需要在 alert_event_index_v1 或事实里记录告警触发时的 geo 快照。
3. 可把热力窗口和时间轴回放联动，形成统一时间控制面板。
