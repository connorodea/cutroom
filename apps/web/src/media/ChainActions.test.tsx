import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChainActions } from "./ChainActions";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("ChainActions", () => {
  it("renders the follow-up action buttons", () => {
    render(<ChainActions outputId="o1" />);
    expect(screen.getByRole("button", { name: /Make vertical/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add captions/ })).toBeInTheDocument();
  });

  it("chains a reframe (portrait/blur), shows the result, then resets via More", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", type: "reframe", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", type: "reframe", status: "done", result: { outputId: "r1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make vertical/ }));
    });
    expect(screen.getByText("Chained")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "reframe", aspect: "portrait", mode: "blur" });
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    expect(screen.getByRole("button", { name: /Make vertical/ })).toBeInTheDocument();
  });

  it("chains captions", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "c1", type: "captions", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "c1", type: "captions", status: "done", result: { outputId: "c1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add captions/ }));
    });
    expect(screen.getByText("Chained")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "captions" });
  });

  it("chains a 2× speed-up with a default factor", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "s1", type: "speed", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "s1", type: "speed", status: "done", result: { outputId: "s1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /2× speed/ }));
    });
    expect(screen.getByText("Chained")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "speed", factor: 2 });
  });

  it("chains a Vivid color grade", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "g1", type: "color", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "g1", type: "color", status: "done", result: { outputId: "g1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Grade/ }));
    });
    expect(screen.getByText("Chained")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "color", preset: "vivid" });
  });

  it("chains a both-ends fade", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "f1", type: "fade", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "f1", type: "fade", status: "done", result: { outputId: "f1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Fade ends/ }));
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "fade", kind: "both" });
  });

  it("chains a boomerang", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "b1", type: "reverse", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "b1", type: "reverse", status: "done", result: { outputId: "b1" } }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Boomerang/ }));
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outputId: "o1", op: "reverse", mode: "boomerang" });
  });

  it("shows a working state while the chain is in flight", async () => {
    let resolveSubmit: (v: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { resolveSubmit = r; }));
    render(<ChainActions outputId="o1" />);
    fireEvent.click(screen.getByRole("button", { name: /Make vertical/ }));
    expect(await screen.findByText("Working…")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res({ id: "r1", status: "done", result: { outputId: "r1" } }));
    await act(async () => {
      resolveSubmit(res({ id: "r1", status: "queued" }));
    });
  });

  it("surfaces a chain error from the server", async () => {
    fetchMock.mockResolvedValueOnce(res({ error: "nope" }, { ok: false, status: 404 }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make vertical/ }));
    });
    expect(screen.getByText(/Chain failed/)).toBeInTheDocument();
  });

  it("surfaces a job-error status", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ id: "r1", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "r1", status: "error", error: "render boom" }));
    render(<ChainActions outputId="o1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make vertical/ }));
    });
    expect(screen.getByText(/Chain failed/)).toBeInTheDocument();
  });
});
