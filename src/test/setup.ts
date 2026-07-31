import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

// jsdom does not implement layout, so Range#getBoundingClientRect is missing entirely.
if (typeof Range !== "undefined" && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
    toJSON() { return this; },
  });
}
