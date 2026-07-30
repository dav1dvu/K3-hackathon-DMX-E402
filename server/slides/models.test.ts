// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildLessonContext,
  groupElementsByPage,
  normalizeElement,
  type SlideElement,
} from "./models.js";

describe("slide document models", () => {
  it("normalizes Unstructured metadata and drops empty elements", () => {
    expect(normalizeElement({
      text: "  ReAct combines reasoning and acting.  ",
      filename: "lesson.pdf",
      page_number: 5,
      element_type: "NarrativeText",
    }, "fallback.pdf")).toEqual({
      text: "ReAct combines reasoning and acting.",
      filename: "lesson.pdf",
      page_number: 5,
      element_type: "NarrativeText",
    });
    expect(normalizeElement({ text: "   ", page_number: 1 }, "lesson.pdf")).toBeNull();
  });

  it("groups elements by page without losing slide boundaries", () => {
    const elements: SlideElement[] = [
      { text: "Title one", filename: "lesson.pdf", page_number: 1, element_type: "Title" },
      { text: "Body one", filename: "lesson.pdf", page_number: 1, element_type: "NarrativeText" },
      { text: "Body two", filename: "lesson.pdf", page_number: 2, element_type: "ListItem" },
    ];
    const slides = groupElementsByPage(elements);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({
      page_number: 1,
      text: "Title one\nBody one",
      element_types: ["Title", "NarrativeText"],
    });
    expect(slides[1]).toMatchObject({ page_number: 2, text: "Body two" });
  });

  it("builds lesson context in page order", () => {
    const context = buildLessonContext([
      { filename: "lesson.pdf", page_number: 3, text: "Third", element_types: ["Text"] },
      { filename: "lesson.pdf", page_number: 1, text: "First", element_types: ["Title"] },
    ]);
    expect(context.indexOf("[SLIDE 1]")).toBeLessThan(context.indexOf("[SLIDE 3]"));
    expect(context).toContain("---");
  });
});
