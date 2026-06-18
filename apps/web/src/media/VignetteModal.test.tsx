import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { VignetteModal } from "./VignetteModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ vignetteOpen: true }));
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

describe("VignetteModal", () => {
  it("renders nothing when closed", () => {
    render(<VignetteModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<VignetteModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<VignetteModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the strengths with Medium pre-selected", () => {
    open();
    render(<VignetteModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Apply vignette/ })).toBeInTheDocument();
  });

  it("sends the chosen strength and shows the result", async () => {
    open();
    render(<VignetteModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Strong" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "v1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "v1", status: "done", result: { outputId: "v1", vignetteStrength: "strong" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply vignette/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("strength")).toBe("strong");
    expect(await screen.findByText(/Vignette applied/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<VignetteModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply vignette/ }));
    });
    expect(await screen.findByText(/Vignette failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<VignetteModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "v1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "v1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply vignette/ }));
    });
    expect(await screen.findByText(/Vignette failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<VignetteModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().vignetteOpen).toBe(false);
  });
});
