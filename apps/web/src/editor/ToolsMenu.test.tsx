import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "./store";
import { ToolsMenu } from "./ToolsMenu";

beforeEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));
afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

describe("ToolsMenu", () => {
  it("shows only the Tools button until opened", () => {
    render(<ToolsMenu />);
    expect(screen.getByRole("button", { name: /Tools/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Search tools")).not.toBeInTheDocument();
  });

  it("opens a categorised menu with the search box and grouped tools", () => {
    render(<ToolsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Tools/ }));
    expect(screen.getByLabelText("Search tools")).toBeInTheDocument();
    expect(screen.getByText("Transform")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reframe/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Green screen/ })).toBeInTheDocument();
  });

  it("filters tools to a flat list as you type, hiding category headers", () => {
    render(<ToolsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Tools/ }));
    fireEvent.change(screen.getByLabelText("Search tools"), { target: { value: "split" } });
    expect(screen.getByRole("button", { name: /Split/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reframe/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Transform")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<ToolsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Tools/ }));
    fireEvent.change(screen.getByLabelText("Search tools"), { target: { value: "zzzzz" } });
    expect(screen.getByText(/No tools match/)).toBeInTheDocument();
  });

  it("opens the chosen tool's modal and closes the menu", () => {
    render(<ToolsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Tools/ }));
    fireEvent.click(screen.getByRole("button", { name: /Split/ }));
    expect(useEditorStore.getState().splitOpen).toBe(true);
    expect(screen.queryByLabelText("Search tools")).not.toBeInTheDocument();
  });

  it("highlights a tool row on hover", () => {
    render(<ToolsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Tools/ }));
    const reframe = screen.getByRole("button", { name: /Reframe/ });
    fireEvent.mouseEnter(reframe);
    expect(reframe.style.background).not.toBe("transparent");
    fireEvent.mouseLeave(reframe);
    expect(reframe.style.background).toBe("transparent");
  });

  it("toggles closed when the Tools button is clicked again", () => {
    render(<ToolsMenu />);
    const btn = screen.getByRole("button", { name: /Tools/ });
    fireEvent.click(btn);
    expect(screen.getByLabelText("Search tools")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByLabelText("Search tools")).not.toBeInTheDocument();
  });
});
