import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { KenBurnsModal } from "./KenBurnsModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ kenBurnsOpen: true }));
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

function uploadImage() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["i"], "photo.png", { type: "image/png" })] } });
}

describe("KenBurnsModal", () => {
  it("renders nothing when closed", () => {
    render(<KenBurnsModal />);
    expect(screen.queryByText(/Drop a photo here/)).not.toBeInTheDocument();
  });

  it("shows the dropzone when open", () => {
    open();
    render(<KenBurnsModal />);
    expect(screen.getByText(/Drop a photo here/)).toBeInTheDocument();
  });

  it("highlights on drag and accepts a dropped image", () => {
    open();
    render(<KenBurnsModal />);
    const zone = screen.getByText(/Drop a photo here/).parentElement as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["i"], "dropped.png", { type: "image/png" })] } });
    expect(screen.getByText("dropped.png")).toBeInTheDocument();
  });

  it("offers the directions with Zoom in pre-selected", () => {
    open();
    render(<KenBurnsModal />);
    uploadImage();
    expect(screen.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Animate/ })).toBeInTheDocument();
  });

  it("sends the chosen direction/aspect/seconds and shows the result", async () => {
    open();
    render(<KenBurnsModal />);
    uploadImage();
    fireEvent.click(screen.getByRole("button", { name: "Pan right" }));
    fireEvent.click(screen.getByRole("button", { name: "Tall" }));
    fireEvent.change(screen.getByLabelText("seconds"), { target: { value: "8" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "k1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "k1", status: "done", result: { outputId: "k1", kbDirection: "right", kbSeconds: 8, width: 720, height: 1280 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Animate/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("direction")).toBe("right");
    expect(fd.get("aspect")).toBe("portrait");
    expect(fd.get("seconds")).toBe("8");
    expect(await screen.findByText(/Pan right applied/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<KenBurnsModal />);
    uploadImage();
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Animate/ }));
    });
    expect(await screen.findByText(/Ken Burns failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<KenBurnsModal />);
    uploadImage();
    fetchMock
      .mockResolvedValueOnce(res({ id: "k1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "k1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Animate/ }));
    });
    expect(await screen.findByText(/Ken Burns failed/)).toBeInTheDocument();
  });

  it("changes the file via Change and closes via ✕", () => {
    open();
    render(<KenBurnsModal />);
    uploadImage();
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/Drop a photo here/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().kenBurnsOpen).toBe(false);
  });
});
