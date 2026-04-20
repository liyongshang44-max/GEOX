import React from "react";
import { Navigate } from "react-router-dom";
import { fetchAuthMe } from "../api/auth";
import { useSession } from "../auth/useSession";

function reasonToCopy(reason: string): string {
  if (reason === "AUTH_MISSING") return "未检测到有效登录，请重新登录。";
  if (reason === "AUTH_REVOKED") return "登录凭据已撤销，请重新登录。";
  if (reason === "AUTH_SCOPE_DENIED" || reason === "AUTH_ROLE_DENIED") return "当前身份仅允许查看/需联系实施或支持。";
  if (reason === "SERVICE_UNAVAILABLE") return "服务暂不可用，请稍后重试。";
  return "登录状态已失效，请重新登录。";
}

export default function RequireSession({ children }: { children: React.ReactElement }): React.ReactElement {
  const { token, isLoggedIn, hydrateSession, clearSession } = useSession();
  const [status, setStatus] = React.useState<"checking" | "ok" | "failed">("checking");
  const [reason, setReason] = React.useState("AUTH_INVALID");

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
      .catch(() => {
        clearSession();
        if (!mounted) return;
        setReason("AUTH_INVALID");
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
