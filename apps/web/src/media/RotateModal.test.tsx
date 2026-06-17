import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { RotateModal } from "./RotateModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ rotateOpen: true }));
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

describe("RotateModal", () => {
  it("renders nothing when closed", () => {
    render(<RotateModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<RotateModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<RotateModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the orientations with Right 90° pre-selected", () => {
    open();
    render(<RotateModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Right 90°" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Rotate/ })).toBeInTheDocument();
  });

  it("sends the chosen orientation and shows the applied result", async () => {
    open();
    render(<RotateModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Left 90°" }));
    expect(screen.getByRole("button", { name: "Left 90°" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "done", result: { outputId: "r1", orientation: "ccw" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Rotate/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("orientation")).toBe("ccw");
    expect(await screen.findByText(/Left 90° applied/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<RotateModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Rotate/ }));
    });
    expect(await screen.findByText(/Rotate failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<RotateModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Rotate/ }));
    });
    expect(await screen.findByText(/Rotate failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<RotateModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().rotateOpen).toBe(false);
  });
});
