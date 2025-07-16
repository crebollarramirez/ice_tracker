import fs from "fs";
import path from "path";

export interface IOpenAIService {
  isNegative(additionalInfo: string): Promise<boolean>;
  MAX_INPUT_LENGTH?: number; // Optional property to expose max input length if needed
}

export class OpenAIService implements IOpenAIService {
  private readonly apiKey: string | undefined;
  private readonly prompt: string | undefined;
  private readonly MAX_TOKENS = 100; // Added constant for max tokens, can be adjusted if needed
  private readonly MODEL = "gpt-4o"; // Consider changing model if needed based on token limits and cost
  private readonly TEMPERATURE = 0.1; // Fixed temperature for deterministic output
  readonly MAX_INPUT_LENGTH = 100; // Added constant for max input length to avoid exceeding token limits

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      console.warn("OpenAI API key not found in environment variables");
    }

    try {
      const promptPath = path.resolve(__dirname, "../../assets/prompt.txt");
      this.prompt = fs.readFileSync(promptPath, "utf8");
    } catch (error) {
      console.warn("Error reading prompt file, using default prompt:", error);
      this.prompt =
        "You are a sentiment analyzer. Respond with only 'true' if the text contains negative comments, complaints, or criticism. Respond with only 'false' otherwise.";
    }
  }

  async isNegative(additionalInfo: string): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.error("OpenAI API key not found in environment variables");
        return false;
      }

      if (!additionalInfo || !additionalInfo.trim()) {
        return false;
      }

      // Check if input exceeds maximum allowed length
      if (additionalInfo.length > this.MAX_INPUT_LENGTH) {
        console.warn(
          `Input length (${additionalInfo.length}) exceeds maximum allowed length (${this.MAX_INPUT_LENGTH})`
        );
        return true; // doing true because it might be abuse
      }

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
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
          }),
        }
      );

      if (!response.ok) {
        console.error(
          "OpenAI API error:",
          response.status,
          response.statusText
        );
        return false;
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        const result = data.choices[0].message.content.toLowerCase().trim();
        return result === "true";
      }

      return false;
    } catch (error) {
      console.error("OpenAI API error:", error);
      return false;
    }
  }
}
