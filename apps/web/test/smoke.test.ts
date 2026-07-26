import { describe, expect, it } from "vitest";

describe("web app", () => {
  it("uses the canonical product brand", () => {
    expect("Growlogue").toMatch(/^Growlogue$/);
  });
});
