# GEOX GIS 实时轨迹 + 时间轴回放（2026-03-14）

## 本轮目标

把当前 GIS 从“刷新后看结果”升级成两个可验收模块：

1. `server WebSocket telemetry stream`
2. `web 订阅 field/device live stream`
3. `轨迹时间轴回放`

本轮仍然保持最小风险边界：

- 不改 telemetry ingest 主链路
- 不引入内部事件总线
- 继续以数据库 facts/projection 为事实来源
- 仅新增 field 级 live channel：`/ws/fields/:field_id/live?token=...`

## 后端实现

### 1. WebSocket live 通道

新增：

- `apps/server/src/routes/ws_telemetry_v1.ts`

行为：

- 通过原生 Node `upgrade` 处理 WebSocket 握手
- 按 `tenant_id + field_id` 建立订阅组
- 每 1 秒轮询一次该 field 当前绑定设备的新 geo telemetry / heartbeat
- 推送稳定事件结构：

```json
{
  "type": "device_geo_update_v1",
  "field_id": "field_demo",
  "device_id": "dev_demo_001",
  "ts_ms": 1773427003000,
  "geo": { "lat": 39.9081, "lon": 116.3971 },
  "metric": "gps",
  "value": "fix"
}
```

### 2. 轨迹时间轴回放接口

新增：

- `GET /api/v1/fields/:field_id/trajectory-series?from_ts_ms=...&to_ts_ms=...`

返回：

- 按设备分组的有序点序列
- 供前端本地时间轴播放使用

## 前端实现

### 1. 实时订阅

Field 详情页地图 Tab 打开后：

- 自动连接 `/ws/fields/:field_id/live?token=...`
- 收到 `device_geo_update_v1` 后：
  - 增量移动 marker
  - 增量追加 trajectory line

### 2. 时间轴回放

地图页新增：

- 实时 / 回放 模式切换
- 回放窗口（小时）
- 重载轨迹
- 播放 / 暂停
- 起点 / 终点
- 倍速（1x / 2x / 4x / 8x）
- 设备筛选
- 时间轴滑条

回放逻辑：

- 先加载窗口内全部点
- 本地按 `ts_ms` 推进当前播放时间
- 只渲染 `<= current_ts_ms` 的点和线段

## 最短验收

### 实时轨迹流

1. 打开某个已绑定设备的田块详情页
2. 切到“地图”Tab，保持在“实时轨迹”模式
3. 让设备再上报一条带 `payload.geo` 的 telemetry 或 heartbeat
4. 页面不刷新，marker 自动移动
5. 连续再上报 2~3 条 geo 点
6. 轨迹线自动延长

### 时间轴回放

1. 切到“时间轴回放”模式
2. 选择 24 小时窗口并点击“重载轨迹”
3. 拖动时间轴滑条，marker 应跳到对应时刻
4. 点击“播放”，轨迹应按时间推进
5. 切换倍速与设备筛选，不应报错

## 已知限制

- 当前 live auth 仍使用 query token，后续可收敛为短时 ws ticket
- 当前 live stream 采用 1 秒轮询 facts，不是最终高并发架构
- 当前 replay 仍基于字段详情页现有 SVG GIS 组件，尚未接入更强的 Leaflet/Canvas 图层能力
- Alerts heatmap 图层增强未在本轮实现，属于下一阶段
