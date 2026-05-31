import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = resolve(root, "android");
const isWindows = process.platform === "win32";
const gradleWrapper = resolve(androidDir, isWindows ? "gradlew.bat" : "gradlew");

if (!existsSync(gradleWrapper)) {
  console.error(`Missing Android Gradle wrapper: ${gradleWrapper}`);
  process.exit(1);
}

const result = isWindows
  ? spawnSync("cmd", ["/c", gradleWrapper, "assembleDebug"], { cwd: androidDir, stdio: "inherit" })
  : spawnSync(gradleWrapper, ["assembleDebug"], { cwd: androidDir, stdio: "inherit" });

process.exit(result.status ?? 1);
