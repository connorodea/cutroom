import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { WatermarkModal } from "./WatermarkModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ watermarkOpen: true }));
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

describe("WatermarkModal", () => {
  it("renders nothing when closed", () => {
    render(<WatermarkModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<WatermarkModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<WatermarkModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("disables Add watermark until text is entered", () => {
    open();
    render(<WatermarkModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: /Add watermark/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("watermark text"), { target: { value: "@cutroom" } });
    expect(screen.getByRole("button", { name: /Add watermark/ })).toBeEnabled();
  });

  it("sends the text, chosen corner and opacity, then shows the result", async () => {
    open();
    render(<WatermarkModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("watermark text"), { target: { value: "@cutroom" } });
    fireEvent.click(screen.getByRole("button", { name: "TL" }));
    fireEvent.click(screen.getByRole("button", { name: "Strong" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "w1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "w1", status: "done", result: { outputId: "w1", corner: "tl", opacity: 0.8 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add watermark/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("text")).toBe("@cutroom");
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("opacity")).toBe("0.8");
    expect(await screen.findByText("Watermarked")).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<WatermarkModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("watermark text"), { target: { value: "x" } });
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add watermark/ }));
    });
    expect(await screen.findByText(/Watermark failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<WatermarkModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("watermark text"), { target: { value: "x" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "w1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "w1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add watermark/ }));
    });
    expect(await screen.findByText(/Watermark failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<WatermarkModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().watermarkOpen).toBe(false);
  });
});
