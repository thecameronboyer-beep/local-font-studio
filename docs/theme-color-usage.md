# Theme Color Usage Contract

App themes use six artistic source colors, then `src/data/themeGenerator.ts` turns those colors into functional UI tokens. Components should consume generated semantic tokens, not raw source palette colors.

Raw source colors are still valid for theme preview swatches, font/export backgrounds, and decorative artwork.

## Source Palette Format

Every app theme source palette keeps this shape:

| Source color | Meaning |
| --- | --- |
| `primary` | Main artistic identity color. |
| `secondary` | Supporting artistic color. |
| `background` | Source page/background color. |
| `accent` | Artistic active/accent color. |
| `gold` | Highlight or warm emphasis color. |
| `ink` | The preferred writing/text color. |

## Strawberry Market Source

```ts
{
  primary: "#E96A7A",
  secondary: "#F48FB1",
  background: "#FFF4EE",
  accent: "#8BCF8A",
  gold: "#F2C66D",
  ink: "#5A4035",
}
```

The generator treats those as source material. For example, Strawberry's primary action button does not use raw `#E96A7A`; it uses a darker generated primary step so cream text remains readable.

## Generated Token Groups

| Group | Tokens |
| --- | --- |
| Color scales | `--primary-50` through `--primary-900`, `--secondary-50` through `--secondary-900`, `--accent-50` through `--accent-900`, `--gold-50` through `--gold-900` |
| Surfaces | `--ui-page-bg`, `--ui-app-bg`, `--ui-panel-bg`, `--ui-card-bg`, `--ui-card-hover-bg`, `--ui-button-bg`, `--ui-button-hover-bg`, `--ui-inset-bg` |
| Borders | `--ui-border-soft`, `--ui-border-medium`, `--ui-border-strong`, `--ui-border-active` |
| Text | `--text-main`, `--text-muted`, `--text-subtle`, `--text-inverse`, `--text-disabled` |
| Actions | `--action-primary-bg`, `--action-primary-hover-bg`, `--action-primary-text`, `--action-secondary-bg`, `--action-secondary-hover-bg`, `--action-secondary-text` |
| States | `--selected-bg`, `--selected-border`, `--selected-text`, `--success-bg`, `--warning-bg`, `--danger-bg` |
| Controls | `--control-neutral-bg`, `--control-neutral-border`, `--control-neutral-text`, `--control-primary-bg`, `--control-primary-border`, `--control-primary-text`, `--control-selected-bg`, `--control-selected-border`, `--control-selected-text`, `--control-danger-bg`, `--control-danger-border`, `--control-danger-text`, `--control-disabled-bg`, `--control-disabled-border`, `--control-disabled-text` |
| Fields | `--field-bg`, `--field-border`, `--field-text` |
| Chips and cards | `--chip-bg`, `--chip-border`, `--chip-text`, `--card-bg`, `--card-border`, `--card-title-bg`, `--dropzone-bg`, `--dropzone-border`, `--dropzone-text` |

The implementation also emits helper tokens such as `--ui-grid-line`, `--ui-shadow`, `--danger-text`, and `--focus-ring` for recurring UI needs that are still semantic rather than raw palette references.

## Component Usage

| UI element | Use |
| --- | --- |
| Body and app shell | `--ui-page-bg`, `--ui-app-bg`, `--text-main` |
| Panels, sidebars, drawers, fullscreen shells | `--ui-panel-bg`, `--ui-border-medium`, `--ui-shadow`, `--text-main` |
| Normal buttons | `--control-neutral-bg`, `--control-neutral-border`, `--control-neutral-text` |
| Primary action buttons | `--control-primary-bg`, `--control-primary-border`, `--control-primary-text` |
| Selected or active controls | `--control-selected-bg`, `--control-selected-border`, `--control-selected-text` |
| Destructive controls | `--control-danger-bg`, `--control-danger-border`, `--control-danger-text` |
| Disabled controls | `--control-disabled-bg`, `--control-disabled-border`, `--control-disabled-text` |
| Dropdowns, inputs, editable title boxes | `--field-bg`, `--field-border`, `--field-text` |
| Counters, status pills, passive chips | `--chip-bg`, `--chip-border`, `--chip-text` |
| Cards, rows, glyph cells, theme cards, palette options | `--card-bg`, `--card-border`, `--text-main` |
| Card title strips | `--card-title-bg` |
| Drop areas | `--dropzone-bg`, `--dropzone-border`, `--dropzone-text` |
| Muted labels and helper copy | `--text-muted` or `--text-subtle` |

## Documented Color Mix Exceptions

`color-mix(...)` should live in `src/data/themeGenerator.ts` for UI token generation. The stylesheet may only keep local mixes for non-control visual assets where the color is part of authored artwork or preview rendering:

- Themed font rows and preview text font pickers use per-font `--font-row-*` and `--preview-text-font-*` colors.
- Drawing swatches, sticker drag ghosts, selected swatch rings, and canvas/focus outlines use mixes as visual affordances for generated artwork.
- Grid/page surfaces, placeholder overlays, progress tracks, and shadows may use mixes because they are decorative surfaces, not component roles.

Buttons, fields, chips, dropzones, and selected/destructive states should not define local color recipes.

## Generator Rules

- Surface tokens are generated from `background` and `ink`.
- Cards and buttons are separated from panels by generated surface steps.
- Hover states are generated farther from rest states.
- Selected states are generated stronger than hover states.
- Text tokens are checked against generated surfaces.
- Action colors use generated scale steps, not raw source colors.
- If a source color is too light or low contrast, the generator picks a darker or lighter step automatically.
- Prefer soft theme-colored contrast; harsh black or white is only a last fallback.

## Adding A Theme

Add a six-color `SourceThemePalette` in `src/data/appThemes.ts`, then call `createAppTheme`. Each app theme has one generated UI token set; do not add app-level background variants unless that feature is deliberately reintroduced.
