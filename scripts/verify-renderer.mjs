import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const filesToScan = [
  "src/render/glyphRenderer.ts",
  "src/components/GlyphCanvas.tsx",
];

const forbiddenPatterns = [
  { name: "ink pool timers", pattern: /inkPool/i },
  { name: "motion ink accumulation", pattern: /getMotionInk/i },
  { name: "inkiness controls", pattern: /inkiness/i },
  { name: "dwell pooling", pattern: /dwell/i },
  { name: "bleed effect", pattern: /bleed/i },
  { name: "bloom effect", pattern: /bloom/i },
  { name: "active pointer pooling", pattern: /activePointerRef/i },
  { name: "blurred renderer filter", pattern: /filter\s*=\s*["'`][^"'`]*blur/i },
];

const failures = [];

for (const file of filesToScan) {
  const source = readFileSync(resolve(root, file), "utf8");

  for (const { name, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file}: found ${name}`);
    }
  }

  if (file.endsWith("glyphRenderer.ts") && /\b(?:point|stroke)\.ink\b/.test(source)) {
    failures.push(`${file}: renderer must ignore legacy ink intensity fields`);
  }
}

if (failures.length > 0) {
  console.error("Renderer regression guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Renderer regression guard passed: no ink pooling, blur, bloom, or bleed paths detected.");
