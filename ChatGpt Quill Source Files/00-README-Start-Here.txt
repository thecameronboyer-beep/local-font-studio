Quill Source Planning Pack
==========================

Purpose
-------
This folder is a plain-text source map for the Quill / Local Font Studio app.
It is meant to be copied or uploaded into ChatGPT Projects so future planning chats can understand the app without needing the full source tree pasted every time.

How to use these files with ChatGPT
-----------------------------------
Start with this file, then add the category files that match the feature you want to plan.

Recommended context bundles:

1. Planning preview controls or exports:
   - 06-Fullscreen-Preview-Export.txt
   - 08-Decor-Doodles-Stickers-Text-Layers.txt
   - 07-Themes-Palettes-Backgrounds.txt
   - 10-CSS-Layout-And-Responsive-UI.txt

2. Planning glyph drawing or per-letter editing:
   - 04-Glyph-Editor-Drawing-Building.txt
   - 05-Glyph-Rendering-Engine.txt
   - 02-Data-Model-Storage.txt
   - 10-CSS-Layout-And-Responsive-UI.txt

3. Planning font presets, font lists, themes, or palettes:
   - 03-Font-Library-Presets.txt
   - 07-Themes-Palettes-Backgrounds.txt
   - 02-Data-Model-Storage.txt

4. Planning mobile app export, sharing, or install builds:
   - 09-Mobile-PWA-Android.txt
   - 06-Fullscreen-Preview-Export.txt

Project shape
-------------
The app is a React + TypeScript + Vite project with Capacitor support for Android.

Main workspace:
D:\Local Font Studio

Main source folder:
D:\Local Font Studio\src

Core app files:
- src\App.tsx
- src\components\TextPreview.tsx
- src\components\GlyphEditor.tsx
- src\components\GlyphCanvas.tsx
- src\components\GlyphConstructionCanvas.tsx
- src\components\FontLibrary.tsx
- src\components\GlyphGrid.tsx
- src\components\FontMetricsPanel.tsx
- src\types\fontTypes.ts
- src\storage\fontStorage.ts
- src\render\glyphRenderer.ts
- src\render\constructionRenderer.ts
- src\render\pixiInkRenderer.ts
- src\data\characterSets.ts
- src\data\fontPresets.ts
- src\data\palettes.ts
- src\data\appThemes.ts
- src\styles.css

Current high-level feature map
------------------------------
Quill lets a user create custom handwriting-style fonts by drawing or constructing glyphs, tuning glyph metrics, previewing text, decorating preview images, exporting PNGs, saving images, and managing font themes/palettes.

The largest feature surface is the fullscreen preview in src\components\TextPreview.tsx. It contains the preview image renderer, export logic, two-row mobile editing panel, canvas/font/letter/position/decor categories, text effects, preview documents, doodles, stickers, ornaments, and text layers.

The second largest feature surface is the glyph editor in src\components\GlyphEditor.tsx and src\components\GlyphCanvas.tsx. It handles drawing, quill strokes, smoothing, erasing, selection, sticker decorations, guide editing, variants, and construction mode.

Data persistence lives mostly in localStorage through src\storage\fontStorage.ts and src\storage\savedImageStorage.ts. There is no server database in the current app.

Category files in this pack
---------------------------
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

