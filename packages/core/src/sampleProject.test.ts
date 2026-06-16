import { describe, expect, it } from "vitest";
import {
  clips,
  colorTimelineTracks,
  editTimelineTracks,
  renderQueue,
  sampleProject,
} from "./sampleProject";

describe("sample project", () => {
  it("has 12 clips with unique ids and names", () => {
    expect(clips).toHaveLength(12);
    expect(new Set(clips.map((c) => c.id)).size).toBe(12);
    expect(new Set(clips.map((c) => c.name)).size).toBe(12);
  });

  it("keeps every timeline clip within track bounds (0–100%)", () => {
    for (const track of editTimelineTracks) {
      for (const clip of track.clips) {
        expect(clip.start).toBeGreaterThanOrEqual(0);
        expect(clip.start + clip.width).toBeLessThanOrEqual(100);
      }
    }
  });

  it("gives audio clips a waveform and video clips none", () => {
    for (const track of colorTimelineTracks) {
      for (const clip of track.clips) {
        if (clip.kind === "audio") expect(clip.waveform?.length).toBeGreaterThan(0);
        else expect(clip.waveform).toBeUndefined();
      }
    }
  });

  it("edit timeline adds a V3 title lane on top of the color tracks", () => {
    expect(editTimelineTracks[0].lane).toBe("V3");
    expect(editTimelineTracks).toHaveLength(colorTimelineTracks.length + 1);
  });

  it("render queue progress is always 0–100", () => {
    for (const job of renderQueue) {
      expect(job.progress).toBeGreaterThanOrEqual(0);
      expect(job.progress).toBeLessThanOrEqual(100);
    }
  });

  it("exposes a default project", () => {
    expect(sampleProject.name).toBe("Northwind");
    expect(sampleProject.clips).toHaveLength(12);
  });
});
