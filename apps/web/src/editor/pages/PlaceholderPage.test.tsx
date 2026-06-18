import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceholderPage } from "./PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders the title and subtitle it is given", () => {
    render(<PlaceholderPage title="Cut" subtitle="Trim and arrange" icon="scissors" />);
    expect(screen.getByText("Cut")).toBeInTheDocument();
    expect(screen.getByText("Trim and arrange")).toBeInTheDocument();
  });
});
