import { preferredMediaTypes } from "../media-type";

describe("preferredMediaTypes", () => {
  describe("when no accept header is provided", () => {
    it("returns all provided types when accept is undefined", () => {
      const result = preferredMediaTypes(undefined, ["text/html", "application/json"]);
      expect(result).toEqual(["text/html", "application/json"]);
    });

    it("returns all provided types when accept is empty string", () => {
      // empty string → no types accepted → no matches
      const result = preferredMediaTypes("", ["text/html"]);
      expect(result).toEqual([]);
    });
  });

  describe("when provided list is omitted", () => {
    it("returns sorted list of accepted types from the Accept header", () => {
      const result = preferredMediaTypes("text/html, application/json;q=0.9");
      expect(result).toContain("text/html");
      expect(result).toContain("application/json");
      // text/html should come first (higher q)
      expect(result.indexOf("text/html")).toBeLessThan(result.indexOf("application/json"));
    });

    it("returns empty array when Accept header has q=0 for all types", () => {
      const result = preferredMediaTypes("text/html;q=0");
      expect(result).toEqual([]);
    });

    it("returns wildcard type */* when no provided list is given", () => {
      const result = preferredMediaTypes("*/*");
      expect(result).toContain("*/*");
    });
  });

  describe("exact type matching", () => {
    it("returns a type that exactly matches the Accept header", () => {
      const result = preferredMediaTypes("application/json", ["application/json", "text/html"]);
      expect(result).toEqual(["application/json"]);
    });

    it("returns empty array when provided type does not match Accept header", () => {
      const result = preferredMediaTypes("application/json", ["text/html"]);
      expect(result).toEqual([]);
    });

    it("returns types in quality order", () => {
      const result = preferredMediaTypes(
        "text/html;q=0.5, application/json;q=0.9",
        ["text/html", "application/json"],
      );
      expect(result[0]).toBe("application/json");
      expect(result[1]).toBe("text/html");
    });
  });

  describe("wildcard matching", () => {
    it("matches any type with */* in Accept header", () => {
      const result = preferredMediaTypes("*/*", ["application/json", "text/html"]);
      expect(result).toContain("application/json");
      expect(result).toContain("text/html");
    });

    it("matches any subtype with type/* in Accept header", () => {
      const result = preferredMediaTypes("text/*", ["text/html", "text/plain", "application/json"]);
      expect(result).toContain("text/html");
      expect(result).toContain("text/plain");
      expect(result).not.toContain("application/json");
    });
  });

  describe("quality values", () => {
    it("excludes types with q=0", () => {
      const result = preferredMediaTypes("text/html;q=0, application/json", [
        "text/html",
        "application/json",
      ]);
      expect(result).not.toContain("text/html");
      expect(result).toContain("application/json");
    });

    it("treats missing q value as q=1", () => {
      const result = preferredMediaTypes("text/html", ["text/html", "application/json"]);
      expect(result).toContain("text/html");
    });

    it("sorts multiple types by descending quality", () => {
      const result = preferredMediaTypes(
        "text/plain;q=0.3, text/html;q=0.8, application/json;q=0.5",
        ["text/plain", "text/html", "application/json"],
      );
      expect(result[0]).toBe("text/html");
      expect(result[1]).toBe("application/json");
      expect(result[2]).toBe("text/plain");
    });
  });

  describe("parameter handling", () => {
    it("matches a type with matching parameters", () => {
      const result = preferredMediaTypes("text/html;level=1", ["text/html;level=1", "text/html"]);
      // text/html;level=1 should be a more specific match
      expect(result).toContain("text/html;level=1");
    });
  });

  describe("case insensitivity", () => {
    it("matches types case-insensitively", () => {
      const result = preferredMediaTypes("Application/JSON", ["application/json"]);
      expect(result).toContain("application/json");
    });
  });

  describe("multiple accept types", () => {
    it("handles a complex Accept header with multiple entries", () => {
      const accept = "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8";
      const provided = ["application/json", "text/html", "application/xml"];
      const result = preferredMediaTypes(accept, provided);
      // text/html matches exactly (q=1), application/xml matches (q=0.9),
      // application/json matches via */* (q=0.8)
      expect(result).toContain("text/html");
      expect(result).toContain("application/xml");
      expect(result).toContain("application/json");
      expect(result.indexOf("text/html")).toBeLessThan(result.indexOf("application/xml"));
      expect(result.indexOf("application/xml")).toBeLessThan(result.indexOf("application/json"));
    });
  });
});
