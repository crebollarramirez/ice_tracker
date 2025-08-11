import { sanitizeInput } from "@utils/addressHandling";
import { describe, it, expect } from "@jest/globals";

describe("sanitizeInput", () => {
  it("should remove HTML tags", () => {
    const input = "<script>alert('xss')</script>Hello World";
    const result = sanitizeInput(input);
    expect(result).toBe("alert(xss)Hello World");
  });

  it("should remove dangerous characters", () => {
    const input = 'Hello &\' "World" <script>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello & World");
  });

  it("should trim whitespace", () => {
    const input = "  Hello World  ";
    const result = sanitizeInput(input);
    expect(result).toBe("Hello World");
  });

  it("should limit length to 500 characters", () => {
    const input = "a".repeat(600);
    const result = sanitizeInput(input);
    expect(result).toHaveLength(500);
  });

  it("should return empty string for invalid input", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
  });

  it("should handle empty string", () => {
    const result = sanitizeInput("");
    expect(result).toBe("");
  });

  it("should handle string with only whitespace", () => {
    const input = "   ";
    const result = sanitizeInput(input);
    expect(result).toBe("");
  });

  it("should handle mixed HTML and dangerous characters", () => {
    const input = '<div>Hello &amp; "quoted" text</div>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello &amp; quoted text");
  });
});
