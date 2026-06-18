/**
 * The editor tool registry. A single source of truth for every media-edit tool exposed in the
 * topbar Tools menu — its label, icon, and the store action that opens its modal — organised into
 * categories. `allTools`/`filterTools` are pure + unit-tested; the Tools menu renders from them.
 */

export interface ToolDef {
  /** Stable id (matches the worker op + store flag family). */
  id: string;
  label: string;
  /** Icon name (see components/Icon). */
  icon: string;
  /** Name of the store action that opens this tool's modal (e.g. "openReframe"). */
  opener: string;
}

export interface ToolGroup {
  category: string;
  tools: ToolDef[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    category: "Transform",
    tools: [
      { id: "reframe", label: "Reframe", icon: "smartphone", opener: "openReframe" },
      { id: "crop", label: "Crop", icon: "crop", opener: "openCrop" },
      { id: "rotate", label: "Rotate", icon: "rotate-cw", opener: "openRotate" },
      { id: "trim", label: "Trim", icon: "scissors", opener: "openTrim" },
      { id: "speed", label: "Speed", icon: "gauge", opener: "openSpeed" },
      { id: "reverse", label: "Reverse", icon: "rewind", opener: "openReverse" },
      { id: "loop", label: "Loop", icon: "repeat", opener: "openLoop" },
      { id: "freeze", label: "Freeze", icon: "snowflake", opener: "openFreeze" },
      { id: "letterbox", label: "Letterbox", icon: "rectangle-horizontal", opener: "openLetterbox" },
    ],
  },
  {
    category: "Color & light",
    tools: [
      { id: "color", label: "Color", icon: "palette", opener: "openColor" },
      { id: "fade", label: "Fade", icon: "contrast", opener: "openFade" },
      { id: "border", label: "Border", icon: "square", opener: "openBorder" },
      { id: "censor", label: "Censor", icon: "eye-off", opener: "openCensor" },
    ],
  },
  {
    category: "Compose",
    tools: [
      { id: "overlay", label: "Overlay", icon: "layers", opener: "openOverlay" },
      { id: "split", label: "Split", icon: "columns-2", opener: "openSplit" },
      { id: "pip", label: "PiP", icon: "pip", opener: "openPip" },
      { id: "stitch", label: "Stitch", icon: "combine", opener: "openStitch" },
      { id: "grid", label: "Grid", icon: "grid-2x2", opener: "openGrid" },
      { id: "chromakey", label: "Green screen", icon: "wand-2", opener: "openChromaKey" },
      { id: "kenburns", label: "Animate", icon: "film", opener: "openKenBurns" },
    ],
  },
  {
    category: "Audio",
    tools: [
      { id: "audio", label: "Audio", icon: "volume-2", opener: "openAudio" },
      { id: "music", label: "Music", icon: "audio-lines", opener: "openMusic" },
      { id: "waveform", label: "Audiogram", icon: "activity", opener: "openWaveform" },
    ],
  },
  {
    category: "Text",
    tools: [
      { id: "captions", label: "Captions", icon: "captions", opener: "openCaptions" },
      { id: "subtitles", label: "Subtitles", icon: "captions", opener: "openSubtitles" },
      { id: "watermark", label: "Watermark", icon: "type", opener: "openWatermark" },
      { id: "meme", label: "Meme", icon: "smile", opener: "openMeme" },
    ],
  },
  {
    category: "Export & extras",
    tools: [
      { id: "highlights", label: "Highlights", icon: "film", opener: "openHighlights" },
      { id: "gif", label: "GIF", icon: "film", opener: "openGif" },
      { id: "thumbnail", label: "Thumbnail", icon: "camera", opener: "openThumbnail" },
      { id: "progress", label: "Progress", icon: "gauge", opener: "openProgress" },
    ],
  },
];

/** Every tool, flattened in group order. */
export function allTools(): ToolDef[] {
  return TOOL_GROUPS.flatMap((g) => g.tools);
}

/** Tools whose label matches `query` (case-insensitive substring); the full list for an empty query. */
export function filterTools(query: string): ToolDef[] {
  const q = query.trim().toLowerCase();
  if (q === "") return allTools();
  return allTools().filter((t) => t.label.toLowerCase().includes(q));
}
