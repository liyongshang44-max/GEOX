# Monitor Apple I · Web2 前端验收说明

## 一键验收步骤（人工）

1) 后端已运行（默认 base = `http://127.0.0.1:3000`）

2) 启动 Web（Windows PowerShell）

```powershell
cd apps\web
npm install
# 如需自定义后端地址：$env:VITE_API_BASE="http://127.0.0.1:3000"
npm run dev -- --host 0.0.0.0 --port 5173
```

3) 打开：`http://127.0.0.1:5173/groups`

4) 点击 `G_DEFAULT`（或任一 groupId）进入：`/group/<groupId>`

5) 确认页面存在并可用

- State Windows 在最上层且最醒目（连续色带/块状区间，块上只显示冻结文案）
- Overlays 层显示 `device_fault` + `local_anomaly` + `step_candidate`/`drift_candidate`（可开关显示）
- Time Series 不再乱（Small Multiples：`moisture`/`soiltemp`/`ec` 独立小图，同一时间轴对齐；默认收起，可展开）
- Canopy 帧可见且可点开大图（modal/lightbox），点击帧会在时间轴上显示光标线对齐时间
- 全站无“建议/推荐/应该/下一步”等措辞；无任何操作推断/日志自动生成文案

---

## Contract 检查项（逐条）

- State Windows 连续覆盖区间 `[startTs, endTs]`，无空洞
- 任意时间点只有一种 state（窗口不重叠）
- 文案只来自 5 条冻结文案：
  - `根区状态仍处于低响应区`
  - `地下状态已发生明显偏移`
  - `地下状态已发生明显偏移，冠层尚未出现回应`
  - `当前变化仍在自然波动区间内`
  - `检测到局部异常，未计入趋势`
- overlays.kind 只在 allowlist 中：`device_fault | local_anomaly | step_candidate | drift_candidate`
- weather/canopy 作为独立信息层存在（metrics 复选框包含 `rain_mm`、`air_temp_c`/`air_temp`；Canopy 独立展示）

---

## 环境变量

- `VITE_API_BASE`（可选）
  - 默认：`http://127.0.0.1:3000`
  - 用途：后端 API / 媒体访问前缀

---

## 路由

- `/groups`：Groups 列表（GET `/api/groups?projectId=P_DEFAULT`）
- `/group/:groupId`：Group Live / Replay（State Windows + Overlays + Time Series + Canopy）
