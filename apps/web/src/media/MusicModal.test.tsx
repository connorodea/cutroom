import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { MusicModal } from "./MusicModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ musicOpen: true }));
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

describe("MusicModal", () => {
  it("renders nothing when closed", () => {
    render(<MusicModal />);
    expect(screen.queryByText(/Music level/)).not.toBeInTheDocument();
  });

  it("shows the two slots when open", () => {
    open();
    render(<MusicModal />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
  });

  it("requires both a clip and a track before mixing", () => {
    open();
    render(<MusicModal />);
    expect(screen.getByRole("button", { name: /Add music/ })).toBeDisabled();
    setSlot(0, "clip.mp4", "video/mp4");
    expect(screen.getByRole("button", { name: /Add music/ })).toBeDisabled();
    setSlot(1, "song.mp3", "audio/mpeg");
    expect(screen.getByRole("button", { name: /Add music/ })).toBeEnabled();
  });

  it("posts the chosen level and shows the result", async () => {
    open();
    render(<MusicModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "song.mp3", "audio/mpeg");
    fireEvent.click(screen.getByRole("button", { name: "Loud" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "m1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "m1", status: "done", result: { outputId: "m1", musicVolume: 0.7, hadAudio: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add music/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("music")).toBeInstanceOf(File);
    expect(fd.get("volume")).toBe("0.7");
    expect(await screen.findByText(/Music added/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<MusicModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "song.mp3", "audio/mpeg");
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add music/ }));
    });
    expect(await screen.findByText(/Background music failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<MusicModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    setSlot(1, "song.mp3", "audio/mpeg");
    fetchMock
      .mockResolvedValueOnce(res({ id: "m1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "m1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add music/ }));
    });
    expect(await screen.findByText(/Background music failed/)).toBeInTheDocument();
  });

  it("clears the slots and closes via ✕", () => {
    open();
    render(<MusicModal />);
    setSlot(0, "clip.mp4", "video/mp4");
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("clip.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().musicOpen).toBe(false);
  });
});
