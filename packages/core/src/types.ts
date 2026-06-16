/** The five workspace "pages" of the Studio editor, mirroring DaVinci's page model. */
export type PageId = "media" | "cut" | "edit" | "color" | "deliver";

export type ClipKind = "video" | "audio";

/** A clip in the media pool / browser. */
export interface MediaClip {
  id: string;
  name: string;
  /** Swatch color used for the clip thumbnail in the prototype palette. */
  color: string;
  /** Human-readable duration, e.g. "0:12". */
  duration: string;
  resolution?: string;
  codec?: string;
  fps?: string;
}

/** A media bin in the Media page sidebar. */
export interface Bin {
  id: string;
  name: string;
  count: number;
  color: string;
  active?: boolean;
}

/** A clip placed on a timeline track. Positions are percentages of the track width. */
export interface TimelineClip {
  id: string;
  label: string;
  color: string;
  /** Left offset as a percentage of the track width (0–100). */
  start: number;
  /** Width as a percentage of the track width (0–100). */
  width: number;
  kind: ClipKind;
  /** Bar heights (0–100) for audio clips. */
  waveform?: number[];
}

/** A timeline lane (V1, V2, A1 …) and its clips. */
export interface Track {
  id: string;
  lane: string;
  kind: ClipKind;
  clips: TimelineClip[];
}

/** A key/value row in the Media metadata panel or Deliver settings. */
export interface MetaField {
  key: string;
  value: string;
}

/** A color-wheel indicator position (Lift / Gamma / Gain). Coords are 0–100. */
export interface ColorWheel {
  label: string;
  x: number;
  y: number;
}

/** A labeled slider with a formatted value and a knob position (0–100). */
export interface Slider {
  label: string;
  value: string;
  position: number;
  /** Optional CSS gradient for the track background (e.g. temperature). */
  track?: string;
}

/** A small icon+label tool button (Cut page toolbar). */
export interface ToolbarTool {
  icon: string;
  label: string;
}

/** A render preset card on the Deliver page. */
export interface RenderPreset {
  id: string;
  name: string;
  sub: string;
  icon: string;
  active?: boolean;
}

/** A job in the Deliver render queue. */
export interface RenderJob {
  id: string;
  name: string;
  format: string;
  status: string;
  /** Completion percentage, 0–100. */
  progress: number;
  color: string;
}

/** A collaborator avatar shown in the topbar. */
export interface Collaborator {
  initials: string;
  color: string;
}

/** The top-level project loaded in the editor. */
export interface Project {
  id: string;
  /** Project label shown in the topbar (e.g. "Northwind"). */
  name: string;
  /** Sub-label (e.g. "Episode 04"). */
  episode: string;
  clips: MediaClip[];
  bins: Bin[];
  /** Video + audio tracks for the Color page timeline. */
  tracks: Track[];
  collaborators: Collaborator[];
}
