Quill Source Planning Pack
==========================

Refreshed
---------
2026-06-05 from the working tree at D:\quill.

Working-tree note
-----------------
At refresh time, src\components\TextPreview.tsx and src\styles.css already had uncommitted source edits. This pack treats the working tree as the source of truth.

Purpose
-------
This folder is a plain-text source map for Quill / Quill. It is meant for ChatGPT Projects or planning chats that need enough current app context without pasting the full repository.

How to use this pack
--------------------
Start with this file, then add the category files for the feature you want to plan.

Recommended context bundles:

1. Preview controls, export, or saved preview documents:
   - 06-Fullscreen-Preview-Export.txt
   - 08-Decor-Doodles-Stickers-Text-Layers.txt
   - 07-Themes-Palettes-Backgrounds.txt
   - 10-CSS-Layout-And-Responsive-UI.txt

2. Glyph drawing, build mode, guides, variants, or metrics:
   - 04-Glyph-Editor-Drawing-Building.txt
   - 05-Glyph-Rendering-Engine.txt
   - 02-Data-Model-Storage.txt
   - 10-CSS-Layout-And-Responsive-UI.txt

3. Font profile, presets, palettes, home-screen options:
   - 03-Font-Library-Presets.txt
   - 07-Themes-Palettes-Backgrounds.txt
   - 02-Data-Model-Storage.txt
   - 01-App-Shell-Navigation.txt

4. Mobile app, PWA, Android, native share/save:
   - 09-Mobile-PWA-Android.txt
   - 06-Fullscreen-Preview-Export.txt
   - 10-CSS-Layout-And-Responsive-UI.txt

Project shape
-------------
The app is a React 19 + TypeScript + Vite project with Capacitor 8 Android support.

Main workspace:
D:\quill

Main source folder:
D:\quill\src

Default output folder for this pack:
D:\quill\ChatGpt Quill Source Files

Core source files
-----------------
- src\App.tsx
- src\main.tsx
- src\pwa.ts
- src\components\FontLibrary.tsx
- src\components\TextPreview.tsx
- src\components\GlyphEditor.tsx
- src\components\GlyphCanvas.tsx
- src\components\GlyphConstructionCanvas.tsx
- src\components\GlyphGrid.tsx
- src\components\FontMetricsPanel.tsx
- src\components\SavedImagesPanel.tsx
- src\components\SpacingControls.tsx
- src\types\fontTypes.ts
- src\storage\fontStorage.ts
- src\storage\savedImageStorage.ts
- src\render\glyphRenderer.ts
- src\render\constructionRenderer.ts
- src\render\pixiInkRenderer.ts
- src\data\characterSets.ts
- src\data\fontPresets.ts
- src\data\palettes.ts
- src\data\appThemes.ts
- src\utils\fontGuides.ts
- src\utils\nativeFiles.ts
- src\styles.css

High-level feature map
----------------------
Quill lets a user create handwriting-style fonts, draw or build glyphs, tune glyph metrics, preview text, decorate/export preview images, save PNGs, and manage font themes/palettes locally.

The biggest feature surface is src\components\TextPreview.tsx. It owns image composition, preview document storage, fullscreen preview editing, export/share, custom and preset font rendering, text effects, doodles, stickers, ornaments, text layers, and preview-only font metric overrides.

The next biggest surface is the glyph editor in src\components\GlyphEditor.tsx, src\components\GlyphCanvas.tsx, and src\components\GlyphConstructionCanvas.tsx. It owns freehand drawing, build-mode paths, guides, variants, ink presets, sticker decorations, selection, nudge/center controls, and save flows.

Data persistence is localStorage only, with Capacitor file helpers for native share/save. There is no server database.

Category files
--------------
- 01-App-Shell-Navigation.txt
- 02-Data-Model-Storage.txt
- 03-Font-Library-Presets.txt
- 04-Glyph-Editor-Drawing-Building.txt
- 05-Glyph-Rendering-Engine.txt
- 06-Fullscreen-Preview-Export.txt
- 07-Themes-Palettes-Backgrounds.txt
- 08-Decor-Doodles-Stickers-Text-Layers.txt
- 09-Mobile-PWA-Android.txt
- 10-CSS-Layout-And-Responsive-UI.txt

Planning hazards to remember
----------------------------
- Preset fonts have a separate render and measure path in TextPreview. Font/letter tuning now affects preset preview characters through preset metric helpers.
- Preview-only metric edits do not become durable until TextPreview calls onApplyFontSpacing and App writes the changes into FontSet glyphs/settings.
- Stored data is normalized in fontStorage.ts. Durable schema changes need type updates, defaults, normalization, migration behavior, and App wiring.
- Fullscreen preview layout is sensitive to bottom-panel heights, safe-area padding, long-skinny aspect handling, and source order in styles.css.
- Source-pack work only updates these text files. It does not require npm run build unless app source changes.
