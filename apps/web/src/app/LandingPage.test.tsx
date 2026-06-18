import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("renders the section heading and a primary CTA to open the editor", () => {
    render(<LandingPage />);
    expect(screen.getByText("Built for the AI age")).toBeInTheDocument();
    expect(screen.getAllByText(/Open the editor/).length).toBeGreaterThan(0);
  });

  it("renders the feature highlights", () => {
    render(<LandingPage />);
    expect(screen.getByText("Prompt → finished video")).toBeInTheDocument();
    expect(screen.getByText("Edit by transcript")).toBeInTheDocument();
    expect(screen.getByText("Generate your footage")).toBeInTheDocument();
  });

  it("links to the editor at /app", () => {
    render(<LandingPage />);
    const appLinks = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/app");
    expect(appLinks.length).toBeGreaterThan(0);
  });

  it("shows the footer system status", () => {
    render(<LandingPage />);
    expect(screen.getByText("All systems normal")).toBeInTheDocument();
  });
});
