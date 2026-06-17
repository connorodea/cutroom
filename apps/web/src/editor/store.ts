import { create } from "zustand";
import type { AgentStep, PageId } from "@cutroom/core";

export type AgentPhase = "idle" | "running" | "done";

export interface EditorState {
  /** Active workspace page. */
  page: PageId;
  /** Whether the ⌘K agent palette is open. */
  agentOpen: boolean;
  /** Whether the real Import & Clean-up modal is open. */
  importOpen: boolean;
  /** Whether the AI Create modal is open. */
  createOpen: boolean;
  /** Whether the Generate (Higgsfield image/video) modal is open. */
  generateOpen: boolean;
  /** Whether the Overlay (graphics compositing) modal is open. */
  overlayOpen: boolean;
  /** Whether the Reframe (aspect ratio) modal is open. */
  reframeOpen: boolean;
  /** Whether the Highlights (best-moments reel) modal is open. */
  highlightsOpen: boolean;
  /** Whether the Captions (burn-in) modal is open. */
  captionsOpen: boolean;
  /** Whether the Speed (slow-mo / timelapse) modal is open. */
  speedOpen: boolean;
  /** Whether the Trim (in/out window) modal is open. */
  trimOpen: boolean;
  /** Whether the Color (grade / looks) modal is open. */
  colorOpen: boolean;
  /** Whether the Rotate (orientation / flip) modal is open. */
  rotateOpen: boolean;
  /** Whether the Audio (volume / mute / normalize) modal is open. */
  audioOpen: boolean;
  /** Whether the Fade (in / out) modal is open. */
  fadeOpen: boolean;
  /** Whether the Reverse (reverse / boomerang) modal is open. */
  reverseOpen: boolean;
  /** Whether the Crop (region punch-in) modal is open. */
  cropOpen: boolean;
  /** Whether the GIF export modal is open. */
  gifOpen: boolean;
  /** Whether the Loop (repeat N times) modal is open. */
  loopOpen: boolean;
  /** Whether the Thumbnail (poster frame) modal is open. */
  thumbnailOpen: boolean;
  /** Whether the Stitch (concatenate clips) modal is open. */
  stitchOpen: boolean;
  /** Whether the Watermark (brand text) modal is open. */
  watermarkOpen: boolean;

  /** Output ids of AI-created videos this session, newest-first. */
  createdOutputs: string[];

  // --- agent run state machine ---
  phase: AgentPhase;
  /** Index of the currently-running step; -1 when idle, steps.length when done. */
  active: number;
  title: string;
  steps: AgentStep[];

  setPage: (page: PageId) => void;
  openAgent: () => void;
  closeAgent: () => void;
  toggleAgent: () => void;
  openImport: () => void;
  closeImport: () => void;
  openCreate: () => void;
  closeCreate: () => void;
  openGenerate: () => void;
  closeGenerate: () => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  openReframe: () => void;
  closeReframe: () => void;
  openHighlights: () => void;
  closeHighlights: () => void;
  openCaptions: () => void;
  closeCaptions: () => void;
  openSpeed: () => void;
  closeSpeed: () => void;
  openTrim: () => void;
  closeTrim: () => void;
  openColor: () => void;
  closeColor: () => void;
  openRotate: () => void;
  closeRotate: () => void;
  openAudio: () => void;
  closeAudio: () => void;
  openFade: () => void;
  closeFade: () => void;
  openReverse: () => void;
  closeReverse: () => void;
  openCrop: () => void;
  closeCrop: () => void;
  openGif: () => void;
  closeGif: () => void;
  openLoop: () => void;
  closeLoop: () => void;
  openThumbnail: () => void;
  closeThumbnail: () => void;
  openStitch: () => void;
  closeStitch: () => void;
  openWatermark: () => void;
  closeWatermark: () => void;
  /** Record an AI-created output id (newest-first, de-duplicated). */
  addCreatedOutput: (outputId: string) => void;

  /** Begin a run: enters `running` at step 0 and opens the palette. */
  startRun: (title: string, steps: AgentStep[]) => void;
  /** Advance to the next step; transitions to `done` once past the last. */
  advance: () => void;
  /** Return the run to its idle state. */
  resetRun: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  page: "color",
  agentOpen: false,
  importOpen: false,
  createOpen: false,
  generateOpen: false,
  overlayOpen: false,
  reframeOpen: false,
  highlightsOpen: false,
  captionsOpen: false,
  speedOpen: false,
  trimOpen: false,
  colorOpen: false,
  rotateOpen: false,
  audioOpen: false,
  fadeOpen: false,
  reverseOpen: false,
  cropOpen: false,
  gifOpen: false,
  loopOpen: false,
  thumbnailOpen: false,
  stitchOpen: false,
  watermarkOpen: false,
  createdOutputs: [],
  phase: "idle",
  active: -1,
  title: "",
  steps: [],

  setPage: (page) => set({ page }),
  openAgent: () => set({ agentOpen: true }),
  closeAgent: () => set({ agentOpen: false }),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
  openGenerate: () => set({ generateOpen: true }),
  closeGenerate: () => set({ generateOpen: false }),
  openOverlay: () => set({ overlayOpen: true }),
  closeOverlay: () => set({ overlayOpen: false }),
  openReframe: () => set({ reframeOpen: true }),
  closeReframe: () => set({ reframeOpen: false }),
  openHighlights: () => set({ highlightsOpen: true }),
  closeHighlights: () => set({ highlightsOpen: false }),
  openCaptions: () => set({ captionsOpen: true }),
  closeCaptions: () => set({ captionsOpen: false }),
  openSpeed: () => set({ speedOpen: true }),
  closeSpeed: () => set({ speedOpen: false }),
  openTrim: () => set({ trimOpen: true }),
  closeTrim: () => set({ trimOpen: false }),
  openColor: () => set({ colorOpen: true }),
  closeColor: () => set({ colorOpen: false }),
  openRotate: () => set({ rotateOpen: true }),
  closeRotate: () => set({ rotateOpen: false }),
  openAudio: () => set({ audioOpen: true }),
  closeAudio: () => set({ audioOpen: false }),
  openFade: () => set({ fadeOpen: true }),
  closeFade: () => set({ fadeOpen: false }),
  openReverse: () => set({ reverseOpen: true }),
  closeReverse: () => set({ reverseOpen: false }),
  openCrop: () => set({ cropOpen: true }),
  closeCrop: () => set({ cropOpen: false }),
  openGif: () => set({ gifOpen: true }),
  closeGif: () => set({ gifOpen: false }),
  openLoop: () => set({ loopOpen: true }),
  closeLoop: () => set({ loopOpen: false }),
  openThumbnail: () => set({ thumbnailOpen: true }),
  closeThumbnail: () => set({ thumbnailOpen: false }),
  openStitch: () => set({ stitchOpen: true }),
  closeStitch: () => set({ stitchOpen: false }),
  openWatermark: () => set({ watermarkOpen: true }),
  closeWatermark: () => set({ watermarkOpen: false }),
  addCreatedOutput: (outputId) =>
    set((s) => ({ createdOutputs: [outputId, ...s.createdOutputs.filter((id) => id !== outputId)] })),

  startRun: (title, steps) => set({ phase: "running", active: 0, title, steps, agentOpen: true }),
  advance: () =>
    set((s) => {
      const next = s.active + 1;
      if (next >= s.steps.length) return { active: s.steps.length, phase: "done" };
      return { active: next };
    }),
  resetRun: () => set({ phase: "idle", active: -1, title: "", steps: [] }),
}));
