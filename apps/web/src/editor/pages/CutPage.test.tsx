import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CutPage } from "./CutPage";

describe("CutPage", () => {
  it("renders the Source tape header", () => {
    render(<CutPage />);
    expect(screen.getByText("Source tape")).toBeInTheDocument();
  });

  it("renders a cut tool (Smart insert)", () => {
    render(<CutPage />);
    expect(screen.getByText("Smart insert")).toBeInTheDocument();
  });

  it("renders the Auto-assemble selects action", () => {
    render(<CutPage />);
    expect(screen.getByText("Auto-assemble selects")).toBeInTheDocument();
  });

  it("renders the Timeline overview label", () => {
    render(<CutPage />);
    expect(screen.getByText("Timeline overview")).toBeInTheDocument();
  });

  it("renders the V1 and A1 lanes", () => {
    render(<CutPage />);
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
  });
});
