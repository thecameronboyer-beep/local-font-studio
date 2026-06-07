import type { ProjectActivity } from "../types/fontTypes";
import type { UpdateEntry } from "./quillWorkspaceStorage";

export type AutoEntryKind = "story" | "changelog";

export type AutoEntryPairDraft = {
  changelogText: string;
  createdAt: string;
  sourceActivityId: string;
  storyText: string;
};

const meaningfulActivityTypes = new Set<ProjectActivity["type"]>([
  "font_create",
  "font_delete",
  "font_duplicate",
  "font_rename",
  "glyph_edit",
  "import",
  "export",
  "metrics_batch",
  "migration",
  "recovery",
  "restore",
]);

export function isMeaningfulAutoEntryActivity(activity?: ProjectActivity | null): activity is ProjectActivity {
  return Boolean(activity && meaningfulActivityTypes.has(activity.type));
}

export function buildAutoEntryPair(activity: ProjectActivity): AutoEntryPairDraft {
  return {
    changelogText: buildChangelogEntry(activity),
    createdAt: activity.createdAt,
    sourceActivityId: activity.id,
    storyText: buildStoryEntry(activity),
  };
}

export function formatAutoEntryTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function getLatestAutoEntryPageInfo(
  entries: UpdateEntry[],
  bookId: string,
  kind: AutoEntryKind,
): { pageId: string; pageNumber: number } | null {
  const bookEntries = entries.filter((entry) => entry.bookId === bookId);

  if (bookEntries.length === 0) {
    return null;
  }

  const latest = bookEntries[0];

  return kind === "story"
    ? { pageId: latest.storyPageId, pageNumber: latest.storyPageNumber }
    : { pageId: latest.changelogPageId, pageNumber: latest.changelogPageNumber };
}

function buildStoryEntry(activity: ProjectActivity): string {
  const stamp = formatAutoEntryTimestamp(activity.createdAt);

  switch (activity.type) {
    case "glyph_edit":
      return `[${stamp}] The hand returned to ${quoteCharacter(activity.character)} and left a sharper mark behind. ${activity.message}`;
    case "font_create":
      return `[${stamp}] A new voice was given room at the desk. ${activity.message}`;
    case "font_delete":
      return `[${stamp}] One working voice was set aside so the remaining pages could stay clearer. ${activity.message}`;
    case "font_duplicate":
      return `[${stamp}] A second branch was split from the same hand, carrying the old shape forward into a new attempt. ${activity.message}`;
    case "font_rename":
      return `[${stamp}] The work found a truer name and the pages began answering to it. ${activity.message}`;
    case "metrics_batch":
      return `[${stamp}] The spacing of the script was tuned in a single patient sweep, tightening how the writing travels across the page. ${activity.message}`;
    case "import":
      return `[${stamp}] Earlier work was brought back to the desk and folded into the present session. ${activity.message}`;
    case "export":
      return `[${stamp}] A finished piece was let out of the workshop and into the world beyond it. ${activity.message}`;
    case "migration":
      return `[${stamp}] The workshop shifted its footing without losing the work already made there. ${activity.message}`;
    case "recovery":
      return `[${stamp}] The app steadied itself after trouble and gathered the work back into order. ${activity.message}`;
    case "restore":
      return `[${stamp}] An older state of the work was called back so the book could continue from firmer ground. ${activity.message}`;
    default:
      return `[${stamp}] ${activity.message}`;
  }
}

function buildChangelogEntry(activity: ProjectActivity): string {
  const stamp = formatAutoEntryTimestamp(activity.createdAt);
  const prefix = `[${stamp}] ${activity.type}`;

  if (activity.character) {
    return `${prefix}: ${activity.message} Character=${activity.character}.`;
  }

  return `${prefix}: ${activity.message}`;
}

function quoteCharacter(character?: string): string {
  return character ? `"${character}"` : "the page";
}
