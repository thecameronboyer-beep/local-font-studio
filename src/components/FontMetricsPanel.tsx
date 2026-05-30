import { useMemo } from "react";
import { forgotten, getCharacterLabel, lowercase, numbers, punctuation, uppercase } from "../data/characterSets";
import { hasDrawnGlyph } from "../render/glyphRenderer";
import type { FontSet } from "../types/fontTypes";

type MetricGroupId = "uppercase" | "lowercase" | "numbers" | "punctuation" | "forgotten";

type FontMetricsPanelProps = {
  font: FontSet;
  selectedCharacter: string;
  onSelectCharacter: (character: string) => void;
};

const groupDefinitions: Array<{
  characters: string[];
  id: MetricGroupId;
  label: string;
}> = [
  { id: "uppercase", label: "Uppercase", characters: uppercase },
  { id: "lowercase", label: "Lowercase", characters: lowercase },
  { id: "numbers", label: "Numbers", characters: numbers },
  { id: "punctuation", label: "Punctuation", characters: punctuation },
  { id: "forgotten", label: "Forgotten", characters: forgotten },
];

export default function FontMetricsPanel({
  font,
  selectedCharacter,
  onSelectCharacter,
}: FontMetricsPanelProps) {
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
    [font],
  );

  const totalMissing = missingGroups.reduce((sum, group) => sum + group.missingCharacters.length, 0);

  return (
    <section className="studio-panel metrics-panel" aria-label="Missing glyphs">
      <div className="panel-heading compact-heading">
        <div>
          <h2>Missing</h2>
        </div>
        <div className="glyph-pill">{totalMissing} left</div>
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
      </div>
    </section>
  );
}
