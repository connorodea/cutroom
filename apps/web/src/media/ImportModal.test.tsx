import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ImportModal } from "./ImportModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ importOpen: true }));
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

describe("ImportModal", () => {
  it("renders nothing when closed", () => {
    render(<ImportModal />);
    expect(screen.queryByText(/Import & clean up/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<ImportModal />);
    expect(screen.getByText(/Import & clean up/)).toBeInTheDocument();
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("offers clean-up and transcript editing once a video is chosen", () => {
    open();
    render(<ImportModal />);
    uploadVideo();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clean up/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit transcript/ })).toBeInTheDocument();
  });

  it("closes via the ✕ button", () => {
    open();
    render(<ImportModal />);
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().importOpen).toBe(false);
  });

  it("runs clean-up and shows the result", async () => {
    open();
    render(<ImportModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(
      res({ id: "e1", type: "edit", status: "done", result: { outputId: "e1", removedSec: 2, totalWords: 50, captionsApplied: true } }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Clean up/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("surfaces an error when clean-up fails", async () => {
    open();
    render(<ImportModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res("", { ok: false, status: 500 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Clean up/ }));
    });
    expect(await screen.findByText(/Edit failed/)).toBeInTheDocument();
  });

  it("enters transcript mode and shows the transcribed words", async () => {
    open();
    render(<ImportModal />);
    uploadVideo();
    fetchMock.mockResolvedValueOnce(res({ sourceId: "s1", duration: 1, words: [{ word: "hi", start: 0, end: 0.5 }] }));
    fireEvent.click(screen.getByRole("button", { name: /Edit transcript/ }));
    expect(await screen.findByText(/hi/)).toBeInTheDocument();
  });
});
