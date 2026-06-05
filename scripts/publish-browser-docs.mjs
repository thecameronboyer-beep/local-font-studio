import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const distRoot = path.resolve(workspaceRoot, "dist");
const docsRoot = path.resolve(workspaceRoot, "docs");

const generatedEntries = [
  "assets",
  "icon-192.png",
  "icon-512.png",
  "icon.svg",
  "index.html",
  "manifest.webmanifest",
  "sw.js",
];

function assertInsideWorkspace(targetPath) {
  const relativePath = path.relative(workspaceRoot, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to publish outside the workspace: ${targetPath}`);
  }
}

async function main() {
  assertInsideWorkspace(distRoot);
  assertInsideWorkspace(docsRoot);

  await mkdir(docsRoot, { recursive: true });

  for (const entry of generatedEntries) {
    await rm(path.join(docsRoot, entry), { force: true, recursive: true });
  }

  for (const entry of generatedEntries) {
    await cp(path.join(distRoot, entry), path.join(docsRoot, entry), { recursive: true });
  }

  console.log("Published browser build to docs/ for GitHub Pages.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
