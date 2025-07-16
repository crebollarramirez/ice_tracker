import { IOpenAIService } from "../../src/utils/aiFilter";

/**
 * Mock OpenAI service for testing purposes.
 */
export class MockOpenAIService implements IOpenAIService {
  private mockResponses: Map<string, boolean> = new Map();
  private shouldThrowError = false;
  private defaultResponse = false;
  readonly MAX_INPUT_LENGTH = 100;

  /**
   * Set a mock response for a specific input text.
   */
  setMockResponse(input: string, response: boolean): void {
    this.mockResponses.set(input, response);
  }

  /**
   * Set the default response for inputs that don't have specific mock responses.
   */
  setDefaultResponse(response: boolean): void {
    this.defaultResponse = response;
  }

  /**
   * Configure the service to simulate an API error on the next call.
   */
  setShouldThrowError(shouldThrow: boolean): void {
    this.shouldThrowError = shouldThrow;
  }

  /**
   * Mock implementation of isNegative.
   * Returns null on error to match the real service behavior.
   */
  async isNegative(additionalInfo: string): Promise<boolean> {
    if (this.shouldThrowError) {
      // Simulate API error by returning false (matching real service behavior)
      return false;
    }

    // Return false for empty or whitespace-only input
    if (!additionalInfo || !additionalInfo.trim()) {
      return false;
    }

    if (additionalInfo.length > this.MAX_INPUT_LENGTH) {
      // Simulate behavior for input exceeding max length (matching real service behavior)
      return true; // doing true because it might be abuse
    }

    // Check if there's a specific mock response for this input
    if (this.mockResponses.has(additionalInfo)) {
      return this.mockResponses.get(additionalInfo) || false;
    }

    // Return the default response
    return this.defaultResponse;
  }

  /**
   * Clear all mock responses and reset to defaults.
   */
  clearMockResponses(): void {
    this.mockResponses.clear();
    this.shouldThrowError = false;
    this.defaultResponse = false;
  }

  /**
   * Get the number of mock responses currently set.
   */
  getMockResponseCount(): number {
    return this.mockResponses.size;
  }

  /**
   * Check if a specific input has a mock response set.
   */
  hasMockResponse(input: string): boolean {
    return this.mockResponses.has(input);
  }
}
