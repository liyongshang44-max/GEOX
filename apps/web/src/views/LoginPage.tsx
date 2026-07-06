// apps/web/src/views/LoginPage.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginError, type LoginErrorCode, loginWithToken } from "../api/auth";
import { hasDeliveryTokenWithoutApiSessionToken } from "../auth/authStorage";
import { useSession } from "../auth/useSession";
import { ProductErrorState, ProductLoadingState, ProductStateBlock } from "../design-system/product";

const LOGIN_ERROR_COPY: Record<LoginErrorCode, string> = {
  MISSING_TOKEN: "请输入访问 Token 后再登录。",
  INVALID_TOKEN: "Token 无效或已过期，请检查后重试。",
  MISSING_CONTEXT: "登录成功但缺少访问上下文，请联系管理员。",
  INSUFFICIENT_SCOPE: "当前 Token 权限不足，无法访问控制台。",
  SERVICE_UNREACHABLE: "认证服务暂时不可达，请稍后重试。",
  UNKNOWN: "登录失败，请稍后再试或联系管理员。",
};

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyLogin, notice, clearNotice } = useSession();
  const [token, setTokenInput] = React.useState("");
  const [errorCode, setErrorCode] = React.useState<LoginErrorCode | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const hasTokenTypeMismatch = React.useMemo(() => hasDeliveryTokenWithoutApiSessionToken(), []);
  const invalidReason = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get("reason") || "";
    if (reason === "AUTH_REVOKED") return "登录凭据已撤销，请重新登录。";
    if (reason === "AUTH_SCOPE_DENIED" || reason === "AUTH_ROLE_DENIED") return "当前身份仅允许查看，请联系实施或支持人员确认访问范围。";
    if (reason === "SERVICE_UNAVAILABLE") return "认证服务暂不可用，请稍后重试。";
    if (reason === "AUTH_MISSING") return "未检测到有效登录，请重新登录。";
    if (reason === "AUTH_INVALID") return "登录状态已失效，请重新登录。";
    const stateMessage = (location.state as { message?: string } | null)?.message;
    return stateMessage ? "登录状态需要重新确认，请重新登录。" : "";
  }, [location.search, location.state]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setErrorCode(null);

    try {
      const me = await loginWithToken(token);
      applyLogin(token, me);
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
      {invalidReason ? (
        <ProductStateBlock
          kind="permissionLimited"
          surface="supporting"
          title="需要重新登录"
          description={invalidReason}
          ariaLabel="Authentication state"
        />
      ) : null}
      {notice ? (
        <ProductStateBlock
          kind="degraded"
          surface="supporting"
          title="登录提示"
          description={notice}
          details={<button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={clearNotice}>我知道了</button>}
          ariaLabel="Login notice"
        />
      ) : null}
      {hasTokenTypeMismatch ? (
        <ProductStateBlock
          kind="permissionLimited"
          surface="supporting"
          title="访问凭据类型不匹配"
          description="当前浏览器保存的凭据不能建立控制台会话。请使用平台签发的控制台访问 Token 重新登录。"
          ariaLabel="Credential mismatch state"
        />
      ) : null}
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
        {submitting ? (
          <ProductLoadingState
            surface="supporting"
            label="正在校验登录凭据"
            description="认证服务正在确认访问范围并建立会话。"
            ariaLabel="Login verification loading state"
          />
        ) : null}
        {errorCode ? (
          <ProductErrorState
            surface="supporting"
            title="登录失败"
            message={LOGIN_ERROR_COPY[errorCode]}
            ariaLabel="Login error state"
          />
        ) : null}
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>{submitting ? "登录中..." : "登录并进入控制台"}</button>
        </div>
      </form>
    </section>
  );
}
