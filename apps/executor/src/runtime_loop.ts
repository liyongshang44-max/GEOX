const { spawn } = require("node:child_process");

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 2000;

function parsePollIntervalMs(argv) {
  const idx = argv.indexOf("--poll_interval_ms");
  const fromArg = idx >= 0 ? argv[idx + 1] : undefined;
  const raw = fromArg ?? process.env.POLL_INTERVAL_MS ?? `${DEFAULT_POLL_INTERVAL_MS}`;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(MIN_POLL_INTERVAL_MS, parsed);
}

function stripPollArg(argv) {
  const next = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--poll_interval_ms") {
      i += 1;
      continue;
    }
    next.push(item);
  }
  return next;
}

function runDispatchOnce(forwardArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@geox/executor", "dispatch-once", "--", ...forwardArgs],
      { stdio: "inherit", env: process.env }
    );

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`dispatch-once exited with code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRuntimeLoop(cliArgs) {
  const argv = cliArgs ?? process.argv.slice(2);
  const pollIntervalMs = parsePollIntervalMs(argv);
  const forwardArgs = stripPollArg(argv);
  console.log(`INFO: executor runtime loop started poll_interval_ms=${pollIntervalMs}`);

  while (true) {
    try {
      await runDispatchOnce(forwardArgs);
    } catch (error) {
      console.error(`ERROR: runtime loop iteration failed: ${error?.stack ?? error?.message ?? String(error)}`);
    }
    await sleep(pollIntervalMs);
  }
}

if (require.main === module) {
  runRuntimeLoop().catch((error) => {
    console.error(`FATAL: runtime loop crashed unexpectedly: ${error?.stack ?? error?.message ?? String(error)}`);
    process.exit(1);
  });
}

module.exports = { runRuntimeLoop };
