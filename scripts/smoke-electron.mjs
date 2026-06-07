import electronPath from "electron";
import { spawn } from "node:child_process";

const smokeProcess = spawn(electronPath, ["."], {
  env: {
    ...process.env,
    QUILL_ELECTRON_DISABLE_GPU: "1",
    QUILL_ELECTRON_SMOKE: "1",
  },
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";

const timeout = setTimeout(() => {
  smokeProcess.kill();
  console.error("Electron smoke test timed out.");
  if (output.trim()) {
    console.error(output.trim());
  }
  process.exit(1);
}, 30_000);

smokeProcess.stdout.on("data", (chunk) => {
  output += chunk.toString();
});

smokeProcess.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

smokeProcess.on("exit", (code) => {
  clearTimeout(timeout);

  if (code === 0) {
    console.log("Electron smoke test passed.");
    return;
  }

  if (output.trim()) {
    console.error(output.trim());
  }

  process.exit(code ?? 1);
});
