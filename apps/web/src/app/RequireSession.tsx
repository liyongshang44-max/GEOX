import React from "react";
import { Navigate } from "react-router-dom";
import { fetchAuthMe } from "../api/auth";
import { ApiError } from "../api/client";
import { useSession } from "../auth/useSession";

type SessionGuardReason =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "AUTH_REVOKED"
  | "AUTH_SCOPE_DENIED"
  | "AUTH_ROLE_DENIED"
  | "SERVICE_UNAVAILABLE";

function reasonToCopy(reason: string): string {
  if (reason === "AUTH_MISSING") return "未检测到有效登录，请重新登录。";
  if (reason === "AUTH_INVALID") return "登录状态已失效，请重新登录。";
  if (reason === "AUTH_REVOKED") return "登录凭据已撤销，请重新登录。";
  if (reason === "AUTH_SCOPE_DENIED" || reason === "AUTH_ROLE_DENIED") return "当前身份仅允许查看/需联系实施或支持。";
  if (reason === "SERVICE_UNAVAILABLE") return "服务暂不可用，请稍后重试。";
  return "登录状态已失效，请重新登录。";
}

function parseBodyCode(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { code?: string; error?: string; message?: string };
    return String(parsed.code || parsed.error || parsed.message || "").toUpperCase();
  } catch {
    return String(bodyText || "").toUpperCase();
  }
}

function mapSessionCheckError(error: unknown): SessionGuardReason {
  if (error instanceof ApiError) {
    const bodyCode = parseBodyCode(error.bodyText);
    if (error.status === 401 && (bodyCode.includes("REVOKED") || bodyCode.includes("AUTH_REVOKED"))) return "AUTH_REVOKED";
    if (error.status === 401 && (bodyCode.includes("MISSING") || bodyCode.includes("AUTH_MISSING") || bodyCode.includes("TOKEN_REQUIRED"))) return "AUTH_MISSING";
    if (error.status === 401) return "AUTH_INVALID";
    if (error.status === 403 && (bodyCode.includes("ROLE") || bodyCode.includes("AUTH_ROLE_DENIED"))) return "AUTH_ROLE_DENIED";
    if (error.status === 403) return "AUTH_SCOPE_DENIED";
    if (error.status === 408 || error.status >= 500) return "SERVICE_UNAVAILABLE";
  }
  if (error instanceof TypeError) return "SERVICE_UNAVAILABLE";
  return "AUTH_INVALID";
}

export default function RequireSession({ children }: { children: React.ReactElement }): React.ReactElement {
  const { token, isLoggedIn, hydrateSession, clearSession } = useSession();
  const [status, setStatus] = React.useState<"checking" | "ok" | "failed">("checking");
  const [reason, setReason] = React.useState<SessionGuardReason>("AUTH_INVALID");

  React.useEffect(() => {
    let mounted = true;

    if (!isLoggedIn || !token.trim()) {
      setReason("AUTH_MISSING");
      setStatus("failed");
      return () => {
        mounted = false;
      };
    }

    setStatus("checking");
    fetchAuthMe()
      .then((me) => {
        const next = hydrateSession(me);
        if (!mounted) return;
        if (!next) {
          setReason("AUTH_INVALID");
          setStatus("failed");
          return;
        }
        setStatus("ok");
      })
      .catch((error) => {
        const mappedReason = mapSessionCheckError(error);
        if (mappedReason === "AUTH_MISSING" || mappedReason === "AUTH_INVALID" || mappedReason === "AUTH_REVOKED") {
          clearSession();
        }
        if (!mounted) return;
        setReason(mappedReason);
        setStatus("failed");
      });

    return () => {
      mounted = false;
    };
  }, [isLoggedIn, token, hydrateSession, clearSession]);

  if (status === "checking") {
    return <div className="card" style={{ padding: 16, margin: 24 }}>正在验证会话，请稍候...</div>;
  }

  if (status === "failed") {
    return <Navigate to={`/login?reason=${reason}`} replace state={{ message: reasonToCopy(reason) }} />;
  }

  return children;
}
