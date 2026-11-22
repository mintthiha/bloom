import { beforeEach, describe, expect, it } from "vitest";
import {
  buildVisualStyleBootScript,
  parseVisualStyle,
  VISUAL_STYLE_ATTRIBUTE,
  VISUAL_STYLE_STORAGE_KEY,
} from "./visual-style";

describe("parseVisualStyle", () => {
  it("returns extravagant only for the exact stored value", () => {
    expect(parseVisualStyle("extravagant")).toBe("extravagant");
  });

  it("returns classic for the classic value", () => {
    expect(parseVisualStyle("classic")).toBe("classic");
  });

  it.each([null, undefined, "", "EXTRAVAGANT", "true", "something-else"])(
    "falls back to classic for %j",
    (storedValue) => {
      expect(parseVisualStyle(storedValue)).toBe("classic");
    }
  );
});

describe("buildVisualStyleBootScript", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(VISUAL_STYLE_ATTRIBUTE);
  });

  /** Runs the generated script the way the browser would from the document head. */
  function runBootScript() {
    new Function(buildVisualStyleBootScript())();
  }

  it("stamps extravagant onto the document when that look is saved", () => {
    localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, "extravagant");
    runBootScript();
    expect(document.documentElement.getAttribute(VISUAL_STYLE_ATTRIBUTE)).toBe("extravagant");
  });

  it("stamps classic when nothing is saved", () => {
    runBootScript();
    expect(document.documentElement.getAttribute(VISUAL_STYLE_ATTRIBUTE)).toBe("classic");
  });

  it("stamps classic for an unrecognised saved value", () => {
    localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, "neon");
    runBootScript();
    expect(document.documentElement.getAttribute(VISUAL_STYLE_ATTRIBUTE)).toBe("classic");
  });
});
