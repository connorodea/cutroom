import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EditPage } from "./EditPage";

describe("EditPage", () => {
  it("renders the Source and Program viewer labels", () => {
    render(<EditPage />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Program")).toBeInTheDocument();
  });

  it("renders the Inspector with a Transform section", () => {
    render(<EditPage />);
    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getByText("Transform")).toBeInTheDocument();
  });

  it("renders a transform slider (Zoom)", () => {
    render(<EditPage />);
    expect(screen.getByText("Zoom")).toBeInTheDocument();
  });

  it("renders the Composite blend mode control", () => {
    render(<EditPage />);
    expect(screen.getByText("Blend mode")).toBeInTheDocument();
  });

  it("renders the V3 title lane in the multitrack timeline", () => {
    render(<EditPage />);
    expect(screen.getByText("V3")).toBeInTheDocument();
  });
});
