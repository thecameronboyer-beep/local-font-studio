import { useEffect, useRef } from "react";
import { getCharacterLabel, getVisibleCharacters } from "../data/characterSets";
import { drawGlyph, hasDrawnGlyph } from "../render/glyphRenderer";
import type { FontRenderProfile, FontSet, Glyph } from "../types/fontTypes";

type GlyphGridProps = {
  font: FontSet;
  isFullScreen?: boolean;
  onClose?: () => void;
  selectedCharacter: string;
  onSelectCharacter: (character: string) => void;
};

function GlyphMiniPreview({ glyph, renderProfile }: { glyph: Glyph; renderProfile?: FontRenderProfile }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawn = hasDrawnGlyph(glyph);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !isDrawn) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const size = 72;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawGlyph(ctx, glyph, { x: 8, y: 8, size: 56, color: "#f4ead7", renderProfile });
  }, [glyph, isDrawn, renderProfile]);

  if (!isDrawn) {
    return <span className="glyph-placeholder">Empty</span>;
  }

  return <canvas ref={canvasRef} className="glyph-mini-canvas" aria-hidden="true" />;
}

export default function GlyphGrid({
  font,
  isFullScreen = false,
  onClose,
  selectedCharacter,
  onSelectCharacter,
}: GlyphGridProps) {
  const visibleCharacters = getVisibleCharacters(font);

  return (
    <section
      className={`studio-panel grid-panel ${isFullScreen ? "fullscreen-grid-page" : ""}`}
      aria-label="Glyph grid"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Character set</p>
          <h2>Glyph grid</h2>
        </div>
        {isFullScreen ? (
          <button className="secondary-button compact-button" type="button" onClick={onClose}>
            Close
          </button>
        ) : (
          <div className="glyph-pill">{visibleCharacters.length} glyphs</div>
        )}
      </div>

      <div className="glyph-grid">
        {visibleCharacters.map((character) => {
          const glyph = font.glyphs[character];
          const selected = selectedCharacter === character;
          const drawn = hasDrawnGlyph(glyph);

          return (
            <button
              key={character}
              type="button"
              className={`glyph-cell ${selected ? "selected" : ""} ${drawn ? "complete" : ""}`}
              onClick={() => onSelectCharacter(character)}
              aria-pressed={selected}
            >
              <span className="glyph-label">{getCharacterLabel(character)}</span>
              <GlyphMiniPreview glyph={glyph} renderProfile={font.renderProfile} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
