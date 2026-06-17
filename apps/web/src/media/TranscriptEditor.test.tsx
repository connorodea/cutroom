import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TranscriptEditor } from "./TranscriptEditor";

function res(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
const file = () => new File(["v"], "clip.mp4", { type: "video/mp4" });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => "blob:x");
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  // jsdom doesn't implement media currentTime; make it a settable no-op so word-click seeking works.
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", { configurable: true, writable: true, value: 0 });
});
afterEach(() => vi.unstubAllGlobals());

const WORDS = [
  { word: "hello", start: 0, end: 0.5 },
  { word: "world", start: 0.5, end: 1 },
];

describe("TranscriptEditor", () => {
  it("transcribes on mount and lists the words with Apply disabled", async () => {
    fetchMock.mockResolvedValueOnce(res({ sourceId: "s1", duration: 1, words: WORDS }));
    render(<TranscriptEditor file={file()} />);
    expect(await screen.findByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
    expect(screen.getByText(/2 words · 0 struck/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply/ })).toBeDisabled();
  });

  it("striking a word enables Apply, then applying renders the result", async () => {
    fetchMock
      .mockResolvedValueOnce(res({ sourceId: "s1", duration: 1, words: WORDS }))
      .mockResolvedValueOnce(res({ id: "j", status: "queued" }))
      .mockResolvedValueOnce(res({ id: "j", status: "done", result: { outputId: "j", removedSec: 0.5 } }));
    render(<TranscriptEditor file={file()} />);
    fireEvent.click(await screen.findByText(/hello/));
    expect(screen.getByRole("button", { name: /Apply/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Apply/ }));
    expect(await screen.findByText("Applied")).toBeInTheDocument();
  });

  it("shows an error when transcription fails", async () => {
    fetchMock.mockResolvedValueOnce(res("", { ok: false, status: 500 }));
    render(<TranscriptEditor file={file()} />);
    expect(await screen.findByText(/transcribe failed/)).toBeInTheDocument();
  });
});
