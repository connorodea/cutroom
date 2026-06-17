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
