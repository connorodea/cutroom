import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { TrimModal } from "./TrimModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ trimOpen: true }));
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

describe("TrimModal", () => {
  it("renders nothing when closed", () => {
    render(<TrimModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<TrimModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<TrimModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("sends the chosen start/end window and shows the kept window", async () => {
    open();
    render(<TrimModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("start"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("end"), { target: { value: "12" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "t1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "t1", status: "done", result: { outputId: "t1", start: 5, end: 12, durationSec: 7 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Trim/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("start")).toBe("5");
    expect(fd.get("end")).toBe("12");
    expect(await screen.findByText(/5s → 12s/)).toBeInTheDocument();
    expect(screen.getByText(/7s kept/)).toBeInTheDocument();
  });

  it("leaves end open when the end field is blank (defaults start to 0)", async () => {
    open();
    render(<TrimModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("start"), { target: { value: "" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "t1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "t1", status: "done", result: { outputId: "t1", start: 0, end: 9, durationSec: 9 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Trim/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("start")).toBe("0");
    expect(fd.get("end")).toBe("");
  });

  it("surfaces an error", async () => {
    open();
    render(<TrimModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Trim/ }));
    });
    expect(await screen.findByText(/Trim failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<TrimModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "t1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "t1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Trim/ }));
    });
    expect(await screen.findByText(/Trim failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<TrimModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().trimOpen).toBe(false);
  });
});
