import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { CensorModal } from "./CensorModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ censorOpen: true }));
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

describe("CensorModal", () => {
  it("renders nothing when closed", () => {
    render(<CensorModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<CensorModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<CensorModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the regions with Center pre-selected", () => {
    open();
    render(<CensorModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Center" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Blur region/ })).toBeInTheDocument();
  });

  it("sends the chosen region and strength and shows the result", async () => {
    open();
    render(<CensorModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    fireEvent.change(screen.getByLabelText("strength"), { target: { value: "30" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "x1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "x1", status: "done", result: { outputId: "x1", censorRegion: "top", censorStrength: 30 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Blur region/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("region")).toBe("top");
    expect(fd.get("strength")).toBe("30");
    expect(await screen.findByText(/Top blurred/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<CensorModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Blur region/ }));
    });
    expect(await screen.findByText(/Censor failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<CensorModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "x1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "x1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Blur region/ }));
    });
    expect(await screen.findByText(/Censor failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<CensorModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().censorOpen).toBe(false);
  });
});
