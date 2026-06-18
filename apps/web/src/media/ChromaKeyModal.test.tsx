import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { ChromaKeyModal } from "./ChromaKeyModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ chromaKeyOpen: true }));
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

describe("ChromaKeyModal", () => {
  it("renders nothing when closed", () => {
    render(<ChromaKeyModal />);
    expect(screen.queryByText(/Green-screen clip/)).not.toBeInTheDocument();
  });

  it("shows the two slots when open", () => {
    open();
    render(<ChromaKeyModal />);
    expect(screen.getByText("Green-screen clip")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
  });

  it("requires both clips before keying", () => {
    open();
    render(<ChromaKeyModal />);
    expect(screen.getByRole("button", { name: /Key out/ })).toBeDisabled();
    setSlot(0, "subject.mp4");
    expect(screen.getByRole("button", { name: /Key out/ })).toBeDisabled();
    setSlot(1, "bg.mp4");
    expect(screen.getByRole("button", { name: /Key out/ })).toBeEnabled();
  });

  it("posts the chosen screen color and shows the result", async () => {
    open();
    render(<ChromaKeyModal />);
    setSlot(0, "subject.mp4");
    setSlot(1, "bg.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", status: "done", result: { outputId: "c1", chromaColor: "0x0000FF", chromaSimilarity: 0.3, chromaBlend: 0.1 } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Key out/ }));
    });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("background")).toBeInstanceOf(File);
    expect(fd.get("color")).toBe("blue");
    expect(await screen.findByText(/Background replaced/)).toBeInTheDocument();
  });

  it("surfaces an error", async () => {
    open();
    render(<ChromaKeyModal />);
    setSlot(0, "subject.mp4");
    setSlot(1, "bg.mp4");
    fetchMock.mockResolvedValueOnce(res({ error: "bad" }, { ok: false, status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Key out/ }));
    });
    expect(await screen.findByText(/Green screen failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    open();
    render(<ChromaKeyModal />);
    setSlot(0, "subject.mp4");
    setSlot(1, "bg.mp4");
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", status: "error", error: "boom" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Key out/ }));
    });
    expect(await screen.findByText(/Green screen failed/)).toBeInTheDocument();
  });

  it("clears the slots and closes via ✕", () => {
    open();
    render(<ChromaKeyModal />);
    setSlot(0, "subject.mp4");
    expect(screen.getByText("subject.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("subject.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(useEditorStore.getState().chromaKeyOpen).toBe(false);
  });
});
