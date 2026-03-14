# GEOX GIS：Canvas 热力层 + 共享时间控制（2026-03-14）

本轮在已验收通过的 live telemetry / trajectory replay 基础上，补了两个能力：

1. 把原先的 SVG 告警热力点层升级为真正的 **Canvas heat layer**。
2. 让 **告警热力查询窗口** 与 **轨迹时间轴回放窗口** 共享一套时间控制条。

## 变更摘要

### 1. Canvas heat layer

文件：`apps/web/src/components/FieldGisMap.tsx`

- 保留 SVG 负责：
  - 地块 polygon
  - 历史轨迹线
  - 设备 marker
- 新增独立 `<canvas>` 热力层，叠在 SVG 下方。
- 热力点采用 radial gradient + `lighter` 叠加模式，让密度更高区域自然更亮、更热。
- 继续沿用后端 `alert-heat` 接口返回的 `weight` 作为热力强度。

### 2. 共享时间控制条

文件：`apps/web/src/views/FieldDetailPage.tsx`

- 新增统一的 `SharedTimeRange` 状态：
  - `from_ts_ms`
  - `to_ts_ms`
- 共享给：
  - `fetchFieldTrajectorySeries(...)`
  - `fetchFieldAlertHeat(...)`
- 地图页现在提供：
  - 24 小时 / 7 天 / 30 天预设
  - 起止 `datetime-local`
  - “应用时间窗口”按钮，一次重载 **轨迹 + 热力**
- “按当前窗口重载热力”只会在共享窗口不变时重算热力筛选，不会影响回放游标。

## 验收建议

1. 打开某个 field 详情页，进入“地图”。
2. 切换共享窗口到“24 小时”，点击“应用时间窗口”。
3. 确认：
   - 轨迹回放窗口同步变化
   - 热力图按同一窗口重算
4. 再切换到“7 天”或手工修改起止时间，重复点击“应用时间窗口”。
5. 拖动时间轴时，marker 应按轨迹时间推进；热力层保持当前共享窗口的空间聚合结果。
6. 关闭“告警热力”图层后，canvas 热力层应消失，但 polygon / trajectory / marker 仍正常显示。

## 当前边界

- 本轮是 **canvas heat layer**，不是引入完整 Leaflet 地图库；这样改动更小，和当前自定义投影 SVG 架构兼容。
- 热力层仍基于后端 bucket 点，而不是前端逐像素 KDE；但视觉效果和密度表达已经明显强于原始 SVG 圆点。
- 时间轴与热力共享的是“查询时间窗口”，不是“单一播放时刻”；即热力代表整个窗口内的空间聚合，而不是随播放游标逐帧变化。
