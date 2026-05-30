import { useMemo, useState } from "react";
import { lowercase, numbers, punctuation, uppercase } from "../data/characterSets";
import { hasDrawnGlyph } from "../render/glyphRenderer";
import type { FontSet, Glyph } from "../types/fontTypes";

export type FontMetricKey = "baselineOffset" | "leftBearing" | "rightBearing" | "width" | "xAdvance";

type MetricGroupId = "uppercase" | "lowercase" | "numbers" | "punctuation";

type FontMetricsPanelProps = {
  font: FontSet;
  selectedCharacter: string;
  onApplyMetrics: (characters: string[], metricKeys: FontMetricKey[]) => void;
  onSelectCharacter: (character: string) => void;
};

const groupDefinitions: Array<{
  characters: string[];
  id: MetricGroupId;
  label: string;
  status: "Required" | "Recommended";
}> = [
  { id: "uppercase", label: "Uppercase", status: "Required", characters: uppercase },
  { id: "lowercase", label: "Lowercase", status: "Required", characters: lowercase },
  { id: "numbers", label: "Numbers", status: "Required", characters: numbers },
  { id: "punctuation", label: "Punctuation", status: "Recommended", characters: punctuation },
];

const metricReadouts: Array<{ key: FontMetricKey; label: string }> = [
  { key: "baselineOffset", label: "Baseline" },
  { key: "width", label: "Width" },
  { key: "xAdvance", label: "Advance" },
  { key: "leftBearing", label: "Left" },
  { key: "rightBearing", label: "Right" },
];

const batchMetricSets: Array<{ keys: FontMetricKey[]; label: string }> = [
  { label: "Apply spacing", keys: ["leftBearing", "rightBearing", "width", "xAdvance"] },
  { label: "Apply baseline", keys: ["baselineOffset"] },
  { label: "Apply all", keys: ["baselineOffset", "leftBearing", "rightBearing", "width", "xAdvance"] },
];

const pairChecks = ["ll", "oo", "th", "AV", "To", "Yo", "A.", "T,"];

function getCharacterLabel(character: string) {
  return character === " " ? "space" : character;
}

