import { afterEach, describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "./store";
import { EditorShell } from "./EditorShell";

afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

describe("EditorShell", () => {
  it("renders the topbar tabs and primary actions", () => {
    render(<EditorShell />);
    expect(screen.getByText("Deliver")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import/ })).toBeInTheDocument();
  });

  it("switches the active page when a tab is clicked", () => {
    render(<EditorShell />);
    fireEvent.click(screen.getByText("Deliver"));
    expect(useEditorStore.getState().page).toBe("deliver");
  });

  it("opens the Create modal from the topbar", () => {
    render(<EditorShell />);
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    expect(useEditorStore.getState().createOpen).toBe(true);
  });

  it("toggles the agent palette on Cmd-K", () => {
    render(<EditorShell />);
    expect(useEditorStore.getState().agentOpen).toBe(false);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(useEditorStore.getState().agentOpen).toBe(true);
  });
});
