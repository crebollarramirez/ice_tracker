import fs from "fs";
import path from "path";
import * as logger from "firebase-functions/logger";

/**
 * Interface for OpenAI API message structure.
 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Interface for OpenAI API choice structure.
 */
interface OpenAIChoice {
  message: {
    content: string;
    role: string;
  };
  finish_reason: string;
  index: number;
}

/**
 * Interface for OpenAI API response structure.
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interface for OpenAI API request body.
 */
interface OpenAIRequestBody {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
}

/**
 * Interface for OpenAI service operations.
 */
export interface IOpenAIService {
  /**
   * Determines if the given text contains negative content.
   * @param {string} additionalInfo - The text to analyze.
   * @returns {Promise<boolean>} True if negative content is detected.
   */
  isNegative(additionalInfo: string): Promise<boolean>;
  /** Optional property to expose max input length if needed. */
  MAX_INPUT_LENGTH?: number;
}

/**
 * OpenAI service implementation for content filtering.
 */
export class OpenAIService implements IOpenAIService {
  /** The prompt template for content analysis. */
  private readonly prompt: string | undefined;
  /** Maximum tokens for API response. */
  private readonly MAX_TOKENS = 100;
  /** GPT model to use for analysis. */
  private readonly MODEL = "gpt-4o";
  /** Temperature for deterministic output. */
  private readonly TEMPERATURE = 0.1;
  /** Maximum input length to avoid exceeding token limits. */
  readonly MAX_INPUT_LENGTH = 100;

  private useMock = false;

  /**
   * Initializes the OpenAI service with prompt.
   */
  constructor(useMock: boolean = false) {
    this.useMock = useMock;

    try {
      const promptPath = path.resolve(__dirname, "../../assets/prompt.txt");
      this.prompt = fs.readFileSync(promptPath, "utf8");
    } catch (error) {
      logger.warn("Error reading prompt file, using default prompt:", error);
      this.prompt =
        "You are a sentiment analyzer. Respond with only 'true' if the " +
        "text contains negative comments, complaints, or criticism. " +
        "Respond with only 'false' otherwise.";
    }
  }

  /**
   * Analyzes text content to determine if it contains negative sentiment.
   * @param {string} additionalInfo - The text to analyze for negativity.
   * @return {Promise<boolean>} True if negative content detected, false otherwise.
   */
  async isNegative(additionalInfo: string): Promise<boolean> {
    if (this.useMock) {
      return false;
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        // Error already logged in getOpenAIApiKey
        return false;
      }

      if (!additionalInfo || !additionalInfo.trim()) {
        return false;
      }

      // Check if input exceeds maximum allowed length
      if (additionalInfo.length > this.MAX_INPUT_LENGTH) {
        logger.warn(
          `Input length (${additionalInfo.length}) exceeds maximum ` +
            `allowed length (${this.MAX_INPUT_LENGTH})`
        );
        return true; // doing true because it might be abuse
      }

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.MODEL,
            messages: [
              {
                role: "system",
                content: this.prompt,
              },
              {
                role: "user",
                content: additionalInfo,
              },
            ],
            max_tokens: this.MAX_TOKENS,
            temperature: this.TEMPERATURE,
          } as OpenAIRequestBody),
        }
      );

      if (!response.ok) {
        logger.error("OpenAI API error:", response.status, response.statusText);
        return false;
      }

      const data = (await response.json()) as OpenAIResponse;

      if (data.choices && data.choices.length > 0) {
        const result = data.choices[0].message.content.toLowerCase().trim();
        return result === "true";
      }

      return false;
    } catch (error) {
      logger.error("OpenAI API error:", error);
      return false;
    }
  }

  setMock(mock: boolean): void {
    this.useMock = mock;
  }
}
