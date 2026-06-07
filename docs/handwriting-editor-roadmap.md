# Handwriting Editor Roadmap

This roadmap is for turning Quill into a serious handwriting editor: a tool that can capture a person's writing style, tune it into a usable font system, preview real text, and export durable assets.

## Product North Star

Quill should feel like a focused handwriting workbench:

- Draw letters quickly on phone, tablet, or desktop.
- See immediately whether those letters work together as actual writing.
- Tune spacing, baselines, and scale without fighting the UI.
- Save, duplicate, restore, and export font projects confidently.
- Produce useful outputs: shareable images first, then installable font files.

## Current Foundation

The app already has a strong base:

- Multi-font local library with create, rename, duplicate, and delete flows.
- Fullscreen glyph drawing experience optimized for touch.
- Per-glyph strokes, decorations, width, bearing, advance, and baseline data.
- Character grid for supported glyph coverage.
- Live text preview and phone-image export.
- Saved generated images.
- Local storage persistence.
- PWA-oriented build and Cloudflare tunnel workflow.

## Phase 1: Make Drawing Feel Professional

Goal: drawing should feel predictable, crisp, and editable.

- Keep pen strokes exact, with no automatic bleed, bloom, or dwell pooling.
- Add stroke smoothing controls: raw, gentle, and strong.
- Add undo/redo that tracks individual stroke-level operations cleanly.
- Add selection and transform for strokes: move, scale, rotate, delete.
- Add eraser modes: stroke eraser and point/segment eraser.
- Add zoom and pan that work naturally on touch and desktop.
- Add optional guides: baseline, x-height, cap height, ascender, descender, side bearings.
- Add a calibration page for pressure/touch behavior.

Definition of done:

- A user can draw a glyph, correct mistakes, and refine it without clearing the whole letter.
- Stroke rendering is deterministic across editor, preview, and export.
- Drawing remains responsive on mobile hardware.

## Phase 2: Make Glyphs Behave Like a Font

Goal: glyphs should align, space, and scale like a coherent handwriting system.

- Create a metrics panel for baseline, x-height, cap height, ascender, descender, width, advance, and side bearings.
- Add batch metric tools across character groups: uppercase, lowercase, numbers, punctuation.
- Add visual collision checks for common pairs like `ll`, `oo`, `th`, `AV`, and punctuation spacing.
- Add reference overlays: show another glyph ghosted behind the current one.
- Add consistency helpers: compare height, slant, weight, and left/right spacing across related glyphs.
- Add character set progress: required, recommended, complete.

Definition of done:

- A font can be tuned as a system, not only one glyph at a time.
- Preview text exposes spacing problems early.
- Users can fix a whole category without repetitive manual edits.

## Phase 3: Make Text Preview a Real Test Bench

Goal: preview should answer, "Does this handwriting work in real writing?"

- Add preview presets: pangrams, entry text, labels, addresses, notes, dialogue, alphabet sheets.
- Add multiline layout controls: width, line height, alignment, padding, background, ink color.
- Add pair/word diagnostics for cramped, loose, or missing glyphs.
- Add missing-character fallback highlighting.
- Add saveable preview documents.
- Add export presets for phone wallpaper, social post, printable page, and transparent PNG.

Definition of done:

- Users can judge readability and style before exporting.
- Preview documents are reusable test cases, not throwaway text boxes.

## Phase 4: Make Projects Safe and Portable

Goal: the app should be trustworthy with user-created handwriting.

- Add explicit project export/import as JSON.
- Add automatic local backups and restore points.
- Add storage health checks and recovery for malformed data.
- Add versioned migrations for stored font projects.
- Add a project activity log: glyph edits, exports, imports, restores.
- Add conflict-safe copy/duplicate behavior for fonts and glyph sets.

Definition of done:

- A user can move a font project between devices.
- Data corruption or app changes do not silently destroy work.
- Users can recover from accidental edits.

## Phase 5: Export Real Font Files

Goal: move from visual handwriting simulation to installable font output.

- Convert stroke paths into SVG glyph outlines.
- Build a font generation pipeline for TTF/OTF using a proven font library or server-side build step.
- Map supported characters into Unicode slots.
- Generate font metadata: family name, style, version, copyright, ascent, descent, line gap.
- Add export validation: missing glyphs, invalid outlines, extreme metrics, overlapping paths.
- Add a font specimen page after export.

Definition of done:

- A generated `.ttf` or `.otf` installs and types in common apps.
- Exported fonts preserve the editor's preview metrics closely enough to trust.

## Phase 6: Make It Powerful Without Making It Heavy

Goal: advanced tools should stay quiet until needed.

- Add keyboard shortcuts for desktop users.
- Add command palette for actions like "center glyph", "copy metrics", and "next missing character".
- Add templates for handwriting styles: compact, tall, casual, print, script, all-caps.
- Add optional stabilization and smoothing profiles.
- Add accessibility checks for controls and touch target sizes.
- Add performance profiling for large fonts and long preview texts.

Definition of done:

- Beginners can draw immediately.
- Power users can move fast.
- The app stays usable on phones.

## Technical Architecture Direction

- Keep editor state as normalized font project data.
- Split drawing input, stroke model, rendering, metrics, and export into separate modules.
- Treat canvas rendering as a pure view of glyph data whenever possible.
- Add tests around storage migrations, glyph renderer output assumptions, and metrics math.
- Use browser APIs for local-first work first; introduce server or worker steps only when font export needs them.
- Keep Cloudflare tunnel as a sharing/testing surface, not the canonical development target.

## GitHub Tracking Plan

Use GitHub issues as roadmap epics:

- Epic: Professional drawing engine.
- Epic: Font metrics and consistency tools.
- Epic: Real text preview and export presets.
- Epic: Project portability and backups.
- Epic: Installable font export.
- Epic: Power-user workflow and performance.

Each epic should be broken into small vertical slices that can be implemented, built, tested, committed, and pushed independently.

## Canva Planning Use

Use Canva for visual planning once the roadmap stabilizes:

- One-page product vision board.
- Feature map grouped by workflow: Draw, Tune, Preview, Export, Manage.
- Mobile-first screen flow for drawing and adjustment.
- Export journey diagram from strokes to PNG to installable font.

The Canva artifact should support design decisions; GitHub remains the execution tracker.

## Immediate Next Build Slice

The next practical slice should be "Professional drawing engine v1":

- Confirm no bleed/pooling remains in editor or preview.
- Add three smoothing modes.
- Add stroke selection/delete.
- Add zoom/pan.
- Add a small renderer regression harness for old ink-heavy glyph data.

This slice improves the core feel before more UI or export complexity piles on top.
