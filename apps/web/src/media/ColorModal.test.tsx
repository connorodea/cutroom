import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ColorModal } from "./ColorModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ colorOpen: true }));
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

describe("ColorModal", () => {
  it("renders nothing when closed", () => {
    render(<ColorModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ColorModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<ColorModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the looks with Vivid pre-selected", () => {
    open();
    render(<ColorModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Vivid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Apply look/ })).toBeInTheDocument();
  });

  it("sends the chosen look and shows the applied result", async () => {
    open();
    render(<ColorModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "B&W" }));
    expect(screen.getByRole("button", { name: "B&W" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", status: "done", result: { outputId: "g1", saturation: 0, contrast: 1.05 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply look/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("preset")).toBe("bw");
    expect(await screen.findByText(/B&W applied/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<ColorModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply look/ }));
    });
    expect(await screen.findByText(/Color grade failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ColorModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply look/ }));
    });
    expect(await screen.findByText(/Color grade failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<ColorModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().colorOpen).toBe(false);
  });
});