function getGlyphBounds(glyph: Glyph | undefined) {
  const points = glyph?.strokes.flatMap((stroke) => stroke.points) ?? [];

  if (points.length === 0) {
    return undefined;
  }

  return points.reduce(
    (bounds, point) => ({
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
    }),
    {
      maxX: points[0].x,
      maxY: points[0].y,
      minX: points[0].x,
      minY: points[0].y,
    },
  );
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getSpread(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function formatMetric(value: number) {
  return value.toFixed(2);
}

export default function FontMetricsPanel({
  font,
  selectedCharacter,
  onApplyMetrics,
  onSelectCharacter,
}: FontMetricsPanelProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<MetricGroupId>("lowercase");
  const selectedGlyph = font.glyphs[selectedCharacter];
  const selectedGroup = groupDefinitions.find((group) => group.id === selectedGroupId) ?? groupDefinitions[1];

  const groupStats = useMemo(
    () =>
      groupDefinitions.map((group) => {
        const drawnGlyphs = group.characters
          .map((character) => font.glyphs[character])
          .filter((glyph): glyph is Glyph => hasDrawnGlyph(glyph));
        const baselines = drawnGlyphs.map((glyph) => glyph.baselineOffset);
        const widths = drawnGlyphs.map((glyph) => glyph.width);
        const advances = drawnGlyphs.map((glyph) => glyph.xAdvance);
        const heights = drawnGlyphs
          .map((glyph) => getGlyphBounds(glyph))
          .filter((bounds): bounds is NonNullable<ReturnType<typeof getGlyphBounds>> => Boolean(bounds))
          .map((bounds) => bounds.maxY - bounds.minY);

        return {
          ...group,
          averageAdvance: getAverage(advances),
          baselineSpread: getSpread(baselines),
          drawnCount: drawnGlyphs.length,
          heightSpread: getSpread(heights),
          widthSpread: getSpread(widths),
        };
      }),
    [font],
  );

  const pairDiagnostics = useMemo(
    () =>
      pairChecks.map((pair) => {
        const [leftCharacter, rightCharacter] = [...pair];
        const leftGlyph = font.glyphs[leftCharacter];
        const rightGlyph = font.glyphs[rightCharacter];

        if (!hasDrawnGlyph(leftGlyph) || !hasDrawnGlyph(rightGlyph)) {
          const missingCharacter = !hasDrawnGlyph(leftGlyph) ? leftCharacter : rightCharacter;
          return {
            detail: `${getCharacterLabel(missingCharacter)} missing`,
            pair,
            status: "Missing",
            tone: "missing",
          };
        }

        const pairGap = leftGlyph.rightBearing + rightGlyph.leftBearing;

        if (pairGap < -0.02) {
          return { detail: `${formatMetric(pairGap)} gap`, pair, status: "Tight", tone: "tight" };
        }

        if (pairGap > 0.28) {
          return { detail: `${formatMetric(pairGap)} gap`, pair, status: "Loose", tone: "loose" };
        }

        return { detail: `${formatMetric(pairGap)} gap`, pair, status: "OK", tone: "ok" };
      }),
    [font],
  );

  function applyBatch(metricKeys: FontMetricKey[]) {
    onApplyMetrics(selectedGroup.characters, metricKeys);
  }

  return (
    <section className="studio-panel metrics-panel" aria-label="Font metrics">
      <div className="panel-heading compact-heading">
        <div>
          <p className="eyebrow">Font system</p>
          <h2>Metrics</h2>
        </div>
        <div className="glyph-pill">{getCharacterLabel(selectedCharacter)}</div>
      </div>

      <div className="metrics-content">
        <div className="metric-readout-grid" aria-label="Selected glyph metrics">
          {metricReadouts.map((metric) => (
            <div key={metric.key} className="metric-readout-card">
              <span>{metric.label}</span>
              <strong>{formatMetric(selectedGlyph?.[metric.key] ?? 0)}</strong>
            </div>
          ))}
        </div>

        <div className="metric-group-grid" aria-label="Character set progress">
          {groupStats.map((group) => (
            <button
              key={group.id}
              className={`metric-group-card ${selectedGroupId === group.id ? "selected" : ""}`}
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
            >
              <span>{group.status}</span>
              <strong>{group.label}</strong>
              <em>
                {group.drawnCount}/{group.characters.length}
              </em>
            </button>
          ))}
        </div>

        <div className="metric-batch-tools">
          <label>
            Apply current glyph to
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value as MetricGroupId)}
            >
              {groupDefinitions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
          <div className="metric-batch-buttons">
            {batchMetricSets.map((set) => (
              <button key={set.label} className="secondary-button compact-button" type="button" onClick={() => applyBatch(set.keys)}>
                {set.label}
              </button>
            ))}
          </div>
        </div>

        <div className="consistency-grid" aria-label="Consistency checks">
          {groupStats.map((group) => (
            <div key={group.id} className="consistency-card">
              <strong>{group.label}</strong>
              <span>Baseline spread {formatMetric(group.baselineSpread)}</span>
              <span>Width spread {formatMetric(group.widthSpread)}</span>
              <span>Height spread {formatMetric(group.heightSpread)}</span>
              <span>Avg advance {formatMetric(group.averageAdvance)}</span>
            </div>
          ))}
        </div>

        <div className="pair-check-list" aria-label="Pair spacing checks">
          {pairDiagnostics.map((diagnostic) => (
            <button
              key={diagnostic.pair}
              className={`pair-check-card ${diagnostic.tone}`}
              type="button"
              onClick={() => onSelectCharacter([...diagnostic.pair][0])}
            >
              <strong>{diagnostic.pair}</strong>
              <span>{diagnostic.status}</span>
              <em>{diagnostic.detail}</em>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
