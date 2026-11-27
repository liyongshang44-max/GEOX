import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function interpreterPath(executable: string): string {
  if (path.isAbsolute(executable) || path.dirname(executable) !== "." || executable.startsWith(".")) {
    return path.resolve(executable);
  }
  const filename = process.platform === "win32" && !path.extname(executable)
    ? executable + ".exe" : executable;
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, filename);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Continue searching absolute PATH entries for the configured interpreter.
    }
  }
  throw new Error("MCFT_CAP09_SCIENTIFIC_INTERPRETER_UNAVAILABLE");
}

export function runScientificPythonV1(
  executable: string,
  args: string[],
  options: { cwd: string; maxBuffer: number; timeout: number },
) {
  const env: NodeJS.ProcessEnv = { TMPDIR: options.cwd, TMP: options.cwd, TEMP: options.cwd };
  if (process.platform === "win32" && process.env.SystemRoot) {
    env.SystemRoot = process.env.SystemRoot;
  }
  return execFileAsync(interpreterPath(executable), ["-I", "-B", ...args], { ...options, env });
}
