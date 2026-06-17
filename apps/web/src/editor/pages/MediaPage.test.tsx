import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { MediaPage } from "./MediaPage";
import { useEditorStore } from "../store";

// Keep the store from leaking AI-created outputs between tests.
const reset = () => act(() => useEditorStore.setState(useEditorStore.getInitialState(), true));
afterEach(reset);

describe("MediaPage", () => {
  it("renders the Bins heading", () => {
    render(<MediaPage />);
    expect(screen.getByText("Bins")).toBeInTheDocument();
  });

  it("renders the Footage bin (also shown in the browser breadcrumb)", () => {
    render(<MediaPage />);
    // "Footage" appears as the active bin and in the browser path.
    expect(screen.getAllByText("Footage").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Metadata heading", () => {
    render(<MediaPage />);
    expect(screen.getByText("Metadata")).toBeInTheDocument();
  });

  it("renders a metadata value", () => {
    render(<MediaPage />);
    // metaFields includes { key: "Frame rate", value: "23.98 fps" }
    expect(screen.getByText("23.98 fps")).toBeInTheDocument();
  });

  it("renders the 'interview' keyword chip", () => {
    render(<MediaPage />);
    expect(screen.getByText("interview")).toBeInTheDocument();
  });

  it("does not render the 'Created with AI' section when there are no created outputs", () => {
    render(<MediaPage />);
    expect(screen.queryByText("Created with AI")).not.toBeInTheDocument();
  });

  it("renders a 'Created with AI' section with the created outputs (newest-first)", () => {
    act(() => useEditorStore.setState({ createdOutputs: ["aaaaaa-1", "bbbbbb-2"] }));
    render(<MediaPage />);
    // Section heading + count.
    expect(screen.getByText("Created with AI")).toBeInTheDocument();
    expect(screen.getByText("2 clips")).toBeInTheDocument();
    // A card per output, each playable from the worker media URL.
    const videos = screen.getAllByTestId("ai-clip-video");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toHaveAttribute("src", expect.stringContaining("aaaaaa-1"));
    expect(videos[1]).toHaveAttribute("src", expect.stringContaining("bbbbbb-2"));
  });
});
