# Sensing 回归矩阵与发布门禁（2026-04-07）

## 1) 回归矩阵（固定五维）

> 目标：将上线风险前置，覆盖无观测 / 低湿 / 高盐 / 多设备冲突 / 陈旧数据。

| Case ID | 无观测 | 低湿 | 高盐 | 多设备冲突 | 陈旧数据 | 预期 recommendation_bias | 预期 precheck | 门禁要求 |
|---|---|---|---|---|---|---|---|---|
| OBS_NONE | ✅ | ❌ | ❌ | ❌ | ❌ | `inspect`（保守） | 可为空，不阻断主流程 | 必须 PASS |
| LOW_MOISTURE | ❌ | ✅ | ❌ | ❌ | ❌ | `irrigate_first` 优先 | 可命中灌溉提示 | 必须 PASS |
| HIGH_SALINITY | ❌ | ❌ | ✅ | ❌ | ❌ | `inspect` 优先 | 应命中 `inspect` | 必须 PASS |
| MULTI_DEVICE_CONFLICT | ❌ | ❌ | ❌ | ✅ | ❌ | 冲突时保守建议，不崩溃 | 可降级到 fallback | 必须 PASS |
| STALE_READ_MODEL | ❌ | ❌ | ❌ | ❌ | ✅ | 不输出激进建议，显示 stale 标识 | precheck 允许降级 | 必须 PASS |

### 发布门禁

- **规则：核心场景 5/5 全通过才可发布。**
- 任一场景失败或缺失，发布流程应直接标记为 `FAIL`。

---

## 2) 一键门禁核对

```bash
pnpm qa:release-gate-check
```

- 默认读取：`docs/qa/reports/release_gate_report.json`
- 手动指定报告：

```bash
node scripts/qa/check_release_gates.cjs --report <path/to/report.json>
```

---

## 3) 回滚触发条件（必须预设）

1. **RB-01（read model stale）**
   - 条件：`read model stale` 比例连续超阈值（建议阈值 `>20%`，连续 3 个 5 分钟窗口）。
   - 动作：立即回滚到上个稳定版本。

2. **RB-02（核心场景线上探针失败）**
   - 条件：任一核心场景线上巡检连续 2 次失败。
   - 动作：暂停发布推进，执行回滚。

3. **RB-03（冲突告警突增）**
   - 条件：多设备冲突告警单窗口（5 分钟）连续出现 ≥5 条。
   - 动作：关闭自动执行路径并回滚。

---

## 4) 回归报告模板（固定化）

- 使用模板：`docs/qa/templates/release_regression_report_template.md`
- 使用示例报告结构：`docs/qa/reports/release_gate_report.json`
