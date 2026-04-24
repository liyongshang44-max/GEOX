import path from "node:path";
import fs from "node:fs";

export type RuntimePaths = {
  repoRoot: string;
  mediaDir: string;
  canopyDir: string;
  acceptanceDir: string;
  uploadDir: string;
};

export function resolveRuntimePaths(): RuntimePaths {
  const repoRoot = path.resolve(process.cwd());
  const mediaDir = path.join(repoRoot, "media");
  const canopyDir = path.join(mediaDir, "canopy");
  const acceptanceDir = path.join(repoRoot, "acceptance");
  const uploadDir = path.join(repoRoot, "_uploads");

  return { repoRoot, mediaDir, canopyDir, acceptanceDir, uploadDir };
}

export function ensureRuntimeDirectories(paths: RuntimePaths): void {
  fs.mkdirSync(paths.canopyDir, { recursive: true });
  fs.mkdirSync(paths.acceptanceDir, { recursive: true });
  fs.mkdirSync(paths.uploadDir, { recursive: true });
}
