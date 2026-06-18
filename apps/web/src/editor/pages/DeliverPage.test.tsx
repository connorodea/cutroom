import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DeliverPage } from "./DeliverPage";

describe("DeliverPage", () => {
  it("renders the Render Settings panel", () => {
    render(<DeliverPage />);
    expect(screen.getByText("Render Settings")).toBeInTheDocument();
  });

  it("renders a render preset (YouTube 4K)", () => {
    render(<DeliverPage />);
    expect(screen.getByText("YouTube 4K")).toBeInTheDocument();
  });

  it("renders the Add to Render Queue button", () => {
    render(<DeliverPage />);
    expect(screen.getByText("Add to Render Queue")).toBeInTheDocument();
  });

  it("renders the Render Queue with a job", () => {
    render(<DeliverPage />);
    expect(screen.getByText("Render Queue")).toBeInTheDocument();
    expect(screen.getByText("Northwind_Ep04_Master")).toBeInTheDocument();
  });

  it("renders the Render All action", () => {
    render(<DeliverPage />);
    expect(screen.getByText("Render All")).toBeInTheDocument();
  });
});
