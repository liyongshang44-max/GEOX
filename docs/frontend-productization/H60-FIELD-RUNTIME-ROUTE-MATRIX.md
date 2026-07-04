<!-- docs/frontend-productization/H60-FIELD-RUNTIME-ROUTE-MATRIX.md -->
# H60 Field Runtime Route Matrix
# H60 地块运行视图路由矩阵

Status: H60.0 ROUTE CONTRACT  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Route Ownership / Canonical-Legacy Mapping  
Repo basis: main after H59 Operator Runtime Console Shell merge  
Write impact: NONE  
Backend impact: NONE  
Seed impact: NONE  
DB impact: NONE  
Runtime route impact in H60.0: NONE  

---

## 0. 目的

本文冻结 H60 Field Runtime 的 route ownership matrix。

H60.0 只定义 route family、owner、legacy mapping、migration strategy 和 acceptance requirements。

H60.0 不新增 route，不修改 `App.tsx`，不修改 React pages。

---

## 1. Route ownership 原则

H60 route ownership 必须遵守：

```text
Operator Runtime Console owns Field Runtime.
Field Runtime canonical family is /operator/fields/*.
Legacy operator twin field routes remain preserved.
Route table owns page selection.
Layout must not secretly replace route children.
No broad /app/operator/* wildcard.
No route migration without acceptance.
No write API is introduced by route migration.
```

---

## 2. H60.0 route status

H60.0 状态：

```text
canonical route family: designed only
legacy route family: preserved
App.tsx changed: false
React page changed: false
redirect behavior changed: false
write surface changed: false
```

H60.1 才允许实际新增 canonical routes。

---

## 3. Canonical route family

目标 canonical product routes：

| Route | Owner | H60.0 status | Target tab / surface | Write boundary |
| --- | --- | --- | --- | --- |
| `/operator/fields` | Operator Runtime Console | designed_not_implemented | Field list / entry | no write |
| `/operator/fields/:fieldId` | Field Runtime | designed_not_implemented | Overview | no write |
| `/operator/fields/:fieldId/evidence` | Field Runtime | designed_not_implemented | Evidence | no write |
| `/operator/fields/:fieldId/state` | Field Runtime | designed_not_implemented | State | no write |
| `/operator/fields/:fieldId/forecast` | Field Runtime | designed_not_implemented | Forecast | no recommendation / no task |
| `/operator/fields/:fieldId/scenario` | Field Runtime | designed_not_implemented | Scenario readonly | no SubmitScenarioToRecommendationPanel |
| `/operator/fields/:fieldId/residual` | Field Runtime | designed_not_implemented | Residual / Verification | no ROI / no Field Memory |
| `/operator/fields/:fieldId/calibration` | Field Runtime | designed_not_implemented | Calibration Review | no model update |
| `/operator/fields/:fieldId/health` | Field Runtime | designed_not_implemented | Health placeholder before H62 | no production monitoring claim |
| `/operator/fields/:fieldId/audit` | Field Runtime | designed_not_implemented | Audit / Trace | no product conclusion |

---

## 4. Legacy route family

Legacy routes must remain preserved:

| Legacy route | Current status | H60 strategy | Future canonical target |
| --- | --- | --- | --- |
| `/operator/twin/fields/:fieldId` | existing | preserve with legacy notice | `/operator/fields/:fieldId` |
| `/operator/twin/fields/:fieldId/forecast` | existing | preserve with legacy notice | `/operator/fields/:fieldId/forecast` |
| `/operator/twin/fields/:fieldId/scenarios` | existing | preserve as legacy / governed action surface | `/operator/fields/:fieldId/scenario` readonly |
| `/operator/twin/fields/:fieldId/evidence` | existing | preserve with legacy notice | `/operator/fields/:fieldId/evidence` |
| `/operator/twin/fields/:fieldId/calibration` | existing | preserve with legacy notice | `/operator/fields/:fieldId/calibration` |
| `/operator/twin/fields/:fieldId/post-irrigation` | existing | preserve with legacy notice | `/operator/fields/:fieldId/residual` |

H60 推荐 legacy strategy A：

```text
KEEP_LEGACY_ROUTE_RENDERING_WITH_NOTICE
```

H60 不默认 redirect。Redirect 只能在 route behavior acceptance 存在后启用。

---

## 5. Route prohibition matrix

H60 禁止：

```text
/app/operator/* broad wildcard
删除 /operator/twin/fields/:fieldId
删除 /operator/twin/fields/:fieldId/forecast
删除 /operator/twin/fields/:fieldId/scenarios
删除 /operator/twin/fields/:fieldId/evidence
删除 /operator/twin/fields/:fieldId/calibration
删除 /operator/twin/fields/:fieldId/post-irrigation
删除 /operator/twin/gateway-demo
提升 /operator/workbench 为 Field Runtime 主线
提升 /operator/dispatch 为 Field Runtime 主线
提升 /operator/roi-ledger 为 Field Runtime 主线
提升 /operator/field-memory 为 Field Runtime 主线
```

---

## 6. Scenario route isolation

Canonical route:

```text
/operator/fields/:fieldId/scenario
```

必须是 readonly scenario compare。

Canonical route 不得包含：

```text
SubmitScenarioToRecommendationPanel
```

Legacy route:

```text
/operator/twin/fields/:fieldId/scenarios
```

可以暂时保留旧 submission panel，但必须标记：

```text
legacy / governed action surface
not canonical Field Runtime
human-gated
not dispatch
not AO-ACT
```

---

## 7. Acceptance requirements

H60 route acceptance 后续必须检查：

```text
canonical /operator/fields/:fieldId routes exist after H60.1
legacy /operator/twin/fields/:fieldId routes still exist
no /app/operator/* broad wildcard
/operator/workbench not promoted
/operator/dispatch not promoted
/operator/roi-ledger not promoted
/operator/field-memory not promoted
no write API is introduced by route migration
```

H60.0 IA acceptance 只检查：

```text
canonical routes are documented
legacy routes are documented
H60.0 does not modify App.tsx
H60.0 does not claim route implementation
scenario isolation is documented
no-write boundary is documented
```

---

## 8. H60 route implementation order

H60 route implementation order:

```text
H60.0 route contract only
H60.1 App.tsx canonical route ownership
H60.2 Field Runtime layout + tabs
H60.3 Overview / State / Evidence summary
H60.4 Evidence tab
H60.5 Forecast tab
H60.6 Scenario readonly split
H60.7 Residual / Verification tab
H60.8 Calibration tab
H60.9 Audit drawer / chain
```

---

## 9. H60.0 nonclaims

H60.0 does not mean:

```text
/operator/fields route exists
canonical route rendering exists
legacy route redirect exists
FieldRuntimeLayout exists
FieldRuntimeTabs exists
Scenario readonly split exists
Field Runtime visual consolidation exists
Runtime Health exists
Pilot Readiness exists
live device connected
production gateway online
field pilot started
```
