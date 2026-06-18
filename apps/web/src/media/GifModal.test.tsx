import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { GifModal } from "./GifModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ gifOpen: true }));
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

describe("GifModal", () => {
  it("renders nothing when closed", () => {
    render(<GifModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<GifModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<GifModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the sizes with Medium pre-selected", () => {
    open();
    render(<GifModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Make GIF/ })).toBeInTheDocument();
  });

  it("sends the chosen width and shows the GIF result as an image", async () => {
    open();
    render(<GifModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    expect(screen.getByRole("button", { name: "Small" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", status: "done", result: { outputId: "g1", ext: "gif", width: 320 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make GIF/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("width")).toBe("320");
    expect(await screen.findByText("GIF ready")).toBeInTheDocument();
    expect(screen.getByAltText("GIF preview")).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<GifModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make GIF/ }));
    });
    expect(await screen.findByText(/GIF export failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<GifModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make GIF/ }));
    });
    expect(await screen.findByText(/GIF export failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<GifModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().gifOpen).toBe(false);
  });
});
