import { afterEach, describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { CreateModal } from "./CreateModal";

const open = () => act(() => useEditorStore.setState({ createOpen: true }));
afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

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
});
