import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders an svg for a known name", () => {
    const { container } = render(<Icon name="palette" size={20} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders nothing for an unknown name", () => {
    const { container } = render(<Icon name="definitely-not-an-icon" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
