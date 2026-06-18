import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { FadeModal } from "./FadeModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ fadeOpen: true }));
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

describe("FadeModal", () => {
  it("renders nothing when closed", () => {
    render(<FadeModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<FadeModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<FadeModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the fade kinds with Both pre-selected", () => {
    open();
    render(<FadeModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Both" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Add fade/ })).toBeInTheDocument();
  });

  it("sends the chosen kind and duration and shows the applied result", async () => {
    open();
    render(<FadeModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "In" }));
    fireEvent.change(screen.getByLabelText("duration"), { target: { value: "1.5" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "f1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "f1", status: "done", result: { outputId: "f1", fadeKind: "in", dur: 1.5 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add fade/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("kind")).toBe("in");
    expect(fd.get("duration")).toBe("1.5");
    expect(await screen.findByText(/Fade in applied/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<FadeModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add fade/ }));
    });
    expect(await screen.findByText(/Fade failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<FadeModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "f1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "f1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add fade/ }));
    });
    expect(await screen.findByText(/Fade failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<FadeModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().fadeOpen).toBe(false);
  });
});
