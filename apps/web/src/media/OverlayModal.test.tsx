import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { OverlayModal } from "./OverlayModal";

const open = () => act(() => useEditorStore.setState({ overlayOpen: true }));

beforeEach(() => {
  // jsdom has no object-URL support; the dropzone needs it on file select.
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => "blob:x");
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});
afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

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
});
