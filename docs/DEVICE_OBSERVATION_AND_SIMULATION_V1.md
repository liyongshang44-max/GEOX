# DEVICE_OBSERVATION_AND_SIMULATION_V1

## 1. 范围说明（V1）

本文件冻结 Device Observation 与 Simulation 的 V1 范围，目标是以**最小可交付**方式落地图像观测链路，不引入超出当前交付边界的媒体与视觉能力。

## 2. 模板与模拟 Profile 限定

V1 中，模板与模拟 profile 的 image capability 仅允许以下两项：

- `image_capture`
- `image_ref`（周期上报）

约束要求：

1. `image_capture` 只表达“触发图像采集动作”的能力，不绑定实时流语义。
2. `image_ref` 作为图像结果引用（例如对象存储路径、媒体资源 ID），由设备侧按既定周期上报。
3. V1 不新增其他 image / video 扩展能力枚举，避免 capability 漂移。

## 3. 前端设备详情（V1 最小实现）

设备详情页在 V1 仅实现以下图像观测信息：

- 图像占位预览（placeholder）
- 更新时间
- 最新 `image_ref`

说明：

- 页面只提供“可读最小信息面”，用于确认设备是否有最近图像引用上报。
- 不承诺图像流媒体播放、推流诊断或高频帧渲染。

## 4. V1 非目标（Non-goals）

以下能力明确不纳入 V1：

- 实时视频流
- 高帧率传输
- 视觉推断主链强依赖

补充解释：

1. 视觉推断可作为后续版本可选增强，不得成为 V1 的阻断前置条件。
2. V1 的图像能力用于“观测引用留痕与可见性”，而非构建实时视觉系统。

## 5. 交付一致性要求

1. 任一模板/模拟 profile 若声明图像能力，必须严格收敛到 `image_capture` + `image_ref`。
2. 任一设备详情实现若涉及图像展示，必须维持“占位预览 + 更新时间 + 最新 image_ref”的 V1 最小面。
3. 若需求超出本文件边界，需在 V2 文档中单独立项并给出兼容策略。

## 6. Device Simulator 路由（V1）

<a id="device-simulator-v1-routes"></a>

V1 推荐使用 device-scoped 路由：

- `POST /api/v1/devices/{id}/simulator/start`
- `POST /api/v1/devices/{id}/simulator/stop`
- `GET /api/v1/devices/{id}/simulator/status`

其中：

- `{id}` 为设备 ID（path 参数，必填）。
- `start` 请求体支持：
  - `interval_ms?: number`（服务端会 clamp 到 `[1000, 60000]`，默认 `5000`）
  - `profile_code?: string`（保留字段，用于 profile 演进兼容）

### 6.1 Start 示例

```bash
curl -X POST "http://127.0.0.1:3001/api/v1/devices/DEVICE_001/simulator/start" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "interval_ms": 3000,
    "profile_code": "soil_probe_default_v1"
  }'
```

成功响应（示例）：

```json
{
  "ok": true,
  "tenant_id": "T_DEFAULT",
  "device_id": "DEVICE_001",
  "key": "T_DEFAULT::DEVICE_001",
  "running": true,
  "already_running": false,
  "started_ts_ms": 1760000000000,
  "interval_ms": 3000,
  "last_tick_ts_ms": 1760000000001
}
```

### 6.2 Stop 示例

```bash
curl -X POST "http://127.0.0.1:3001/api/v1/devices/DEVICE_001/simulator/stop" \
  -H "Authorization: Bearer <token>"
```

### 6.3 Status 示例

```bash
curl "http://127.0.0.1:3001/api/v1/devices/DEVICE_001/simulator/status" \
  -H "Authorization: Bearer <token>"
```

运行中响应（示例）：

```json
{
  "ok": true,
  "tenant_id": "T_DEFAULT",
  "device_id": "DEVICE_001",
  "key": "T_DEFAULT::DEVICE_001",
  "running": true,
  "started_ts_ms": 1760000000000,
  "interval_ms": 3000,
  "last_tick_ts_ms": 1760000005000,
  "seq": 7
}
```

### 6.4 从 `/api/v1/simulator-runner/*` 迁移

<a id="migration-from-legacy-simulator-runner"></a>

旧路由保留为短期兼容，但在 OpenAPI 中标记为 `deprecated`，并返回 `replacement` 提示字段。

| 旧路由（deprecated） | 新路由（replacement） |
|---|---|
| `POST /api/v1/simulator-runner/start` | `POST /api/v1/devices/{id}/simulator/start` |
| `POST /api/v1/simulator-runner/stop` | `POST /api/v1/devices/{id}/simulator/stop` |
| `GET /api/v1/simulator-runner/status?device_id=...` | `GET /api/v1/devices/{id}/simulator/status` |

迁移建议：

1. 新调用方仅使用 device-scoped 三个新路由。
2. 旧调用方先完成参数迁移（`device_id` 从 body/query 迁移到 path）。
3. 监控期内观察旧路由调用量归零后，再进行下线计划。
