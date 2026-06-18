import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { CaptionsModal } from "./CaptionsModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ captionsOpen: true }));
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

describe("CaptionsModal", () => {
  it("renders nothing when closed", () => {
    render(<CaptionsModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<CaptionsModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<CaptionsModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers Add captions once a video is chosen", () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    expect(screen.getByText("talk.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add captions/ })).toBeInTheDocument();
  });

  it("burns captions and shows the captioned result", async () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", type: "captions", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", type: "captions", status: "done", result: { outputId: "c1", totalWords: 13, captionsApplied: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    expect(await screen.findByText("Captioned")).toBeInTheDocument();
    expect(screen.getByText(/13 words/)).toBeInTheDocument();
  });

  it("reports when no speech was found", async () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", status: "done", result: { outputId: "c1", totalWords: 0, captionsApplied: false } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    expect(await screen.findByText(/no speech found/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    expect(await screen.findByText(/Captions failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    expect(await screen.findByText(/Captions failed/)).toBeInTheDocument();
  });

  it("defaults to bottom and sends the chosen position when set to top", async () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    // Default selection is bottom.
    expect(screen.getByRole("button", { name: "bottom" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "top" }));
    expect(screen.getByRole("button", { name: "top" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", status: "done", result: { outputId: "c1", totalWords: 4, captionsApplied: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("position")).toBe("top");
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<CaptionsModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().captionsOpen).toBe(false);
  });
});
