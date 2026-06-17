import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { SpeedModal } from "./SpeedModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ speedOpen: true }));
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

describe("SpeedModal", () => {
  it("renders nothing when closed", () => {
    render(<SpeedModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<SpeedModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<SpeedModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers Change speed once a video is chosen, defaulting to a 2× timelapse", () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("timelapse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change speed/ })).toBeInTheDocument();
  });

  it("switches to slow-motion when a sub-1× factor is selected and sends it", async () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "0.5×" }));
    expect(screen.getByRole("button", { name: "0.5×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("slow-motion")).toBeInTheDocument();
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "done", result: { outputId: "s1", factor: 0.5, hadAudio: false } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change speed/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("factor")).toBe("0.5");
    expect(await screen.findByText(/0.5× slower/)).toBeInTheDocument();
    expect(screen.getByText("no audio")).toBeInTheDocument();
  });

  it("retimes and shows the faster result with retimed audio", async () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", type: "speed", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", type: "speed", status: "done", result: { outputId: "s1", factor: 2, hadAudio: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change speed/ }));
    });
    expect(await screen.findByText(/2× faster/)).toBeInTheDocument();
    expect(screen.getByText("audio retimed")).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change speed/ }));
    });
    expect(await screen.findByText(/Speed change failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change speed/ }));
    });
    expect(await screen.findByText(/Speed change failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<SpeedModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().speedOpen).toBe(false);
  });
});
