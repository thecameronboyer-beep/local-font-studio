import { useMemo } from "react";
import { forgotten, getCharacterLabel, lowercase, numbers, punctuation, spacebar, uppercase } from "../data/characterSets";
import { findPreviewGlyph, hasDrawnGlyph } from "../render/glyphRenderer";
import type { FontSet } from "../types/fontTypes";

type MetricGroupId = "uppercase" | "lowercase" | "numbers" | "punctuation" | "forgotten" | "spacebar";

type FontMetricsPanelProps = {
  font: FontSet;
  previewText: string;
  selectedCharacter: string;
  onSelectCharacter: (character: string) => void;
};

const baseGroupDefinitions: Array<{
  characters: string[];
  id: MetricGroupId;
  label: string;
}> = [
  { id: "uppercase", label: "Uppercase", characters: uppercase },
  { id: "lowercase", label: "Lowercase", characters: lowercase },
  { id: "numbers", label: "Numbers", characters: numbers },
  { id: "punctuation", label: "Punctuation", characters: punctuation },
];

export default function FontMetricsPanel({
  font,
  previewText,
  selectedCharacter,
  onSelectCharacter,
}: FontMetricsPanelProps) {
  const groupDefinitions = useMemo(
    () => [
      ...baseGroupDefinitions,
      ...(font.characterSettings.showForgotten
        ? [{ id: "forgotten" as const, label: "Forgotten", characters: forgotten }]
        : []),
      ...(font.characterSettings.showSpacebar
        ? [{ id: "spacebar" as const, label: "Space Bar", characters: [spacebar] }]
        : []),
    ],
    [font.characterSettings.showForgotten, font.characterSettings.showSpacebar],
  );

  const missingGroups = useMemo(
    () =>
      groupDefinitions.map((group) => {
        const missingCharacters = group.characters.filter((character) => !hasDrawnGlyph(font.glyphs[character]));

        return {
          ...group,
          drawnCount: group.characters.length - missingCharacters.length,
          missingCharacters,
        };
      }),
    [font, groupDefinitions],
  );

  const missingPairs = useMemo(() => {
    const pairs: Array<{ missingCharacters: string[]; pair: string }> = [];
    const seenPairs = new Set<string>();
    const characters = [...previewText.replace(/\s+/g, "")];

    for (let index = 0; index < characters.length - 1; index += 1) {
      const pair = `${characters[index]}${characters[index + 1]}`;
      const missingCharacters = [...new Set([...pair].filter((character) => !findPreviewGlyph(font.glyphs, character)))];

      if (missingCharacters.length === 0 || seenPairs.has(pair)) {
        continue;
      }

      seenPairs.add(pair);
      pairs.push({ missingCharacters, pair });
    }

    return pairs.slice(0, 18);
  }, [font, previewText]);

  const totalMissing = missingGroups.reduce((sum, group) => sum + group.missingCharacters.length, 0);
  const totalGlyphs = missingGroups.reduce((sum, group) => sum + group.characters.length, 0);
  const totalDrawn = totalGlyphs - totalMissing;
  const totalProgress = totalGlyphs > 0 ? Math.round((totalDrawn / totalGlyphs) * 100) : 0;

  return (
    <section className="studio-panel metrics-panel" aria-label="Missing glyphs">
      <div className="panel-heading compact-heading">
        <div>
          <p className="eyebrow">Progress</p>
          <h2>Glyph queue</h2>
        </div>
        <div className="glyph-pill">{totalProgress}% done</div>
      </div>

      <div className="metrics-content missing-content">
        {missingGroups.map((group) => (
          <div key={group.id} className="missing-group-card">
            <div className="missing-group-heading">
              <strong>{group.label}</strong>
              <em>
                {group.drawnCount}/{group.characters.length}
              </em>
            </div>
            <div className="missing-progress-track" aria-hidden="true">
              <span style={{ width: `${Math.round((group.drawnCount / group.characters.length) * 100)}%` }} />
            </div>
            {group.missingCharacters.length > 0 ? (
              <div className="missing-character-grid" aria-label={`Missing ${group.label}`}>
                {group.missingCharacters.map((character) => (
                  <button
                    key={character}
                    className={`missing-character-button ${selectedCharacter === character ? "selected" : ""}`}
                    type="button"
                    onClick={() => onSelectCharacter(character)}
                  >
                    {getCharacterLabel(character)}
                  </button>
                ))}
              </div>
            ) : (
              <span className="missing-complete">Complete</span>
            )}
          </div>
        ))}
        <div className="missing-group-card">
          <div className="missing-group-heading">
            <strong>Missing pairs</strong>
            <em>{missingPairs.length}</em>
          </div>
          {missingPairs.length > 0 ? (
            <div className="missing-pair-grid" aria-label="Missing pairs">
              {missingPairs.map((pair) => (
                <span
                  key={pair.pair}
                  className="missing-pair-pill"
                  title={`Missing ${pair.missingCharacters.map(getCharacterLabel).join(", ")}`}
                >
                  {pair.pair}
                </span>
              ))}
            </div>
          ) : (
            <span className="missing-complete">None</span>
          )}
        </div>
      </div>
    </section>
  );
}
