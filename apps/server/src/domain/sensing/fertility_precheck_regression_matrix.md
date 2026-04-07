# Fertility Precheck 回归矩阵（D1）

> 主文件：`apps/server/src/domain/sensing/fertility_precheck_e2e.test.ts`
>
> 目标：将 `dry / high salinity / normal / missing observation` 四类场景固定为团队统一基线。

## 1) 一键执行

```bash
pnpm -C apps/server test:sensing:closed-loop
```

- 预期：输出 4 个用例全部通过。
- 若需验证稳定性（非 flaky），连续执行 2 次并结果一致。

```bash
pnpm -C apps/server test:sensing:closed-loop && pnpm -C apps/server test:sensing:closed-loop
```

## 2) 固化场景与固定断言

| 场景 | 固定输入 | Derived state 固定断言 | Field read model 固定断言 | Precheck hints 固定断言 |
|---|---|---|---|---|
| dry | `soil_moisture_pct=18, ec_ds_m=1.2, canopy_temp_c=33` | `fertility_level=low`, `recommendation_bias=irrigate_first`, `salinity_risk=low`, `confidence=0.95` | 与 derived 同值；`computed_at_ts_ms=source_ts_ms`；`explanation_codes_json` 包含 `multisource_derived_state_merged` | `[{ reason_code: hard_rule_moisture_constraint_dry, action_hint: irrigate_first }]`；`routedActionHints=[irrigate_first]` |
| high salinity | `soil_moisture_pct=42, ec_ds_m=3.4, canopy_temp_c=31` | `fertility_level=high`, `recommendation_bias=inspect`, `salinity_risk=high`, `confidence=0.95` | 与 derived 同值；`computed_at_ts_ms=source_ts_ms`；`explanation_codes_json` 包含 `multisource_derived_state_merged` | `[{ reason_code: hard_rule_salinity_risk_high, action_hint: inspect }]`；`routedActionHints=[inspect]` |
| normal | `soil_moisture_pct=30, ec_ds_m=1.8, canopy_temp_c=25` | `fertility_level=medium`, `recommendation_bias=fertilize`, `salinity_risk=low`, `confidence=0.85` | 与 derived 同值；`computed_at_ts_ms=source_ts_ms`；`explanation_codes_json` 包含 `multisource_derived_state_merged` | `[]`；`routedActionHints=[]` |
| missing observation | `soil_moisture_pct=null, ec_ds_m=null, canopy_temp_c=null` | `fertility_level=unknown`, `recommendation_bias=inspect`, `salinity_risk=unknown`, `confidence=0.2` | 与 derived 同值；`computed_at_ts_ms=source_ts_ms`；`explanation_codes_json` 包含 `multisource_derived_state_merged` | `[]`；`routedActionHints=[]` |

## 3) 执行后核对项

执行结果需满足：

1. 4 类场景全部被执行（dry/high salinity/normal/missing observation）。
2. 每类场景都通过三层断言：`derived state`、`field read model`、`precheck hints`。
3. 用例名、输入、断言值不漂移；若变更需同步更新门禁清单并经评审。
