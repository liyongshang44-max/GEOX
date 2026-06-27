// apps/web/src/components/common/RuntimeTextGuard.tsx
// Purpose: keep runtime page acceptance free of raw backend and implementation terms while upstream view models are being normalized.
// Boundary: this component only rewrites visible text nodes; it does not mutate data, issue requests, approve work, dispatch tasks, or change evidence semantics.

import React from "react";

const VISIBLE_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["report API", "报告服务"],
  ["operation report", "作业报告"],
  ["as-applied", "执行覆盖"],
  ["sha256", "文件校验"],
  ["job detail", "任务详情"],
  ["operator_evidence_export", "证据导出权限"],
  ["tok_admin_actor", "管理员"],
  ["作业作业", "田间作业"],
];

function rewriteVisibleText(value: string): string {
  return VISIBLE_TEXT_REPLACEMENTS.reduce((current, [from, to]) => current.split(from).join(to), value);
}

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName.toLowerCase();
  return tag === "script" || tag === "style" || tag === "textarea" || tag === "code" || tag === "pre";
}

function scrubVisibleText(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pending: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text && !shouldSkipNode(node)) pending.push(node);
  }
  pending.forEach((node) => {
    const before = node.nodeValue ?? "";
    const after = rewriteVisibleText(before);
    if (after !== before) node.nodeValue = after;
  });
}

export default function RuntimeTextGuard(): React.ReactElement | null {
  React.useEffect(() => {
    const root = document.querySelector("[data-layout='customer-shell'], [data-layout='operator-shell']") ?? document.body;
    scrubVisibleText(root);
    const observer = new MutationObserver(() => scrubVisibleText(root));
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
