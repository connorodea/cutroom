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
