import {MockOpenAIService } from "../mockAiFilter";
import {describe, it, expect, beforeEach, afterEach} from "@jest/globals";

describe("OpenAIService", () => {
  let mockService: MockOpenAIService;

  beforeEach(() => {
    mockService = new MockOpenAIService();
  });

  afterEach(() => {
    mockService.clearMockResponses();
  });

  describe("isNegative", () => {
    it("should return false for empty input", async () => {
      const result = await mockService.isNegative("");
      expect(result).toBe(false);
    });

    it("should return false for whitespace-only input", async () => {
      const result = await mockService.isNegative("   ");
      expect(result).toBe(false);
    });

    it("should return false for positive/neutral content", async () => {
      mockService.setMockResponse("This place is great!", false);

      const result = await mockService.isNegative("This place is great!");
      expect(result).toBe(false);
    });

    it("should return true for negative/inappropriate content", async () => {
      mockService.setMockResponse(
        "This place is terrible and should be shut down!",
        true
      );

      const result = await mockService.isNegative(
        "This place is terrible and should be shut down!"
      );
      expect(result).toBe(true);
    });

    it("should return true for political content", async () => {
      mockService.setMockResponse(
        "The president is doing a terrible job",
        true
      );

      const result = await mockService.isNegative(
        "The president is doing a terrible job"
      );
      expect(result).toBe(true);
    });

    it("should return true for hate speech", async () => {
      mockService.setMockResponse("I hate people from that country", true);

      const result = await mockService.isNegative(
        "I hate people from that country"
      );
      expect(result).toBe(true);
    });

    it("should return false for factual information", async () => {
      mockService.setMockResponse(
        "The location has 3 ice officers on duty",
        false
      );

      const result = await mockService.isNegative(
        "The location has 3 ice officers on duty"
      );
      expect(result).toBe(false);
    });

    it("should handle API errors gracefully", async () => {
      mockService.setShouldThrowError(true);

      const result = await mockService.isNegative("Any text");
      expect(result).toBe(false);
    });

    it("should handle multiple different inputs correctly", async () => {
      const testCases = [
        { input: "Great service here!", expected: false },
        { input: "This place violates safety standards", expected: true },
        { input: "They have good food", expected: false },
        { input: "Everyone should avoid this place", expected: true },
      ];

      testCases.forEach((testCase) => {
        mockService.setMockResponse(testCase.input, testCase.expected);
      });

      for (const testCase of testCases) {
        const result = await mockService.isNegative(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it("should handle long input strings", async () => {
      const longInput = "This is a very long input ".repeat(50); // 1000+ characters
      mockService.setMockResponse(longInput, true);

      const result = await mockService.isNegative(longInput);
      expect(result).toBe(true);
    });
  });
});
