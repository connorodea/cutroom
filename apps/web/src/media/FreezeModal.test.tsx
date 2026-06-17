import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { FreezeModal } from "./FreezeModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ freezeOpen: true }));
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

describe("FreezeModal", () => {
  it("renders nothing when closed", () => {
    render(<FreezeModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<FreezeModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<FreezeModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the hold positions with Hold end pre-selected", () => {
    open();
    render(<FreezeModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Hold end" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Freeze/ })).toBeInTheDocument();
  });

  it("sends the chosen position and seconds and shows the held result", async () => {
    open();
    render(<FreezeModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Hold start" }));
    fireEvent.change(screen.getByLabelText("seconds"), { target: { value: "3" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "z1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "z1", status: "done", result: { outputId: "z1", freezePosition: "start", freezeSeconds: 3 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Freeze/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("position")).toBe("start");
    expect(fd.get("seconds")).toBe("3");
    expect(await screen.findByText(/Hold start held/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<FreezeModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Freeze/ }));
    });
    expect(await screen.findByText(/Freeze failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<FreezeModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "z1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "z1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Freeze/ }));
    });
    expect(await screen.findByText(/Freeze failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<FreezeModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().freezeOpen).toBe(false);
  });
});
