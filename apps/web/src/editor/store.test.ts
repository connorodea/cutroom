import { beforeEach, describe, expect, it } from "vitest";
import { baseEditSteps } from "@cutroom/core";
import { useEditorStore } from "./store";

const reset = () => useEditorStore.setState(useEditorStore.getInitialState(), true);

describe("editor store", () => {
  beforeEach(reset);

  it("starts on the Color page with the agent closed and idle", () => {
    const s = useEditorStore.getState();
    expect(s.page).toBe("color");
    expect(s.agentOpen).toBe(false);
    expect(s.phase).toBe("idle");
    expect(s.active).toBe(-1);
  });

  it("switches the active page", () => {
    useEditorStore.getState().setPage("deliver");
    expect(useEditorStore.getState().page).toBe("deliver");
  });

  it("opens, closes, and toggles the agent palette", () => {
    const { openAgent, closeAgent, toggleAgent } = useEditorStore.getState();
    openAgent();
    expect(useEditorStore.getState().agentOpen).toBe(true);
    closeAgent();
    expect(useEditorStore.getState().agentOpen).toBe(false);
    toggleAgent();
    expect(useEditorStore.getState().agentOpen).toBe(true);
  });

  it("startRun enters the running phase at the first step and opens the agent", () => {
    useEditorStore.getState().startRun("Make a 60s vertical reel", baseEditSteps);
    const s = useEditorStore.getState();
    expect(s.phase).toBe("running");
    expect(s.active).toBe(0);
    expect(s.title).toBe("Make a 60s vertical reel");
    expect(s.steps).toHaveLength(baseEditSteps.length);
    expect(s.agentOpen).toBe(true);
  });

  it("advance moves through steps and finishes on the last", () => {
    const { startRun, advance } = useEditorStore.getState();
    startRun("X", baseEditSteps);
    for (let i = 1; i < baseEditSteps.length; i++) {
      advance();
      expect(useEditorStore.getState().active).toBe(i);
      expect(useEditorStore.getState().phase).toBe("running");
    }
    advance(); // past the last step
    expect(useEditorStore.getState().phase).toBe("done");
  });

  it("resetRun returns to idle", () => {
    const { startRun, resetRun } = useEditorStore.getState();
    startRun("X", baseEditSteps);
    resetRun();
    const s = useEditorStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.active).toBe(-1);
    expect(s.steps).toHaveLength(0);
  });

  it("starts with the Generate modal closed", () => {
    expect(useEditorStore.getState().generateOpen).toBe(false);
  });

  it("opens and closes the Generate modal", () => {
    const { openGenerate, closeGenerate } = useEditorStore.getState();
    openGenerate();
    expect(useEditorStore.getState().generateOpen).toBe(true);
    closeGenerate();
    expect(useEditorStore.getState().generateOpen).toBe(false);
  });

  it("opens and closes the Reframe modal", () => {
    expect(useEditorStore.getState().reframeOpen).toBe(false);
    useEditorStore.getState().openReframe();
    expect(useEditorStore.getState().reframeOpen).toBe(true);
    useEditorStore.getState().closeReframe();
    expect(useEditorStore.getState().reframeOpen).toBe(false);
  });

  it("opens and closes the Highlights modal", () => {
    expect(useEditorStore.getState().highlightsOpen).toBe(false);
    useEditorStore.getState().openHighlights();
    expect(useEditorStore.getState().highlightsOpen).toBe(true);
    useEditorStore.getState().closeHighlights();
    expect(useEditorStore.getState().highlightsOpen).toBe(false);
  });

  it("opens and closes the Captions modal", () => {
    expect(useEditorStore.getState().captionsOpen).toBe(false);
    useEditorStore.getState().openCaptions();
    expect(useEditorStore.getState().captionsOpen).toBe(true);
    useEditorStore.getState().closeCaptions();
    expect(useEditorStore.getState().captionsOpen).toBe(false);
  });

  it("opens and closes the Speed modal", () => {
    expect(useEditorStore.getState().speedOpen).toBe(false);
    useEditorStore.getState().openSpeed();
    expect(useEditorStore.getState().speedOpen).toBe(true);
    useEditorStore.getState().closeSpeed();
    expect(useEditorStore.getState().speedOpen).toBe(false);
  });

  it("opens and closes the Trim modal", () => {
    expect(useEditorStore.getState().trimOpen).toBe(false);
    useEditorStore.getState().openTrim();
    expect(useEditorStore.getState().trimOpen).toBe(true);
    useEditorStore.getState().closeTrim();
    expect(useEditorStore.getState().trimOpen).toBe(false);
  });

  it("opens and closes the Color modal", () => {
    expect(useEditorStore.getState().colorOpen).toBe(false);
    useEditorStore.getState().openColor();
    expect(useEditorStore.getState().colorOpen).toBe(true);
    useEditorStore.getState().closeColor();
    expect(useEditorStore.getState().colorOpen).toBe(false);
  });

  it("opens and closes the Rotate modal", () => {
    expect(useEditorStore.getState().rotateOpen).toBe(false);
    useEditorStore.getState().openRotate();
    expect(useEditorStore.getState().rotateOpen).toBe(true);
    useEditorStore.getState().closeRotate();
    expect(useEditorStore.getState().rotateOpen).toBe(false);
  });

  it("opens and closes the Audio modal", () => {
    expect(useEditorStore.getState().audioOpen).toBe(false);
    useEditorStore.getState().openAudio();
    expect(useEditorStore.getState().audioOpen).toBe(true);
    useEditorStore.getState().closeAudio();
    expect(useEditorStore.getState().audioOpen).toBe(false);
  });

  it("opens and closes the Fade modal", () => {
    expect(useEditorStore.getState().fadeOpen).toBe(false);
    useEditorStore.getState().openFade();
    expect(useEditorStore.getState().fadeOpen).toBe(true);
    useEditorStore.getState().closeFade();
    expect(useEditorStore.getState().fadeOpen).toBe(false);
  });

  it("opens and closes the Reverse modal", () => {
    expect(useEditorStore.getState().reverseOpen).toBe(false);
    useEditorStore.getState().openReverse();
    expect(useEditorStore.getState().reverseOpen).toBe(true);
    useEditorStore.getState().closeReverse();
    expect(useEditorStore.getState().reverseOpen).toBe(false);
  });

  it("opens and closes the Crop modal", () => {
    expect(useEditorStore.getState().cropOpen).toBe(false);
    useEditorStore.getState().openCrop();
    expect(useEditorStore.getState().cropOpen).toBe(true);
    useEditorStore.getState().closeCrop();
    expect(useEditorStore.getState().cropOpen).toBe(false);
  });

  it("opens and closes the GIF modal", () => {
    expect(useEditorStore.getState().gifOpen).toBe(false);
    useEditorStore.getState().openGif();
    expect(useEditorStore.getState().gifOpen).toBe(true);
    useEditorStore.getState().closeGif();
    expect(useEditorStore.getState().gifOpen).toBe(false);
  });

  it("opens and closes the Loop modal", () => {
    expect(useEditorStore.getState().loopOpen).toBe(false);
    useEditorStore.getState().openLoop();
    expect(useEditorStore.getState().loopOpen).toBe(true);
    useEditorStore.getState().closeLoop();
    expect(useEditorStore.getState().loopOpen).toBe(false);
  });

  it("opens and closes the Thumbnail modal", () => {
    expect(useEditorStore.getState().thumbnailOpen).toBe(false);
    useEditorStore.getState().openThumbnail();
    expect(useEditorStore.getState().thumbnailOpen).toBe(true);
    useEditorStore.getState().closeThumbnail();
    expect(useEditorStore.getState().thumbnailOpen).toBe(false);
  });

  it("opens and closes the Stitch modal", () => {
    expect(useEditorStore.getState().stitchOpen).toBe(false);
    useEditorStore.getState().openStitch();
    expect(useEditorStore.getState().stitchOpen).toBe(true);
    useEditorStore.getState().closeStitch();
    expect(useEditorStore.getState().stitchOpen).toBe(false);
  });

  it("starts with the Overlay modal closed", () => {
    expect(useEditorStore.getState().overlayOpen).toBe(false);
  });

  it("opens and closes the Overlay modal", () => {
    const { openOverlay, closeOverlay } = useEditorStore.getState();
    openOverlay();
    expect(useEditorStore.getState().overlayOpen).toBe(true);
    closeOverlay();
    expect(useEditorStore.getState().overlayOpen).toBe(false);
  });

  it("starts with no AI-created outputs", () => {
    expect(useEditorStore.getState().createdOutputs).toEqual([]);
  });

  it("records AI-created outputs newest-first", () => {
    const { addCreatedOutput } = useEditorStore.getState();
    addCreatedOutput("a");
    addCreatedOutput("b");
    expect(useEditorStore.getState().createdOutputs).toEqual(["b", "a"]);
  });

  it("moves a re-added output to the front without duplicating", () => {
    const { addCreatedOutput } = useEditorStore.getState();
    addCreatedOutput("a");
    addCreatedOutput("b");
    addCreatedOutput("a");
    expect(useEditorStore.getState().createdOutputs).toEqual(["a", "b"]);
  });
});
