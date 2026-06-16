import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MediaPage } from "./MediaPage";

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
});
