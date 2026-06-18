import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ThumbnailModal } from "./ThumbnailModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ thumbnailOpen: true }));
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

describe("ThumbnailModal", () => {
  it("renders nothing when closed", () => {
    render(<ThumbnailModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ThumbnailModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<ThumbnailModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers Capture frame once a video is chosen", () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: /Capture frame/ })).toBeInTheDocument();
  });

  it("captures the scrubbed frame time and shows the poster as an image", async () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { value: 4.2, configurable: true });
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "done", result: { outputId: "p1", time: 4.2, ext: "png" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Capture frame/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("time")).toBe("4.2");
    expect(await screen.findByText(/Poster grabbed at 4.2s/)).toBeInTheDocument();
    expect(screen.getByAltText("poster frame")).toBeInTheDocument();
  });

  it("defaults to time 0 when the video has not been scrubbed", async () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "done", result: { outputId: "p1", time: 0, ext: "png" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Capture frame/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("time")).toBe("0");
  });

  it("surfaces an error", async () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Capture frame/ }));
    });
    expect(await screen.findByText(/Thumbnail failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Capture frame/ }));
    });
    expect(await screen.findByText(/Thumbnail failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<ThumbnailModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().thumbnailOpen).toBe(false);
  });
});
