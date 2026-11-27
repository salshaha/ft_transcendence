import { describe, expect, it } from "vitest";

import { toDateTimeInput, toUtcIsoString } from "./formatters";

describe("instructor deadline conversion", () => {
  it("round-trips a stored UTC deadline through the local datetime input", () => {
    const stored = "2026-12-01T07:00:00.000Z";
    const inputValue = toDateTimeInput(stored);
    expect(inputValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(toUtcIsoString(inputValue)).toBe(stored);
  });

  it("returns null for an empty deadline", () => {
    expect(toDateTimeInput(null)).toBe("");
    expect(toUtcIsoString("")).toBe(null);
  });
});
