import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { AudioModal } from "./AudioModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ audioOpen: true }));
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

describe("AudioModal", () => {
  it("renders nothing when closed", () => {
    render(<AudioModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<AudioModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<AudioModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the audio presets with Normalize pre-selected", () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Normalize" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Apply/ })).toBeInTheDocument();
  });

  it("sends mode=mute (level 1) when Mute is chosen", async () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(screen.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "a1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "a1", status: "done", result: { outputId: "a1", audioMode: "mute", hadAudio: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("mode")).toBe("mute");
    expect(fd.get("level")).toBe("1");
    expect(await screen.findByText(/Mute applied/)).toBeInTheDocument();
  });

  it("sends mode=volume with a level when Quieter is chosen, and notes a missing audio track", async () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Quieter" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "a1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "a1", status: "done", result: { outputId: "a1", audioMode: "volume", hadAudio: false } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("mode")).toBe("volume");
    expect(fd.get("level")).toBe("0.5");
    expect(await screen.findByText(/Quieter applied/)).toBeInTheDocument();
    expect(screen.getByText("no audio track")).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    expect(await screen.findByText(/Audio change failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "a1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "a1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    expect(await screen.findByText(/Audio change failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<AudioModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().audioOpen).toBe(false);
  });
});
