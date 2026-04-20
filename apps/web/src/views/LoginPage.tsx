import React from "react";
import { useNavigate } from "react-router-dom";
import { LoginError, type LoginErrorCode, loginWithToken } from "../api/auth";
import { useSession } from "../auth/useSession";

const LOGIN_ERROR_COPY: Record<LoginErrorCode, string> = {
  MISSING_TOKEN: "请输入访问 Token 后再登录。",
  INVALID_TOKEN: "Token 无效或已过期，请检查后重试。",
  MISSING_CONTEXT: "登录成功但缺少租户上下文（tenant/project/group），请联系管理员。",
  INSUFFICIENT_SCOPE: "当前 Token 权限不足，无法访问控制台。",
  SERVICE_UNREACHABLE: "认证服务暂时不可达，请稍后重试。",
  UNKNOWN: "登录失败，请稍后再试或联系管理员。",
};

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { setToken } = useSession();
  const [token, setTokenInput] = React.useState("");
  const [errorCode, setErrorCode] = React.useState<LoginErrorCode | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setErrorCode(null);

    try {
      await loginWithToken(token);
      setToken(token);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof LoginError) {
        setErrorCode(error.code);
      } else {
        setErrorCode("SERVICE_UNREACHABLE");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" style={{ maxWidth: 560, margin: "48px auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>登录 GEOX 控制台</h1>
      <p className="muted" style={{ marginTop: 0 }}>请输入由平台签发的访问 Token，系统将向认证服务校验并建立正式会话。</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="token-input">访问 Token</label>
        <textarea
          id="token-input"
          className="input"
          rows={4}
          value={token}
          onChange={(event) => setTokenInput(event.target.value)}
          placeholder="粘贴访问 token"
          disabled={submitting}
        />
        {errorCode ? (
          <div className="card" role="alert" style={{ borderColor: "#f4b8bf", background: "#fff5f6", marginTop: 12 }}>
            {LOGIN_ERROR_COPY[errorCode]}
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>{submitting ? "登录中..." : "登录并进入控制台"}</button>
        </div>
      </form>
    </section>
  );
}
