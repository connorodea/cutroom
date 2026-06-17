import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { PipModal } from "./PipModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ pipOpen: true }));
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
function setSlot(index: number, name: string) {
  const inputs = document.querySelectorAll('input[type="file"]');
  fireEvent.change(inputs[index] as HTMLInputElement, { target: { files: [vid(name)] } });
}

describe("PipModal", () => {
  it("renders nothing when closed", () => {
    render(<PipModal />);
    expect(screen.queryByText(/Main video/)).not.toBeInTheDocument();
  });

  it("shows the two slots when open", () => {
    open();
    render(<PipModal />);
    expect(screen.getByText("Main video")).toBeInTheDocument();
    expect(screen.getByText("Overlay (corner)")).toBeInTheDocument();
  });

  it("requires both a main and an overlay clip before combining", () => {
    open();
    render(<PipModal />);
    expect(screen.getByRole("button", { name: /Combine/ })).toBeDisabled();
    setSlot(0, "main.mp4");
    expect(screen.getByRole("button", { name: /Combine/ })).toBeDisabled();
    setSlot(1, "cam.mp4");
    expect(screen.getByRole("button", { name: /Combine/ })).toBeEnabled();
  });

  it("composites the chosen corner/scale and shows the result", async () => {
    open();
    render(<PipModal />);
    setSlot(0, "main.mp4");
    setSlot(1, "cam.mp4");
    fireEvent.click(screen.getByRole("button", { name: "TL" }));
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "done", result: { outputId: "p1", corner: "tl", scale: 0.45 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Combine/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("overlay")).toBeInstanceOf(File);
    expect(fd.get("corner")).toBe("tl");
    expect(fd.get("scale")).toBe("0.45");
    expect(await screen.findByText(/Picture-in-picture ready/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<PipModal />);
    setSlot(0, "main.mp4");
    setSlot(1, "cam.mp4");
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Combine/ }));
    });
    expect(await screen.findByText(/Picture-in-picture failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<PipModal />);
    setSlot(0, "main.mp4");
    setSlot(1, "cam.mp4");
    fetchMock
      .mockResolvedValueOnce(res({ id: "p1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "p1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Combine/ }));
    });
    expect(await screen.findByText(/Picture-in-picture failed/)).toBeInTheDocument();
  });

  it("clears the slots and closes via ✕", () => {
    open();
    render(<PipModal />);
    setSlot(0, "main.mp4");
    expect(screen.getByText("main.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("main.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().pipOpen).toBe(false);
  });
});
