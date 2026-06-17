import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ReverseModal } from "./ReverseModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ reverseOpen: true }));
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

describe("ReverseModal", () => {
  it("renders nothing when closed", () => {
    render(<ReverseModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ReverseModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<ReverseModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("offers the modes with Reverse pre-selected", () => {
    open();
    render(<ReverseModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: "Reverse" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sends the chosen boomerang mode and shows the ready result", async () => {
    open();
    render(<ReverseModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: "Boomerang" }));
    expect(screen.getByRole("button", { name: "Boomerang" })).toHaveAttribute("aria-pressed", "true");
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "done", result: { outputId: "r1", reverseMode: "boomerang", hadAudio: false } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get("mode")).toBe("boomerang");
    expect(await screen.findByText(/Boomerang ready/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<ReverseModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    expect(await screen.findByText(/Reverse failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ReverseModal />);
    uploadVideo();
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    });
    expect(await screen.findByText(/Reverse failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<ReverseModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().reverseOpen).toBe(false);
  });
});
