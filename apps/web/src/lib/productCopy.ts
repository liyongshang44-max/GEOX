// apps/web/src/lib/productCopy.ts
// Purpose: provide governed bilingual copy for formal frontend product surfaces.
// Boundary: this file stores static product UI copy only.

import { type LocalizedCopy } from "./locale";

export const PRODUCT_COPY = {
  operator: {
    shell: {
      productName: {
        zh: "GEOX 操作员运行控制台",
        en: "GEOX Operator Runtime Console",
      },
      boundary: {
        zh: "只读运行审查",
        en: "Read-only runtime review",
      },
      nav: {
        overview: { zh: "总览", en: "Overview" },
        fields: { zh: "地块", en: "Fields" },
        evidence: { zh: "证据", en: "Evidence" },
        forecast: { zh: "预测", en: "Forecast" },
        calibration: { zh: "校准", en: "Calibration" },
        health: { zh: "健康", en: "Health" },
        pilot: { zh: "试点", en: "Pilot" },
        settings: { zh: "设置", en: "Settings" },
      },
    },
    nonclaims: {
      runtimeMode: {
        zh: "运行模式：回放演示",
        en: "Runtime Mode: Replay-backed Demo",
      },
      liveDevice: {
        zh: "实时设备：未连接",
        en: "Live Device: Not connected",
      },
      productionGateway: {
        zh: "生产网关：未在线",
        en: "Production Gateway: Not online",
      },
      fieldPilot: {
        zh: "田间试点：未开始",
        en: "Field Pilot: Not started",
      },
    },
  },
  customer: {
    shell: {
      productName: {
        zh: "GEOX 客户门户",
        en: "GEOX Customer Portal",
      },
      nav: {
        dashboard: { zh: "经营总览", en: "Dashboard" },
        fields: { zh: "地块", en: "Fields" },
        operations: { zh: "作业", en: "Operations" },
        reports: { zh: "报告", en: "Reports" },
        export: { zh: "导出", en: "Export" },
      },
    },
  },
  admin: {
    shell: {
      productName: {
        zh: "GEOX 后台管理",
        en: "GEOX Admin Console",
      },
      nav: {
        dashboard: { zh: "总览", en: "Dashboard" },
        fields: { zh: "地块", en: "Fields" },
        operations: { zh: "作业", en: "Operations" },
        devices: { zh: "设备", en: "Devices" },
        evidence: { zh: "证据", en: "Evidence" },
        runtimeHealth: { zh: "运行健康", en: "Runtime Health" },
        config: { zh: "配置", en: "Config" },
      },
    },
  },
} as const satisfies Record<string, unknown>;

export type ProductCopyRegistry = typeof PRODUCT_COPY;

export function assertLocalizedCopy(copy: LocalizedCopy): LocalizedCopy {
  return copy;
}
