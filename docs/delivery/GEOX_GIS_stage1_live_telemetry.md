# GEOX GIS Stage 1 · MQTT → WebSocket 实时轨迹流

## 本轮目标

把当前田块地图从“刷新后看结果”升级成“设备上报后地图自动更新”。

本轮不引入新的消息总线，也不改 telemetry-ingest 主链路；继续保持：

- MQTT / ingest 正常写入 facts
- server 侧轮询 field 绑定设备的最新 geo telemetry
- 通过 `/ws/fields/:field_id/live` 向前端推送 `device_geo_update_v1`
- web 侧增量更新 marker 与 trajectory

## 新增通道

### WebSocket

路径：

`/ws/fields/:field_id/live?token=<AO_ACT_TOKEN>`

要求 scope：

- `fields.read`
- `telemetry.read`

## 推送事件

```json
{
  "type": "device_geo_update_v1",
  "field_id": "field_c8_demo",
  "device_id": "dev_onboard_accept_001",
  "ts_ms": 1773427003000,
  "geo": { "lat": 39.9081, "lon": 116.3971 },
  "metric": "gps",
  "value": "fix"
}
```

## 运行方式

### 后端

```powershell
pnpm --filter @geox/server dev
```

### 前端

```powershell
pnpm --filter @geox/web dev
```

### 验证

1. 打开字段详情页 `/fields/:field_id`，切到“地图”标签。
2. 保证字段已绑定设备，且该设备会写入带 `payload.geo` 的 telemetry / heartbeat。
3. 追加 1 条新的 GPS telemetry。
4. 无需刷新页面，marker 应自动移动。
5. 连续追加 3 条新的 GPS telemetry。
6. 地图上的轨迹线应自动延长。

## 已知约束

- 当前 WebSocket 鉴权先使用 query token，后续可升级为短时 ticket。
- 当前 server 采用 1 秒轮询 facts 的方式推送实时点，优先换取低改动和稳定性。
- 当前仅处理带合法 `payload.geo.lat/lon` 的 telemetry / heartbeat。
