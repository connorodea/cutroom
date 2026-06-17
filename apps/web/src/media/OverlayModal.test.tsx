import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { OverlayModal } from "./OverlayModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ overlayOpen: true }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom has no object-URL support; the dropzone needs it on file select.
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
  const file = new File(["v"], "clip.mp4", { type: "video/mp4" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("OverlayModal", () => {
  it("renders nothing when closed", () => {
    render(<OverlayModal />);
    expect(screen.queryByText("Overlay graphics")).not.toBeInTheDocument();
  });

  it("shows the dropzone when opened without a file", () => {
    open();
    render(<OverlayModal />);
    expect(screen.getByText("Overlay graphics")).toBeInTheDocument();
    expect(screen.getByText(/Drop a video here/)).toBeInTheDocument();
  });

  it("disables Composite until a video and a graphic both exist", () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Composite/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Title"));
    expect(screen.getByRole("button", { name: /Composite/ })).toBeEnabled();
  });

  it("composites and shows the result on success", async () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Title"));
    fireEvent.change(screen.getByPlaceholderText("Text"), { target: { value: "My Title" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "o1", type: "overlay", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "o1", type: "overlay", status: "done", result: { outputId: "o1", overlaysApplied: 1 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Composite/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("rejects an empty-text graphic on composite", async () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Title")); // no text typed
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Composite/ }));
    });
    expect(await screen.findByText(/Add at least one element with text/)).toBeInTheDocument();
  });

  it("surfaces a job-error status from compositing", async () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Title"));
    fireEvent.change(screen.getByPlaceholderText("Text"), { target: { value: "T" } });
    fetchMock
      .mockResolvedValueOnce(res({ id: "o1", type: "overlay", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "o1", type: "overlay", status: "error", error: "composite failed" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Composite/ }));
    });
    expect(await screen.findByText(/Overlay failed/)).toBeInTheDocument();
  });

  it("surfaces an error when compositing fails", async () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Title"));
    fireEvent.change(screen.getByPlaceholderText("Text"), { target: { value: "My Title" } });
    fetchMock.mockResolvedValueOnce(res({ error: "overlay boom" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Composite/ }));
    });
    expect(await screen.findByText(/Overlay failed/)).toBeInTheDocument();
  });

  it("renders and updates the x/y inputs for a callout", () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Callout"));
    const numbers = screen.getAllByRole("spinbutton"); // x, y, start, end
    expect(numbers.length).toBeGreaterThanOrEqual(4);
    fireEvent.change(numbers[0], { target: { value: "0.7" } });
    expect(numbers[0]).toHaveValue(0.7);
  });

  it("renders and updates the corner select for a badge", () => {
    open();
    render(<OverlayModal />);
    uploadVideo();
    fireEvent.click(screen.getByRole("button", { name: /Add graphic/ }));
    fireEvent.click(screen.getByText("Badge"));
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "bl" } });
    expect(select).toHaveValue("bl");
  });
});
