import type { GlyphConstruction } from "../types/fontTypes";

export function createSampleConstructionA(): GlyphConstruction {
  return {
    paths: [
      {
        closed: false,
        filled: false,
        id: "construction_sample_a_outer",
        points: [
          {
            cornerStyle: "rounded",
            id: "construction_sample_a_left_foot",
            outHandle: { x: 0.33, y: 0.54 },
            segmentType: "curve",
            type: "rounded",
            x: 0.24,
            y: 0.78,
          },
          {
            cornerRadius: 0.06,
            cornerStyle: "rounded",
            id: "construction_sample_a_top",
            inHandle: { x: 0.36, y: 0.12 },
            outHandle: { x: 0.64, y: 0.12 },
            segmentType: "curve",
            type: "symmetric",
            x: 0.5,
            y: 0.18,
          },
          {
            cornerStyle: "rounded",
            id: "construction_sample_a_right_foot",
            inHandle: { x: 0.67, y: 0.54 },
            segmentType: "line",
            type: "rounded",
            x: 0.76,
            y: 0.78,
          },
        ],
        strokeColor: "#17110b",
        strokeWidth: 0.08,
      },
      {
        closed: false,
        filled: false,
        id: "construction_sample_a_crossbar",
        points: [
          {
            cornerStyle: "rounded",
            id: "construction_sample_a_crossbar_left",
            segmentType: "line",
            type: "rounded",
            x: 0.38,
            y: 0.53,
          },
          {
            cornerStyle: "rounded",
            id: "construction_sample_a_crossbar_right",
            segmentType: "line",
            type: "rounded",
            x: 0.62,
            y: 0.53,
          },
        ],
        strokeColor: "#17110b",
        strokeWidth: 0.075,
      },
    ],
    strokeColor: "#17110b",
  };
}
