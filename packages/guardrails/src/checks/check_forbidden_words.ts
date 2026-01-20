import { FORBIDDEN_WORDS } from "../config/forbidden_words";
import fs from "node:fs";
import path from "node:path";

// Guardrails target: human-facing implementation text.
// Constitutional specs, schemas, and frozen docs may legitimately contain forbidden tokens
// as descriptions, fixtures, or field names. Scanning them would create deterministic
// false positives and block CI without improving safety.
const TEXT_EXT = new Set([".ts", ".tsx", ".md", ".txt", ".json"]);

const SKIP_DIR = new Set([
  "node_modules",
  "dist",
  ".git",
  // Frozen / normative / contract paths (do not scan)
  "doc",
  "docs",
  "fixtures",
  "config",
  "docker",
  // Contracts & schemas are scanned by contract-unit checks, not forbidden-words.
  "packages",
]);

function shouldSkipFile(fullPath: string): boolean {
  // Only scan Judge implementation sources.
  // Apple I apps and frozen docs/contracts may contain these tokens for
  // unrelated UI copy or historical text.
  const p = fullPath.split(path.sep).join("/");
  return !p.includes("/apps/judge/src/");
}

export function checkForbiddenWords(rootDir: string): string[] {
  const hits: string[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (SKIP_DIR.has(name)) continue;
        walk(full);
      } else {
        const ext = path.extname(name);
        if (!TEXT_EXT.has(ext)) continue;
        if (shouldSkipFile(full)) continue;
        const txt = fs.readFileSync(full, "utf-8");
        for (const w of FORBIDDEN_WORDS) {
          if (txt.includes(w)) {
            hits.push(`${full}: contains forbidden word '${w}'`);
          }
        }
      }
    }
  }

  walk(rootDir);
  return hits;
}
