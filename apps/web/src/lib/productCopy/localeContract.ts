// apps/web/src/lib/productCopy/localeContract.ts
// Purpose: define typed bilingual product copy shared by formal PFA-2 surfaces.
// Boundary: this catalog maps semantic product states to display copy only; it does not redefine backend enums, permissions, routes, or execution capability.

import { type LocalizedCopy } from "../locale";

export type FormalCopyKind =
  | "shell"
  | "navigation"
  | "pageTitle"
  | "pageLead"
  | "sectionTitle"
  | "sectionDescription"
  | "tableColumn"
  | "status"
  | "metricLabel"
  | "emptyState"
  | "loadingState"
  | "errorState"
  | "unavailableState"
  | "boundary"
  | "nonclaim"
  | "actionLabel"
  | "formLabel"
  | "placeholder"
  | "ariaLabel"
  | "exportPrint";

export type FormalCopyRecord = {
  surfaceOwner: "Customer Portal" | "Operator Runtime Console" | "Admin Console" | "Supporting Product Shell" | "Product Primitives";
  copyKind: FormalCopyKind;
  copy: LocalizedCopy;
  roleBoundary: string;
  sourceFile: string;
};

export function defineFormalCopy(record: FormalCopyRecord): FormalCopyRecord {
  return record;
}

export const SHARED_PRODUCT_STATE_COPY = {
  available: { zh: "可用", en: "Available" },
  unavailable: { zh: "不可用", en: "Unavailable" },
  partial: { zh: "部分可用", en: "Partial" },
  blocked: { zh: "已阻断", en: "Blocked" },
  readOnly: { zh: "只读", en: "Read-only" },
  replayBacked: { zh: "回放支撑", en: "Replay-backed" },
  notConnected: { zh: "未连接", en: "Not connected" },
  notOnline: { zh: "未上线", en: "Not online" },
  notStarted: { zh: "未开始", en: "Not started" },
  disabled: { zh: "已禁用", en: "Disabled" },
  degraded: { zh: "降级", en: "Degraded" },
  stale: { zh: "已过期", en: "Stale" },
  unknown: { zh: "未知", en: "Unknown" },
  sourceMissing: { zh: "来源缺失", en: "Source missing" },
  evidenceUnavailable: { zh: "证据不可用", en: "Evidence unavailable" },
  loading: { zh: "正在加载", en: "Loading" },
  temporarilyUnavailable: { zh: "暂不可用", en: "Temporarily unavailable" },
  permissionLimited: { zh: "权限受限", en: "Permission limited" },
  future: { zh: "后续阶段", en: "Future" },
  urlOnly: { zh: "仅 URL 可访问", en: "URL-only" },
  doNotBuild: { zh: "禁止构建", en: "Do not build" },
} as const satisfies Record<string, LocalizedCopy>;

export const PRODUCT_PRIMITIVE_COPY = {
  emptyStateAria: { zh: "空状态", en: "Empty state" },
  loadingStateAria: { zh: "加载状态", en: "Loading state" },
  safeErrorStateAria: { zh: "安全错误状态", en: "Safe error state" },
  productStateAria: { zh: "产品状态", en: "Product state" },
  traceIdLabel: { zh: "追踪 ID", en: "Trace ID" },
  scrollableDataTable: { zh: "可滚动数据表", en: "Scrollable data table" },
  emptyDataTableState: { zh: "数据表空状态", en: "Empty data table state" },
  tableSuffix: { zh: "数据表", en: "table" },
  emptyTableSuffix: { zh: "空表状态", en: "empty table state" },
  noRowsPrefix: { zh: "暂无", en: "No rows for" },
  noRowsFallback: { zh: "此表暂无记录。", en: "No rows for this table." },
  noRecordsDescription: { zh: "当前范围内没有可显示的记录。", en: "There are no records to display for this scope." },
} as const satisfies Record<string, LocalizedCopy>;

