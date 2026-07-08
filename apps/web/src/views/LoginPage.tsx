// apps/web/src/views/LoginPage.tsx
// Purpose: provide the formal bilingual authentication entry surface.
// Boundary: this page maps authentication outcomes to safe product copy; it does not change authentication contracts, routes, tokens, or session semantics.

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginError, type LoginErrorCode, loginWithToken } from "../api/auth";
import { hasDeliveryTokenWithoutApiSessionToken } from "../auth/authStorage";
import { useSession } from "../auth/useSession";
import LocaleToggle from "../components/common/LocaleToggle";
import { ProductErrorState, ProductLoadingState, ProductStateBlock } from "../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../lib/locale";
import { AUTH_REASON_COPY, LOGIN_COPY, LOGIN_ERROR_COPY } from "../lib/productCopy/localeContract";

function loginErrorCopy(code: LoginErrorCode): LocalizedCopy {
  return LOGIN_ERROR_COPY[code] ?? LOGIN_ERROR_COPY.UNKNOWN;
}

function authenticationReasonCopy(reason: string, hasStateMessage: boolean): LocalizedCopy | null {
  if (reason === "AUTH_REVOKED") return AUTH_REASON_COPY.AUTH_REVOKED;
  if (reason === "AUTH_SCOPE_DENIED") return AUTH_REASON_COPY.AUTH_SCOPE_DENIED;
  if (reason === "AUTH_ROLE_DENIED") return AUTH_REASON_COPY.AUTH_ROLE_DENIED;
  if (reason === "SERVICE_UNAVAILABLE") return AUTH_REASON_COPY.SERVICE_UNAVAILABLE;
  if (reason === "AUTH_MISSING") return AUTH_REASON_COPY.AUTH_MISSING;
  if (reason === "AUTH_INVALID") return AUTH_REASON_COPY.AUTH_INVALID;
  return hasStateMessage ? AUTH_REASON_COPY.UNKNOWN : null;
}

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { applyLogin, notice, clearNotice } = useSession();
  const [token, setTokenInput] = React.useState("");
  const [errorCode, setErrorCode] = React.useState<LoginErrorCode | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const hasTokenTypeMismatch = React.useMemo(() => hasDeliveryTokenWithoutApiSessionToken(), []);
  const invalidReason = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get("reason") || "";
    const stateMessage = Boolean((location.state as { message?: string } | null)?.message);
    return authenticationReasonCopy(reason, stateMessage);
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
    <section
      className="card"
      style={{ maxWidth: 560, margin: "48px auto", padding: 24 }}
      data-pfa2-surface="login"
      data-locale={locale}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }} aria-label={localizedText(LOGIN_COPY.localeRegionAria, locale)}>
        <LocaleToggle />
      </div>

      <h1 style={{ marginTop: 0 }}>{localizedText(LOGIN_COPY.pageTitle, locale)}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{localizedText(LOGIN_COPY.pageLead, locale)}</p>

      {invalidReason ? (
        <ProductStateBlock
          kind="permissionLimited"
          surface="supporting"
          title={localizedText(LOGIN_COPY.reloginTitle, locale)}
          description={localizedText(invalidReason, locale)}
          ariaLabel={localizedText(LOGIN_COPY.authStateAria, locale)}
        />
      ) : null}

      {notice ? (
        <ProductStateBlock
          kind="degraded"
          surface="supporting"
          title={localizedText(LOGIN_COPY.noticeTitle, locale)}
          description={localizedText(AUTH_REASON_COPY.UNKNOWN, locale)}
          details={(
            <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={clearNotice}>
              {localizedText(LOGIN_COPY.noticeAcknowledge, locale)}
            </button>
          )}
          ariaLabel={localizedText(LOGIN_COPY.noticeAria, locale)}
        />
      ) : null}

      {hasTokenTypeMismatch ? (
        <ProductStateBlock
          kind="permissionLimited"
          surface="supporting"
          title={localizedText(LOGIN_COPY.credentialMismatchTitle, locale)}
          description={localizedText(LOGIN_COPY.credentialMismatchDescription, locale)}
          ariaLabel={localizedText(LOGIN_COPY.credentialMismatchAria, locale)}
        />
      ) : null}

      <form onSubmit={onSubmit}>
        <label htmlFor="token-input">{localizedText(LOGIN_COPY.tokenLabel, locale)}</label>
        <textarea
          id="token-input"
          className="input"
          rows={4}
          value={token}
          onChange={(event) => setTokenInput(event.target.value)}
          placeholder={localizedText(LOGIN_COPY.tokenPlaceholder, locale)}
          aria-label={localizedText(LOGIN_COPY.tokenLabel, locale)}
          autoComplete="off"
          disabled={submitting}
        />

        {submitting ? (
          <ProductLoadingState
            surface="supporting"
            label={localizedText(LOGIN_COPY.loadingLabel, locale)}
            description={localizedText(LOGIN_COPY.loadingDescription, locale)}
            ariaLabel={localizedText(LOGIN_COPY.loadingAria, locale)}
          />
        ) : null}

        {errorCode ? (
          <ProductErrorState
            surface="supporting"
            title={localizedText(LOGIN_COPY.errorTitle, locale)}
            message={localizedText(loginErrorCopy(errorCode), locale)}
            ariaLabel={localizedText(LOGIN_COPY.errorAria, locale)}
          />
        ) : null}

        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? localizedText(LOGIN_COPY.submittingAction, locale) : localizedText(LOGIN_COPY.submitAction, locale)}
          </button>
        </div>
      </form>
    </section>
  );
}
