import { afterEach, describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEditorStore } from "../editor/store";
import { GenerateModal } from "./GenerateModal";

const open = () => act(() => useEditorStore.setState({ generateOpen: true }));
afterEach(() => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true)));

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
});
