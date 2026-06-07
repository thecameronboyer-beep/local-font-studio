import path from "node:path";

const canonicalWorkspace = "D:\\quill";
const oldOneDriveWorkspace = "C:\\Users\\theca\\OneDrive\\Documents\\Font Studio";
const allowNonCanonical = process.env.QUILL_ALLOW_NON_CANONICAL === "1";

function normalizeWorkspace(workspacePath) {
  return path.resolve(workspacePath).replace(/[\\/]+$/, "").toLowerCase();
}

if (process.platform === "win32" && !process.env.CI) {
  const cwd = normalizeWorkspace(process.cwd());
  const canonical = normalizeWorkspace(canonicalWorkspace);
  const oldOneDrive = normalizeWorkspace(oldOneDriveWorkspace);

  if (cwd !== canonical && !allowNonCanonical) {
    const isOldOneDrive = cwd === oldOneDrive || cwd.startsWith(`${oldOneDrive}\\`);
    const source = isOldOneDrive ? "the old C/OneDrive project folder" : "a non-canonical folder";

    console.error("");
    console.error(`Quill was started from ${source}:`);
    console.error(`  ${process.cwd()}`);
    console.error("");
    console.error("Use the canonical D-drive workspace instead:");
    console.error(`  ${canonicalWorkspace}`);
    console.error("");
    console.error("Override only for deliberate maintenance with QUILL_ALLOW_NON_CANONICAL=1.");
    console.error("");
    process.exit(1);
  }
}
