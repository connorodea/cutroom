import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ProgressModal } from "./ProgressModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ progressOpen: true }));
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

describe("ProgressModal", () => {
  it("renders nothing when closed", () => {
    render(<ProgressModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ProgressModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<ProgressModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the colors with Cyan pre-selected", () => {
    open();
    render(<ProgressModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Cyan" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Add bar/ })).toBeInTheDocument();
  });

  it("sends the chosen color + thickness and shows the result", async () => {
    open();
    render(<ProgressModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Thick" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "done", result: { outputId: "p1", progressColor: "red", barHeight: 16 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add bar/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("color")).toBe("red");
    expect(fd.get("thickness")).toBe("thick");
    expect(await screen.findByText(/Progress bar added/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<ProgressModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add bar/ }));
    });
    expect(await screen.findByText(/Progress bar failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ProgressModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add bar/ }));
    });
    expect(await screen.findByText(/Progress bar failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<ProgressModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().progressOpen).toBe(false);
  });
});
