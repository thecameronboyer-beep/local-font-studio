export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function normalize3(vector: [number, number, number]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function hash(seed: number, x: number, y: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise2D(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(0, 1, x - x0);
  const sy = smoothstep(0, 1, y - y0);

  const n00 = hash(seed, x0, y0);
  const n10 = hash(seed, x1, y0);
  const n01 = hash(seed, x0, y1);
  const n11 = hash(seed, x1, y1);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy) * 2 - 1;
}

export function fbm2D(x: number, y: number, seed: number, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise2D(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total > 0 ? value / total : 0;
}

export function seededUnit(seed: number, salt: number) {
  return hash(seed, salt, salt * 31 + 17);
}

