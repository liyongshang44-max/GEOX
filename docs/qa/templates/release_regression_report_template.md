# 发布回归报告（模板）

- 发布版本：`<release_version>`
- 报告时间：`<generated_at_iso8601>`
- 执行人：`<owner>`

## 1. 风险矩阵（固定五维）

| 场景 ID | 无观测 | 低湿 | 高盐 | 多设备冲突 | 陈旧数据 | 结果(PASS/FAIL) | 证据链接 | 备注 |
|---|---|---|---|---|---|---|---|---|
| OBS_NONE | ✅ | ❌ | ❌ | ❌ | ❌ | `<PASS/FAIL>` | `<artifact>` | `<notes>` |
| LOW_MOISTURE | ❌ | ✅ | ❌ | ❌ | ❌ | `<PASS/FAIL>` | `<artifact>` | `<notes>` |
| HIGH_SALINITY | ❌ | ❌ | ✅ | ❌ | ❌ | `<PASS/FAIL>` | `<artifact>` | `<notes>` |
| MULTI_DEVICE_CONFLICT | ❌ | ❌ | ❌ | ✅ | ❌ | `<PASS/FAIL>` | `<artifact>` | `<notes>` |
| STALE_READ_MODEL | ❌ | ❌ | ❌ | ❌ | ✅ | `<PASS/FAIL>` | `<artifact>` | `<notes>` |

## 2. 发布门禁（核心场景全通过）

- [ ] OBS_NONE = PASS
- [ ] LOW_MOISTURE = PASS
- [ ] HIGH_SALINITY = PASS
- [ ] MULTI_DEVICE_CONFLICT = PASS
- [ ] STALE_READ_MODEL = PASS

> 门禁规则：以上 5 个核心场景必须全部 PASS，任一 FAIL 或缺失均禁止发布。

## 3. 回滚触发条件（固定化）

| 触发编号 | 条件 | 观察窗口 | 动作 |
|---|---|---|---|
| RB-01 | `read model stale` 比例连续超阈值（例如 `>20%`） | 连续 3 个 5 分钟窗口 | 立即回滚到上个稳定版本 |
| RB-02 | 核心场景线上探针出现连续失败（任一场景） | 连续 2 次发布后巡检 | 暂停扩容 + 回滚 |
| RB-03 | 多设备冲突导致 recommendation 结果不确定 | 单窗口内连续 5 条冲突告警 | 关闭自动执行并回滚 |

## 4. 一键核对命令

```bash
node scripts/qa/check_release_gates.cjs --report docs/qa/reports/release_gate_report.json
```

