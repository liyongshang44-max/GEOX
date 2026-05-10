import React from "react";
import type { OperatorPermissionKey } from "../../lib/permissions";

type PermissionGateState = {
  permissionKey: OperatorPermissionKey;
  allowed: boolean;
  loading: boolean;
  disabledReason: string;
};

type PermissionGateRender = React.ReactNode | ((state: PermissionGateState) => React.ReactNode);

export type PermissionGateProps = {
  permissionKey: OperatorPermissionKey;
  allowed: boolean;
  loading?: boolean;
  disabledReason?: string | null;
  children: PermissionGateRender;
  fallback?: PermissionGateRender;
};

function renderNode(node: PermissionGateRender | undefined, state: PermissionGateState): React.ReactNode {
  if (typeof node === "function") return node(state);
  return node ?? null;
}

function defaultFallback(state: PermissionGateState): React.ReactElement {
  return (
    <div className="operatorScopeWarning" role="status" aria-live="polite">
      {state.loading ? "会话权限加载中..." : state.disabledReason || "当前会话无权执行该操作。"}
    </div>
  );
}

export default function PermissionGate({
  permissionKey,
  allowed,
  loading = false,
  disabledReason = null,
  children,
  fallback,
}: PermissionGateProps): React.ReactElement {
  const state: PermissionGateState = {
    permissionKey,
    allowed: Boolean(allowed),
    loading: Boolean(loading),
    disabledReason: String(disabledReason ?? "").trim(),
  };

  if (!state.loading && state.allowed) {
    return <>{renderNode(children, state)}</>;
  }

  return <>{fallback ? renderNode(fallback, state) : defaultFallback(state)}</>;
}

export type { PermissionGateState };
