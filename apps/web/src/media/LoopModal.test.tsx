import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { LoopModal } from "./LoopModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ loopOpen: true }));
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
  fireEvent.change(input, { target: { files: [new File(["v"], "clip.mp4", { type: "video/mp4" })] } });
}

describe("LoopModal", () => {
  it("renders nothing when closed", () => {
    render(<LoopModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<LoopModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<LoopModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the repeat counts with 2x pre-selected", () => {
    open();
    render(<LoopModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Loop/ })).toBeInTheDocument();
  });

  it("sends the chosen count and shows the looped result", async () => {
    open();
    render(<LoopModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "3×" }));
    expect(screen.getByRole("button", { name: "3×" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "l1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "l1", status: "done", result: { outputId: "l1", count: 3, hadAudio: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Loop/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("count")).toBe("3");
    expect(await screen.findByText(/Looped 3×/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<LoopModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Loop/ }));
    });
    expect(await screen.findByText(/Loop failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<LoopModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "l1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "l1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Loop/ }));
    });
    expect(await screen.findByText(/Loop failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<LoopModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().loopOpen).toBe(false);
  });
});
