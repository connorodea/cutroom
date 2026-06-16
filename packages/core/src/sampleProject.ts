import { generateWaveform } from "./wave";
import type {
  Bin,
  Collaborator,
  MediaClip,
  MetaField,
  Project,
  RenderJob,
  RenderPreset,
  Slider,
  ColorWheel,
  ToolbarTool,
  Track,
} from "./types";

// ---- Raw palette from the prototype (kept verbatim for pixel fidelity) ----
const NAMES = ["Aerial_04", "CU_Maya", "Wide_set", "Insert_2", "Interview_A", "BTS_02", "Cutaway", "Drone_07", "Logo_anim", "B-roll_st", "Reaction", "Estab_01"];
const DURS = ["0:12", "0:08", "0:21", "0:04", "1:02", "0:33", "0:17", "0:45", "0:06", "0:28", "0:14", "0:51"];
const COLORS = ["#5B8DEF", "#9B7BEA", "#43C59E", "#F2A65A", "#EC6A9C", "#5BC0DE", "#7C83FF", "#E0B341", "#4FD1C5", "#F2705A", "#6FCF97", "#B08CF0"];
const RES = ["3840×2160", "1920×1080"];
const CODECS = ["ProRes 422", "ProRes 422 HQ", "H.264", "DNxHR HQ"];

/** The 12 clips in the media pool, with derived technical metadata. */
export const clips: MediaClip[] = COLORS.map((color, i) => ({
  id: `clip-${i + 1}`,
  name: NAMES[i],
  color,
  duration: DURS[i],
  resolution: RES[i % 2],
  codec: CODECS[i % 4],
  fps: "23.98",
}));

/** Clip with a highlighted browser border (the selected clip in the Media page). */
export const selectedClipId = clips[4].id; // Interview_A

export const bins: Bin[] = [
  { id: "bin-master", name: "Master", count: 48, color: "#9A9AA0" },
  { id: "bin-footage", name: "Footage", count: 32, color: "#5B8DEF", active: true },
  { id: "bin-interviews", name: "Interviews", count: 9, color: "#43C59E" },
  { id: "bin-broll", name: "B-roll", count: 14, color: "#9B7BEA" },
  { id: "bin-audio", name: "Audio", count: 6, color: "#F2A65A" },
  { id: "bin-graphics", name: "Graphics", count: 5, color: "#EC6A9C" },
  { id: "bin-selects", name: "Selects", count: 7, color: "#4FD1C5" },
];

const dialogueWave = generateWaveform(54, 2);
const musicWave = generateWaveform(54, 5);

/** The Color page timeline: V2, V1 (video) + A1, A2 (audio). */
export const colorTimelineTracks: Track[] = [
  {
    id: "track-v2",
    lane: "V2",
    kind: "video",
    clips: [
      { id: "v2-c1", label: "Aerial", color: "#9B7BEA", start: 6, width: 19, kind: "video" },
      { id: "v2-c2", label: "Insert", color: "#43C59E", start: 28, width: 13, kind: "video" },
      { id: "v2-c3", label: "Cutaway_07", color: "#5B8DEF", start: 58, width: 23, kind: "video" },
    ],
  },
  {
    id: "track-v1",
    lane: "V1",
    kind: "video",
    clips: [
      { id: "v1-c1", label: "Interview_A · CU", color: "#5B8DEF", start: 2, width: 38, kind: "video" },
      { id: "v1-c2", label: "Interview_A", color: "#5B8DEF", start: 42, width: 30, kind: "video" },
      { id: "v1-c3", label: "Wide_set", color: "#F2A65A", start: 74, width: 22, kind: "video" },
    ],
  },
  {
    id: "track-a1",
    lane: "A1",
    kind: "audio",
    clips: [{ id: "a1-c1", label: "Dialogue", color: "#2F6F63", start: 2, width: 70, kind: "audio", waveform: dialogueWave }],
  },
  {
    id: "track-a2",
    lane: "A2",
    kind: "audio",
    clips: [{ id: "a2-c1", label: "Music_bed", color: "#5A4E86", start: 8, width: 62, kind: "audio", waveform: musicWave }],
  },
];

/** The Edit page timeline adds a title lane (V3) on top of the Color tracks. */
export const editTimelineTracks: Track[] = [
  {
    id: "track-v3",
    lane: "V3",
    kind: "video",
    clips: [{ id: "v3-c1", label: "Title · Lower third", color: "#3E63A8", start: 30, width: 26, kind: "video" }],
  },
  ...colorTimelineTracks,
];

