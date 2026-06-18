import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { MemeModal } from "./MemeModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ memeOpen: true }));
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

describe("MemeModal", () => {
  it("renders nothing when closed", () => {
    render(<MemeModal />);
    expect(screen.queryByText(/Drop a video here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<MemeModal />);
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped file", () => {
    open();
    render(<MemeModal />);
    const zone = screen.getByText(/Drop a video here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["v"], "dropped.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("dropped.mp4")).toBeInTheDocument();
  });

  it("requires at least one line of text before making the meme", () => {
    open();
    render(<MemeModal />);
    uploadVideo();
    expect(screen.getByRole("button", { name: /Make meme/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Top text"), { target: { value: "hello" } });
    expect(screen.getByRole("button", { name: /Make meme/ })).toBeEnabled();
  });

  it("sends the top + bottom text and shows the result", async () => {
    open();
    render(<MemeModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("Top text"), { target: { value: "one does not simply" } });
    fireEvent.change(screen.getByLabelText("Bottom text"), { target: { value: "make a meme" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "m1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "m1", status: "done", result: { outputId: "m1", memeTop: "one does not simply", memeBottom: "make a meme" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make meme/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("top")).toBe("one does not simply");
    expect(fd.get("bottom")).toBe("make a meme");
    expect(await screen.findByText(/Meme ready/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<MemeModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("Top text"), { target: { value: "x" } });
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make meme/ }));
    });
    expect(await screen.findByText(/Meme failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<MemeModal />);
    uploadVideo();
    fireEvent.change(screen.getByLabelText("Bottom text"), { target: { value: "y" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "m1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "m1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make meme/ }));
    });
    expect(await screen.findByText(/Meme failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<MemeModal />);
    uploadVideo();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().memeOpen).toBe(false);
  });
});
