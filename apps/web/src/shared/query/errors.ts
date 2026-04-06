const DEFAULT_USER_MESSAGE = "数据暂时不可用，请稍后重试。";

export function toUserErrorMessage(error: unknown, fallback: string = DEFAULT_USER_MESSAGE): string {
  if (typeof error === "string" && error.trim()) {
    return fallback;
  }
  if (error && typeof error === "object") {
    const maybe = error as { status?: number; message?: string };
    if (maybe.status === 401 || maybe.status === 403) return "当前账号暂无权限访问该页面。";
    if (maybe.status === 404) return "请求的数据不存在或已被移除。";
    if (maybe.status === 429) return "请求过于频繁，请稍后再试。";
    if (typeof maybe.status === "number" && maybe.status >= 500) return "服务暂时不可用，请稍后刷新重试。";
  }
  return fallback;
}
