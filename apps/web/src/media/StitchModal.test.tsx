import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { StitchModal } from "./StitchModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ stitchOpen: true }));
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

const vid = (name: string) => new File(["v"], name, { type: "video/mp4" });
function addFiles(names: string[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: names.map(vid) } });
}

describe("StitchModal", () => {
  it("renders nothing when closed", () => {
    render(<StitchModal />);
    expect(screen.queryByText(/Drop a few videos here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<StitchModal />);
    expect(screen.getByText(/Drop a few videos here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts dropped files", () => {
    open();
    render(<StitchModal />);
    const zone = screen.getByText(/Drop a few videos here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [vid("a.mp4"), vid("b.mp4")] } });
    expect(screen.getByText("a.mp4")).toBeInTheDocument();
    expect(screen.getByText("b.mp4")).toBeInTheDocument();
  });

  it("lists the clips and requires at least two before stitching", () => {
    open();
    render(<StitchModal />);
    addFiles(["one.mp4"]);
    expect(screen.getByText(/Add at least one more clip/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stitch 1 clips/ })).toBeDisabled();
    addFiles(["two.mp4"]);
    expect(screen.getByRole("button", { name: /Stitch 2 clips/ })).toBeEnabled();
  });

  it("stitches the chosen clips and shows the result", async () => {
    open();
    render(<StitchModal />);
    addFiles(["a.mp4", "b.mp4"]);
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "done", result: { outputId: "s1", clips: 2, hadAudio: true } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Stitch 2 clips/ }));
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).getAll("files")).toHaveLength(2);
    expect(await screen.findByText(/Stitched 2 clips/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<StitchModal />);
    addFiles(["a.mp4", "b.mp4"]);
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Stitch 2 clips/ }));
    });
    expect(await screen.findByText(/Stitch failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<StitchModal />);
    addFiles(["a.mp4", "b.mp4"]);
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Stitch 2 clips/ }));
    });
    expect(await screen.findByText(/Stitch failed/)).toBeInTheDocument();
  });

  it("clears the list and closes via ✕", () => {
    open();
    render(<StitchModal />);
    addFiles(["a.mp4", "b.mp4"]);
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByText(/Drop a few videos here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().stitchOpen).toBe(false);
  });
});
