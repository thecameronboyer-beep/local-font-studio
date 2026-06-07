import electronPath from "electron";
import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteUrlPattern = /Local:\s+(http:\/\/[^\s]+)/;

let electronProcess = null;
let viteUrl = null;

const viteProcess = spawn(npmCommand, ["run", "dev", "--", "--clearScreen=false"], {
  env: process.env,
  shell: false,
  stdio: ["inherit", "pipe", "pipe"],
});

function stopChildren() {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }

  if (!viteProcess.killed) {
    viteProcess.kill();
  }
}

function startElectron(url) {
  if (electronProcess) {
    return;
  }

  electronProcess = spawn(electronPath, ["."], {
    env: {
      ...process.env,
      QUILL_ELECTRON_RENDERER_URL: url,
    },
    shell: false,
    stdio: "inherit",
  });

  electronProcess.on("exit", (code) => {
    stopChildren();
    process.exit(code ?? 0);
  });
}

function handleViteOutput(chunk, stream = process.stdout) {
  const text = chunk.toString();
  stream.write(text);

  if (viteUrl) {
    return;
  }

  const match = text.match(viteUrlPattern);
  if (match) {
    viteUrl = match[1];
    startElectron(viteUrl);
  }
}

viteProcess.stdout.on("data", (chunk) => handleViteOutput(chunk));
viteProcess.stderr.on("data", (chunk) => {
  handleViteOutput(chunk, process.stderr);
});

viteProcess.on("exit", (code) => {
  if (!electronProcess) {
    process.exit(code ?? 1);
  }
});

setTimeout(() => {
  if (!viteUrl) {
    console.error("Timed out waiting for Vite to report a local URL.");
    stopChildren();
    process.exit(1);
  }
}, 45_000);

process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});
