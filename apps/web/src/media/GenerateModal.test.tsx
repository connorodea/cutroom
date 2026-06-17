import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { GenerateModal } from "./GenerateModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ generateOpen: true }));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
});

describe("GenerateModal", () => {
  it("renders nothing when closed", () => {
    render(<GenerateModal />);
    expect(screen.queryByText(/powered by Higgsfield/)).not.toBeInTheDocument();
  });

  it("shows the panel with Generate disabled until a prompt is entered", () => {
    open();
    render(<GenerateModal />);
    expect(screen.getByText(/powered by Higgsfield/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate/ })).toBeDisabled();
  });

  it("enables Generate once a prompt is typed", () => {
    open();
    render(<GenerateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a neon control room" } });
    expect(screen.getByRole("button", { name: /Generate/ })).toBeEnabled();
  });

  it("switches to video mode and shows the video model options", () => {
    open();
    render(<GenerateModal />);
    fireEvent.click(screen.getByText("Video"));
    expect(screen.getByText("DoP")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe the clip/)).toBeInTheDocument();
  });

  it("switches aspect and video model", () => {
    open();
    render(<GenerateModal />);
    fireEvent.click(screen.getByText("9:16"));
    fireEvent.click(screen.getByText("Video"));
    fireEvent.click(screen.getByText("Kling"));
    expect(screen.getByText("Kling")).toBeInTheDocument();
  });

  it("generates a video in video mode and records it as a clip", async () => {
    open();
    fetchMock
      .mockResolvedValueOnce(res({ id: "v1", type: "video", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "v1", type: "video", status: "done", result: { outputId: "v1", kind: "video" } }));
    render(<GenerateModal />);
    fireEvent.click(screen.getByText("Video"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a drone shot" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(useEditorStore.getState().createdOutputs).toContain("v1");
  });

  it("submits and shows the result on success", async () => {
    open();
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", type: "image", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", type: "image", status: "done", result: { outputId: "g1", kind: "image" } }));
    render(<GenerateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "an ocean" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("surfaces the Higgsfield credits error", async () => {
    open();
    fetchMock.mockResolvedValueOnce(res({ error: "not_enough_credits" }, { ok: false, status: 403 }));
    render(<GenerateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    });
    expect(await screen.findByText(/Generation failed/)).toBeInTheDocument();
  });
});
