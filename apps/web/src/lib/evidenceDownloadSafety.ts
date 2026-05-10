const CUSTOMER_EVIDENCE_BLOCK_PATTERNS = [
  /s3:\/\//i,
  /minio:\/\//i,
  /https?:\/\//i,
  /(^|\s)\/[\w./-]+/,
  /[A-Z]:\\[\w\\.-]+/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bcredential\b/i,
  /access[_-]?key/i,
  /runtime[_-]?path/i,
  /\bruntime\b/i,
  /stack\s*trace/i,
  /debug\s*json/i,
  /\{\s*"/,
];

export function safeEvidenceDownloadUrl(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!text.startsWith("/api/v1/") && !text.startsWith("/customer/")) return null;
  if (text.includes("//") || text.includes("\\")) return null;
  const normalized = text.replace(/^\/api\/v1\//, "api/v1/").replace(/^\/customer\//, "customer/");
  if (CUSTOMER_EVIDENCE_BLOCK_PATTERNS.some((pattern) => pattern.test(normalized))) return null;
  return text;
}
