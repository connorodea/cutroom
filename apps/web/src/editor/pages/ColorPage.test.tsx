import { afterEach, describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../store";
import { ColorPage } from "./ColorPage";

afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

describe("ColorPage", () => {
  it("renders the media pool and color inspector tabs", () => {
    render(<ColorPage />);
    expect(screen.getByText("Media Pool")).toBeInTheDocument();
    expect(screen.getByText("Wheels")).toBeInTheDocument();
    expect(screen.getByText("Curves")).toBeInTheDocument();
  });

  it("shows the agent grade note", () => {
    render(<ColorPage />);
    expect(screen.getByText(/for a consistent grade/)).toBeInTheDocument();
  });

  it("opens the agent palette when the rail agent button is clicked", () => {
    render(<ColorPage />);
    expect(useEditorStore.getState().agentOpen).toBe(false);
    fireEvent.click(screen.getByTitle("AI Agent (⌘K)"));
    expect(useEditorStore.getState().agentOpen).toBe(true);
  });
});