export const collaborators: Collaborator[] = [
  { initials: "MC", color: "#5B5BD6" },
  { initials: "JR", color: "#E0892B" },
];

/** Media page metadata fields for the selected clip. */
export const metaFields: MetaField[] = [
  { key: "Resolution", value: "3840×2160" },
  { key: "Frame rate", value: "23.98 fps" },
  { key: "Codec", value: "ProRes 422 HQ" },
  { key: "Duration", value: "00:01:02:14" },
  { key: "Camera", value: "A — FX6" },
  { key: "Scene / Take", value: "04 / 02" },
];

export const keywords = ["interview", "maya", "indoor", "a-cam", "selects"];

/** Media page source-strip filmstrip frames. */
export const filmstrip = ["#5B8DEF", "#5B8DEF", "#6486C9", "#5B8DEF", "#43C59E", "#43C59E", "#3FB893", "#43C59E", "#5B8DEF", "#5B8DEF", "#9B7BEA", "#9B7BEA", "#5B8DEF", "#5B8DEF"];

// ---- Color page inspector ----
export const colorWheels: ColorWheel[] = [
  { label: "Lift", x: 54, y: 48 },
  { label: "Gamma", x: 46, y: 46 },
  { label: "Gain", x: 50, y: 52 },
];

export const colorSliders: Slider[] = [
  { label: "Temperature", value: "+12", position: 62, track: "linear-gradient(to right,#4dd2ff,#3a3f48 50%,#ffb24d)" },
  { label: "Tint", value: "−4", position: 44 },
  { label: "Contrast", value: "1.08", position: 58 },
  { label: "Saturation", value: "62", position: 52 },
];

// ---- Edit page inspector ----
export const inspectorSliders: Slider[] = [
  { label: "Zoom", value: "1.12", position: 56 },
  { label: "Position X", value: "+0.04", position: 52 },
  { label: "Position Y", value: "−0.02", position: 47 },
  { label: "Rotation", value: "0.0°", position: 50 },
];

// ---- Cut page ----
export const cutTools: ToolbarTool[] = [
  { icon: "plus", label: "Smart insert" },
  { icon: "layers", label: "Append" },
  { icon: "scissors", label: "Split" },
  { icon: "crop", label: "Close-up" },
];

/** Cut page timeline-overview blocks: [widthPercent, color]. */
export const cutOverviewClips: { width: number; color: string }[] = [
  { width: 18, color: "#5B8DEF" },
  { width: 10, color: "#9B7BEA" },
  { width: 14, color: "#43C59E" },
  { width: 20, color: "#5B8DEF" },
  { width: 12, color: "#F2A65A" },
  { width: 26, color: "#5B8DEF" },
];

/** Cut page A1 waveform. */
export const cutMainWave = generateWaveform(40, 2);

// ---- Deliver page ----
export const renderPresets: RenderPreset[] = [
  { id: "preset-yt4k", name: "YouTube 4K", sub: "H.264 · 2160p", icon: "monitor", active: true },
  { id: "preset-prores", name: "Master ProRes", sub: "ProRes 422 HQ", icon: "film" },
  { id: "preset-vertical", name: "Vertical 9:16", sub: "H.264 · 1080×1920", icon: "smartphone" },
  { id: "preset-audio", name: "Audio only", sub: "WAV · 48kHz", icon: "audio-lines" },
];

export const deliverFields: MetaField[] = [
  { key: "Format", value: "QuickTime" },
  { key: "Codec", value: "ProRes 422 HQ" },
  { key: "Resolution", value: "3840 × 2160" },
  { key: "Frame rate", value: "23.98" },
  { key: "Quality", value: "Best" },
];

export const renderQueue: RenderJob[] = [
  { id: "job-master", name: "Northwind_Ep04_Master", format: "ProRes 422 HQ · 2160p", status: "Rendering 47%", progress: 47, color: "#4FD1C5" },
  { id: "job-youtube", name: "Northwind_Ep04_YouTube", format: "H.264 · 2160p", status: "Queued", progress: 0, color: "#79797F" },
  { id: "job-reel", name: "Hook_Reel_Vertical", format: "H.264 · 1080×1920", status: "Complete", progress: 100, color: "#43C59E" },
];

/** The default project loaded in the editor. */
export const sampleProject: Project = {
  id: "northwind-ep04",
  name: "Northwind",
  episode: "Episode 04",
  clips,
  bins,
  tracks: colorTimelineTracks,
  collaborators,
};
