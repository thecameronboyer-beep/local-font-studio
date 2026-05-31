import type { Glyph } from "../types/fontTypes";
import { defaultGlyphMetrics } from "../storage/fontStorage";

type SpacingControlsProps = {
  glyph: Glyph;
  onChange: (glyph: Glyph) => void;
};

const controls = [
  { key: "width", label: "Width", min: 0.45, max: 1.4, step: 0.01 },
  { key: "leftBearing", label: "Left", min: -0.2, max: 0.35, step: 0.01 },
  { key: "rightBearing", label: "Right", min: -0.2, max: 0.35, step: 0.01 },
  { key: "xAdvance", label: "Advance", min: 0.25, max: 1.6, step: 0.01 },
  { key: "baselineOffset", label: "Baseline", min: 0.45, max: 0.95, step: 0.01 },
] as const;

export default function SpacingControls({ glyph, onChange }: SpacingControlsProps) {
  function updateMetric(key: (typeof controls)[number]["key"], value: number) {
    onChange({
      ...glyph,
      [key]: value,
    });
  }

  return (
    <div className="spacing-controls" aria-label="Glyph spacing controls">
      {controls.map((control) => (
        <div key={control.key} className="metric-control">
          <span id={`metric-${control.key}`}>{control.label}</span>
          <input
            aria-labelledby={`metric-${control.key}`}
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={glyph[control.key]}
            onChange={(event) => updateMetric(control.key, Number(event.target.value))}
          />
          <output>{glyph[control.key].toFixed(2)}</output>
          <button
            className="metric-default-button"
            type="button"
            disabled={glyph[control.key] === defaultGlyphMetrics[control.key]}
            onClick={() => updateMetric(control.key, defaultGlyphMetrics[control.key])}
          >
            Default
          </button>
        </div>
      ))}
    </div>
  );
}
