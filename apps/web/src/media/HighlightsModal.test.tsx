import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { HighlightsModal } from "./HighlightsModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ highlightsOpen: true }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => "blob:x");
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
});

function uploadVideo() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["v"], "talk.mp4", { type: "video/mp4" })] } });
}

describe("HighlightsModal", () => {
  it("renders nothing when closed", () => {
    render(<HighlightsModal />);
    expect(screen.queryByText("Auto-highlights")).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<HighlightsModal />);
    expect(screen.getByText("Auto-highlights")).toBeInTheDocument();
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<HighlightsModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("shows the clip-count control after a video is chosen and lets it change", () => {
    open();
    render(<HighlightsModal />);
    uploadVideo();
    expect(screen.getByText("talk.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("4"));
    expect(screen.getByRole("button", { name: /Make highlights/ })).toBeInTheDocument();
  });

  it("transcribes then builds the reel and shows the result", async () => {
    open();
    render(<HighlightsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ sourceId: "s1", duration: 10, words: [{ word: "a", start: 0, end: 1 }] }))
      .mockResolvedValueOnce(res({ id: "h1", type: "highlights", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "h1", type: "highlights", status: "done", result: { outputId: "h1", clips: 2, durationSec: 12 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make highlights/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/2 clips/)).toBeInTheDocument();
    expect(useEditorStore.getState().createdOutputs).toContain("h1");
  });

  it("surfaces an error when the reel cannot be built", async () => {
    open();
    render(<HighlightsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ sourceId: "s1", duration: 10, words: [] }))
      .mockResolvedValueOnce(res({ error: "no highlights found" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make highlights/ }));
    });
    expect(await screen.findByText(/Highlights failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<HighlightsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ sourceId: "s1", duration: 10, words: [{ word: "a", start: 0, end: 1 }] }))
      .mockResolvedValueOnce(res({ id: "h1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "h1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make highlights/ }));
    });
    expect(await screen.findByText(/Highlights failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<HighlightsModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().highlightsOpen).toBe(false);
  });
});
