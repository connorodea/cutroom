import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { WaveformModal } from "./WaveformModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ waveformOpen: true }));
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

function uploadAudio() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["a"], "track.mp3", { type: "audio/mpeg" })] } });
}

describe("WaveformModal", () => {
  it("renders nothing when closed", () => {
    render(<WaveformModal />);
    expect(screen.queryByText(/Drop an audio file here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<WaveformModal />);
    expect(screen.getByText(/Drop an audio file here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<WaveformModal />);
    const zone = screen.getByText(/Drop an audio file here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["a"], "dropped.wav", { type: "audio/wav" })] } });
    expect(screen.getByText("dropped.wav")).toBeInTheDocument();
  });

  it("offers the styles with Centered pre-selected", () => {
    open();
    render(<WaveformModal />);
    uploadAudio();
    expect(screen.getByRole("button", { name: "Centered" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Render/ })).toBeInTheDocument();
  });

  it("sends the chosen mode/color/aspect and shows the result", async () => {
    open();
    render(<WaveformModal />);
    uploadAudio();
    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    fireEvent.click(screen.getByRole("button", { name: "Magenta" }));
    fireEvent.click(screen.getByRole("button", { name: "Tall" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "w1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "w1", status: "done", result: { outputId: "w1", waveMode: "line", waveColor: "magenta", width: 720, height: 1280 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Render/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("mode")).toBe("line");
    expect(fd.get("color")).toBe("magenta");
    expect(fd.get("aspect")).toBe("portrait");
    expect(await screen.findByText(/Audiogram ready/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<WaveformModal />);
    uploadAudio();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Render/ }));
    });
    expect(await screen.findByText(/Audiogram failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<WaveformModal />);
    uploadAudio();
    fetchMock
      .mockResolvedValueOnce(res({ id: "w1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "w1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Render/ }));
    });
    expect(await screen.findByText(/Audiogram failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<WaveformModal />);
    uploadAudio();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop an audio file here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().waveformOpen).toBe(false);
  });
});