export const LOGIN_COPY = {
  pageTitle: { zh: "登录 GEOX 控制台", en: "Sign in to GEOX Console" },
  pageLead: {
    zh: "请输入由平台签发的访问 Token，系统将向认证服务校验并建立正式会话。",
    en: "Enter the platform-issued access token. The authentication service will validate it and establish a formal session.",
  },
  localeRegionAria: { zh: "登录页产品语言", en: "Login page product language" },
  reloginTitle: { zh: "需要重新登录", en: "Sign-in required" },
  authStateAria: { zh: "认证状态", en: "Authentication state" },
  noticeTitle: { zh: "登录提示", en: "Sign-in notice" },
  noticeAcknowledge: { zh: "我知道了", en: "Dismiss" },
  noticeAria: { zh: "登录提示状态", en: "Sign-in notice state" },
  credentialMismatchTitle: { zh: "访问凭据类型不匹配", en: "Credential type mismatch" },
  credentialMismatchDescription: {
    zh: "当前浏览器保存的凭据不能建立控制台会话。请使用平台签发的控制台访问 Token 重新登录。",
    en: "The credential saved in this browser cannot establish a console session. Sign in again with a platform-issued console access token.",
  },
  credentialMismatchAria: { zh: "访问凭据类型不匹配状态", en: "Credential mismatch state" },
  tokenLabel: { zh: "访问 Token", en: "Access Token" },
  tokenPlaceholder: { zh: "粘贴访问 Token", en: "Paste the access token" },
  loadingLabel: { zh: "正在校验登录凭据", en: "Validating sign-in credential" },
  loadingDescription: {
    zh: "认证服务正在确认访问范围并建立会话。",
    en: "The authentication service is confirming the access scope and establishing the session.",
  },
  loadingAria: { zh: "登录校验加载状态", en: "Sign-in verification loading state" },
  errorTitle: { zh: "登录失败", en: "Sign-in failed" },
  errorAria: { zh: "登录错误状态", en: "Sign-in error state" },
  submittingAction: { zh: "登录中…", en: "Signing in…" },
  submitAction: { zh: "登录并进入控制台", en: "Sign in to the console" },
} as const satisfies Record<string, LocalizedCopy>;

export const LOGIN_ERROR_COPY = {
  MISSING_TOKEN: { zh: "请输入访问 Token 后再登录。", en: "Enter an access token before signing in." },
  INVALID_TOKEN: { zh: "Token 无效或已过期，请检查后重试。", en: "The token is invalid or expired. Check it and try again." },
  MISSING_CONTEXT: { zh: "登录成功但缺少访问上下文，请联系管理员。", en: "Sign-in succeeded, but the access context is missing. Contact an administrator." },
  INSUFFICIENT_SCOPE: { zh: "当前 Token 权限不足，无法访问控制台。", en: "This token does not have sufficient scope to access the console." },
  SERVICE_UNREACHABLE: { zh: "认证服务暂时不可达，请稍后重试。", en: "The authentication service is temporarily unreachable. Try again later." },
  UNKNOWN: { zh: "登录失败，请稍后再试或联系管理员。", en: "Sign-in failed. Try again later or contact an administrator." },
} as const satisfies Record<string, LocalizedCopy>;

export const AUTH_REASON_COPY = {
  AUTH_REVOKED: { zh: "登录凭据已撤销，请重新登录。", en: "The sign-in credential was revoked. Sign in again." },
  AUTH_SCOPE_DENIED: { zh: "当前身份无权访问该范围，请联系支持人员。", en: "This identity cannot access the requested scope. Contact support." },
  AUTH_ROLE_DENIED: { zh: "当前角色无权访问该界面，请联系支持人员。", en: "This role cannot access the requested surface. Contact support." },
  AUTH_MISSING: { zh: "未检测到有效登录，请重新登录。", en: "No valid session was found. Sign in again." },
  AUTH_INVALID: { zh: "登录状态已失效，请重新登录。", en: "The session is no longer valid. Sign in again." },
  SERVICE_UNAVAILABLE: { zh: "认证服务暂不可用，请稍后重试。", en: "The authentication service is temporarily unavailable. Try again later." },
  UNKNOWN: { zh: "登录状态需要重新确认，请重新登录。", en: "The sign-in state must be confirmed again. Sign in again." },
} as const satisfies Record<string, LocalizedCopy>;

export const FORMAL_COPY_RECORDS: readonly FormalCopyRecord[] = [
  defineFormalCopy({
    surfaceOwner: "Supporting Product Shell",
    copyKind: "pageTitle",
    copy: LOGIN_COPY.pageTitle,
    roleBoundary: "authentication entry only; no capability change",
    sourceFile: "apps/web/src/views/LoginPage.tsx",
  }),
  defineFormalCopy({
    surfaceOwner: "Supporting Product Shell",
    copyKind: "pageLead",
    copy: LOGIN_COPY.pageLead,
    roleBoundary: "authentication entry only; no capability change",
    sourceFile: "apps/web/src/views/LoginPage.tsx",
  }),
  defineFormalCopy({
    surfaceOwner: "Product Primitives",
    copyKind: "status",
    copy: SHARED_PRODUCT_STATE_COPY.readOnly,
    roleBoundary: "display-only status; does not grant or revoke capability",
    sourceFile: "apps/web/src/lib/productCopy/localeContract.ts",
  }),
  defineFormalCopy({
    surfaceOwner: "Product Primitives",
    copyKind: "unavailableState",
    copy: SHARED_PRODUCT_STATE_COPY.unavailable,
    roleBoundary: "safe display fallback; does not expose backend errors",
    sourceFile: "apps/web/src/lib/productCopy/localeContract.ts",
  }),
  defineFormalCopy({
    surfaceOwner: "Product Primitives",
    copyKind: "ariaLabel",
    copy: PRODUCT_PRIMITIVE_COPY.productStateAria,
    roleBoundary: "accessible label only; does not change product state",
    sourceFile: "apps/web/src/design-system/product/*",
  }),
];
