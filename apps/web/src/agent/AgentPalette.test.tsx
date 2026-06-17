import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { agentWorkflows, baseEditSteps } from "@cutroom/core";
import { useEditorStore } from "../editor/store";
import { AgentPalette } from "./AgentPalette";

function res(data: unknown, { ok = true }: { ok?: boolean } = {}): Response {
  return { ok, status: 200, json: async () => data } as unknown as Response;
}

const open = () => act(() => useEditorStore.setState({ agentOpen: true }));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
});

describe("AgentPalette", () => {
  it("renders nothing when closed", () => {
    render(<AgentPalette />);
    expect(screen.queryByText("AI Agent")).not.toBeInTheDocument();
  });

  it("shows the composer and the agentic workflows when open", () => {
    open();
    render(<AgentPalette />);
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tell the agent what to make/)).toBeInTheDocument();
    expect(screen.getByText(agentWorkflows[0].title)).toBeInTheDocument();
  });

  it("starts a run when a prompt is submitted", async () => {
    open();
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "Reel", steps: baseEditSteps }, source: "agent" }));
    render(<AgentPalette />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what to make/), { target: { value: "make a reel" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    });
    expect(useEditorStore.getState().phase).toBe("running");
    expect(useEditorStore.getState().title).toBe("Reel");
  });

  it("shows the scripted badge on fallback and returns to the composer via back", async () => {
    open();
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "P", steps: baseEditSteps }, source: "fallback" }));
    render(<AgentPalette />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what to make/), { target: { value: "go" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    });
    expect(screen.getByText("scripted")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]); // back arrow
    expect(screen.getByPlaceholderText(/Tell the agent what to make/)).toBeInTheDocument();
  });

  it.each([
    ["make it vertical for tiktok", "reframeOpen"],
    ["give me the best moments", "highlightsOpen"],
    ["clean up the silences and filler", "importOpen"],
    ["create a short explainer", "createOpen"],
  ] as const)("routes '%s' to the matching tool and closes the palette", (prompt, flag) => {
    open();
    render(<AgentPalette />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what to make/), { target: { value: prompt } });
    fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    expect((useEditorStore.getState() as unknown as Record<string, boolean>)[flag]).toBe(true);
    expect(useEditorStore.getState().agentOpen).toBe(false);
  });

  it("renders the run view with the plan's steps", async () => {
    open();
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "Reel", steps: baseEditSteps }, source: "agent" }));
    render(<AgentPalette />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what to make/), { target: { value: "go" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    });
    expect(screen.getByText(baseEditSteps[0].label)).toBeInTheDocument();
  });

  it("advances through all steps to Done", async () => {
    vi.useFakeTimers();
    open();
    fetchMock.mockResolvedValueOnce(res({ plan: { title: "P", steps: baseEditSteps }, source: "agent" }));
    render(<AgentPalette />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what to make/), { target: { value: "go" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(760 * (baseEditSteps.length + 1));
    });
    expect(screen.getByText("Done")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
