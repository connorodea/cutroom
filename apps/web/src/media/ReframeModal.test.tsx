import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ReframeModal } from "./ReframeModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ reframeOpen: true }));
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

describe("ReframeModal", () => {
  it("renders nothing when closed", () => {
    render(<ReframeModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ReframeModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<ReframeModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("shows aspect/fit controls after a video is chosen and lets them toggle", () => {
    open();
    render(<ReframeModal />);
    uploadVideo();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("16:9"));
    fireEvent.click(screen.getByText("Crop"));
    expect(screen.getByRole("button", { name: /Reframe/ })).toBeInTheDocument();
  });

  it("reframes and shows the result with its dimensions", async () => {
    open();
    render(<ReframeModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", type: "reframe", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", type: "reframe", status: "done", result: { outputId: "r1", width: 720, height: 1280, mode: "blur" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Reframe/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/720×1280/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ReframeModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Reframe/ }));
    });
    expect(await screen.findByText(/Reframe failed/)).toBeInTheDocument();
  });

  it("surfaces a thrown error", async () => {
    open();
    render(<ReframeModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Reframe/ }));
    });
    expect(await screen.findByText(/Reframe failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<ReframeModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().reframeOpen).toBe(false);
  });
});
