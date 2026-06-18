import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { SubtitlesModal } from "./SubtitlesModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ subtitlesOpen: true }));
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

function setSlot(index: number, name: string, type: string) {
  const inputs = document.querySelectorAll('input[type="file"]');
  fireEvent.change(inputs[index] as HTMLInputElement, { target: { files: [new File(["x"], name, { type })] } });
}

describe("SubtitlesModal", () => {
  it("renders nothing when closed", () => {
    render(<SubtitlesModal />);
    expect(screen.queryByText(/Subtitles \(\.srt\)/)).not.toBeInTheDocument();
  });

  it("shows the two slots when open", () => {
    open();
    render(<SubtitlesModal />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Subtitles (.srt)")).toBeInTheDocument();
  });

  it("requires both a clip and an srt before burning", () => {
    open();
    render(<SubtitlesModal />);
    expect(screen.getByRole("button", { name: /Burn in/ })).toBeDisabled();
    setSlot(0, "clip.mp4", "video/mp4");
    expect(screen.getByRole("button", { name: /Burn in/ })).toBeDisabled();
    setSlot(1, "subs.srt", "text/plain");
    expect(screen.getByRole("button", { name: /Burn in/ })).toBeEnabled();
  });

  it("posts both files and shows the burned-cue count", async () => {
    open();
    render(<SubtitlesModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "subs.srt", "text/plain");
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "done", result: { outputId: "s1", cues: 12 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Burn in/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("srt")).toBeInstanceOf(File);
    expect(await screen.findByText(/12 subtitles burned in/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<SubtitlesModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "subs.srt", "text/plain");
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Burn in/ }));
    });
    expect(await screen.findByText(/Subtitles failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<SubtitlesModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "subs.srt", "text/plain");
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Burn in/ }));
    });
    expect(await screen.findByText(/Subtitles failed/)).toBeInTheDocument();
  });

  it("clears the slots and closes via ✕", () => {
    open();
    render(<SubtitlesModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("clip.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().subtitlesOpen).toBe(false);
  });
});
