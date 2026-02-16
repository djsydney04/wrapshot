import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}

describe("Greeting", () => {
  it("renders a greeting", () => {
    render(<Greeting name="Wrapshot" />);

    // Use .toHaveTextContent instead of .toBeInTheDocument for compatibility with Vitest's built-in matchers
    expect(screen.getByRole("heading")).toHaveTextContent("Hello, Wrapshot");
  });
});
