import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { CreateModal } from "./CreateModal";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
const open = () => act(() => useEditorStore.setState({ createOpen: true }));
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
});

describe("CreateModal", () => {
  it("renders nothing when closed", () => {
    render(<CreateModal />);
    expect(screen.queryByText("Create with AI")).not.toBeInTheDocument();
  });

  it("shows the panel with Generate disabled until a prompt is entered", () => {
    open();
    render(<CreateModal />);
    expect(screen.getByText("Create with AI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate/ })).toBeDisabled();
  });

  it("enables Generate once a prompt is typed", () => {
    open();
    render(<CreateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a teaser" } });
    expect(screen.getByRole("button", { name: /Generate/ })).toBeEnabled();
  });

  it("submits and shows the result on success", async () => {
    open();
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", type: "create", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", type: "create", status: "done", result: { outputId: "c1", durationSec: 5, segments: 3, captionsApplied: true } }));
    render(<CreateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a teaser" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("surfaces a failure from the worker", async () => {
    open();
    fetchMock.mockResolvedValueOnce(res({ error: "boom" }, { ok: false, status: 400 }));
    render(<CreateModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    });
    expect(await screen.findByText(/Create failed/)).toBeInTheDocument();
  });
});
