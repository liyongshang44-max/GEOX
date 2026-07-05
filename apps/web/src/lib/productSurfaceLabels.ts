// apps/web/src/lib/productSurfaceLabels.ts
// Purpose: define stable bilingual labels for formal frontend product surfaces.
// Boundary: this file defines display labels only.

import { type LocalizedCopy } from "./locale";

export type ProductSurfaceId =
  | "operator-runtime-console"
  | "customer-portal"
  | "admin-console"
  | "field-runtime"
  | "replay-backed-gateway-demo"
  | "pilot-readiness";

export type ProductSurfaceLabel = {
  id: ProductSurfaceId;
  label: LocalizedCopy;
  boundary: LocalizedCopy;
};

export const PRODUCT_SURFACE_LABELS: ProductSurfaceLabel[] = [
  {
    id: "operator-runtime-console",
    label: {
      zh: "操作员运行控制台",
      en: "Operator Runtime Console",
    },
    boundary: {
      zh: "只读运行审查",
      en: "Read-only runtime review",
    },
  },
  {
    id: "customer-portal",
    label: {
      zh: "客户门户",
      en: "Customer Portal",
    },
    boundary: {
      zh: "客户可见报告与经营视图",
      en: "Customer-visible reporting and operating views",
    },
  },
  {
    id: "admin-console",
    label: {
      zh: "后台管理",
      en: "Admin Console",
    },
    boundary: {
      zh: "内部治理与只读回查界面",
      en: "Internal governance and readback surface",
    },
  },
  {
    id: "field-runtime",
    label: {
      zh: "地块运行视图",
      en: "Field Runtime",
    },
    boundary: {
      zh: "地块级只读运行审查",
      en: "Field-scoped read-only runtime review",
    },
  },
  {
    id: "replay-backed-gateway-demo",
    label: {
      zh: "回放支撑网关演示",
      en: "Replay-backed Gateway Demo",
    },
    boundary: {
      zh: "回放支撑演示；不是实时设备连接",
      en: "Replay-backed demo; not a live device connection",
    },
  },
  {
    id: "pilot-readiness",
    label: {
      zh: "试点准备度",
      en: "Pilot Readiness",
    },
    boundary: {
      zh: "试点准备审查；不启动田间执行",
      en: "Pilot readiness review; does not start field work",
    },
  },
];
