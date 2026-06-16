/**
 * Deterministic waveform generator — ported verbatim from the design prototype so
 * audio clips render identically. Returns `n` bar heights in the range 10–100.
 */
export function generateWaveform(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      10,
      Math.round(
        (Math.abs(Math.sin(i * 0.5 + seed)) * 0.6 +
          Math.abs(Math.sin(i * 1.8 + seed * 1.4)) * 0.4) *
          100,
      ),
    ),
  );
}
