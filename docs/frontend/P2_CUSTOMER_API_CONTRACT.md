> [!IMPORTANT]
> lifecycle: HISTORICAL_PRODUCT_CONTRACT  
> new_product_construction: SUPERSEDED  
> compatibility: MAINTENANCE_ONLY  
> canonical_successor: `GEOX Frontend Canonical Blueprint V1` + `GEOX Product Data Contract Succession V1` + FOUI Product Projection contracts  
>
> This document remains valid as P1/P2 implementation and migration provenance. Its historical use of terms such as `OFFICIAL_CUSTOMER_API` does **not** designate the canonical contract for new post-FOUI product construction. Do not add new product consumers or new product semantics to the legacy contract described here.

# P2_CUSTOMER_API_CONTRACT

## 1. Official dataScope contract
当以下 API 返回 HTTP 200 且数据可解析时，前端 adapter 必须返回：
- `dataScope: "OFFICIAL_CUSTOMER_API"`
- `is_fallback: false`

接口：
- `GET /api/v1/customer/fields`
- `GET /api/v1/customer/operations`
- `GET /api/v1/customer/reports`

## 2. Preview/Fallback copy contract
仅在 fallback/异常降级时显示限制提示：
- fields: `当前展示近期/可见地块，非完整授权列表`
- operations: `当前仅展示近期作业，非全部作业列表`
- reports: `当前仅展示驾驶舱与近期可见对象对应报告入口，非全部报告列表`

当 `dataScope === "OFFICIAL_CUSTOMER_API"` 时，三个页面不得显示上述 preview 提示。

## 3. Degrade policy
- 保留 dashboard aggregate fallback，但仅用于 API 不可用场景。
- 不得将 fallback 伪装为完整授权列表。
- 客户主界面不得展示 raw enum、内部 ID、debug payload。
